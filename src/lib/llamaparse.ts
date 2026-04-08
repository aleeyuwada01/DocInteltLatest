/**
 * LlamaParse v2 API Integration
 * 
 * Uses the multipart upload endpoint: POST /api/v2/parse/upload
 * Polls results via: GET /api/v2/parse/{job_id}?expand=markdown,text
 * 
 * Production-ready: retry logic, exponential backoff, timeout handling
 */
import fs from 'fs';
import path from 'path';

const LLAMA_API_KEY = process.env.LLAMA_CLOUD_API_KEY || '';
const BASE_URL = 'https://api.cloud.llamaindex.ai/api/v2';
const PARSE_TIER = process.env.LLAMA_PARSE_TIER || 'agentic_plus';
const PARSE_VERSION = process.env.LLAMA_PARSE_VERSION || 'latest';

export interface ParseResult {
  markdown: string;
  text: string;
  jobId: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Robustly extract text content from LlamaParse responses.
 * Handles: raw strings, stringified JSON with pages array, 
 * objects with pages array, and nested structures.
 */
function extractContent(raw: any, field: 'markdown' | 'text'): string {
  if (!raw) return '';
  
  // If it's an array of pages directly
  if (Array.isArray(raw)) {
    return raw.map((p: any) => p[field] || p.markdown || p.text || '').filter(Boolean).join('\n\n');
  }
  
  // If it's a string, check if it's JSON
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // Try to parse as JSON if it looks like JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        // { "pages": [...] }
        if (parsed.pages && Array.isArray(parsed.pages)) {
          const extracted = parsed.pages
            .map((p: any) => p[field] || p.markdown || p.text || '')
            .filter(Boolean)
            .join('\n\n');
          return extracted || trimmed;
        }
        // Direct array
        if (Array.isArray(parsed)) {
          return parsed
            .map((p: any) => p[field] || p.markdown || p.text || '')
            .filter(Boolean)
            .join('\n\n');
        }
        // Single object with the field
        if (parsed[field]) return parsed[field];
      } catch {
        // Not valid JSON — use as raw string
      }
    }
    return trimmed;
  }
  
  // If it's an object with pages
  if (typeof raw === 'object' && raw.pages && Array.isArray(raw.pages)) {
    return raw.pages.map((p: any) => p[field] || p.markdown || p.text || '').filter(Boolean).join('\n\n');
  }
  
  return String(raw);
}

/**
 * Upload file and start parsing via v2 multipart endpoint.
 * Returns the job ID for polling.
 */
async function uploadAndParse(filePath: string, mimeType?: string): Promise<string> {
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: mimeType || 'application/octet-stream' });

  const configuration = JSON.stringify({
    tier: PARSE_TIER,
    version: PARSE_VERSION,
    processing_options: {
      ocr_parameters: {
        languages: ['en'],
      },
    },
    output_options: {
      markdown: {
        annotate_links: true,
        tables: {
          output_tables_as_markdown: true,
          merge_continued_tables: true,
        },
      },
    },
    processing_control: {
      timeouts: {
        base_in_seconds: 600,
        extra_time_per_page_in_seconds: 30,
      },
      job_failure_conditions: {
        allowed_page_failure_ratio: 0.1,
        fail_on_image_extraction_error: false,
        fail_on_image_ocr_error: false,
      },
    },
  });

  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('configuration', configuration);

  const res = await fetch(`${BASE_URL}/parse/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LLAMA_API_KEY}`,
      accept: 'application/json',
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LlamaParse v2 upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  // v2 response has { id, status, ... } or nested { job: { id } }
  const jobId = data.id || data.job?.id;
  if (!jobId) {
    throw new Error(`LlamaParse v2 upload returned no job ID: ${JSON.stringify(data)}`);
  }

  console.log(`[LlamaParse v2] Upload success — Job ID: ${jobId}`);
  return jobId;
}

/**
 * Poll job status and retrieve results when complete.
 * Uses expand=markdown,text to get both formats in one call.
 */
async function pollForResult(jobId: string, maxWait = 600_000): Promise<ParseResult> {
  const start = Date.now();
  let delay = 2000;

  while (Date.now() - start < maxWait) {
    await sleep(delay);
    delay = Math.min(delay * 1.4, 10_000); // backoff capped at 10s

    const res = await fetch(`${BASE_URL}/parse/${jobId}?expand=markdown,text`, {
      headers: {
        Authorization: `Bearer ${LLAMA_API_KEY}`,
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[LlamaParse v2] Status check returned ${res.status}, retrying…`);
      continue;
    }

    const data = await res.json();
    // v2 response: { job: { id, status, error_message }, markdown, text }
    const job = data.job || data;
    const status = job.status;
    console.log(`[LlamaParse v2] Job ${jobId} status: ${status}`);

    if (status === 'COMPLETED' || status === 'SUCCESS') {
      // Use the robust extractContent helper for all sources
      let markdown = '';
      let text = '';

      // Try top-level fields first
      markdown = extractContent(data.markdown_full || data.markdown, 'markdown');
      text = extractContent(data.text_full || data.text, 'text');

      // Try pages from the job object
      if (!markdown && job.pages && Array.isArray(job.pages)) {
        markdown = extractContent(job.pages, 'markdown');
      }
      if (!text && job.pages && Array.isArray(job.pages)) {
        text = extractContent(job.pages, 'text');
      }

      // Try pages from the top-level data
      if (!markdown && data.pages && Array.isArray(data.pages)) {
        markdown = extractContent(data.pages, 'markdown');
      }
      if (!text && data.pages && Array.isArray(data.pages)) {
        text = extractContent(data.pages, 'text');
      }

      console.log(`[LlamaParse v2] Extracted — markdown: ${markdown.length} chars, text: ${text.length} chars`);
      
      return { 
        markdown: markdown || text || '', 
        text: text || markdown || '', 
        jobId 
      };
    }

    if (status === 'FAILED' || status === 'CANCELLED' || status === 'ERROR') {
      const errorMsg = job.error_message || `Job ${status}`;
      throw new Error(`LlamaParse v2 job failed: ${errorMsg}`);
    }
    // PENDING or RUNNING — keep polling
  }

  throw new Error(`LlamaParse v2 job ${jobId} timed out after ${maxWait / 1000}s`);
}

/**
 * Main entry point: parse a document using LlamaParse v2.
 * Retries up to 3 times with exponential backoff between attempts.
 */
  export async function parseDocument(filePath: string, mimeType?: string): Promise<ParseResult> {
    if (!LLAMA_API_KEY) {
      throw new Error('LLAMA_CLOUD_API_KEY is not set in environment');
    }
  
    const maxAttempts = 3;
    let lastError: Error | null = null;
  
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[LlamaParse v2] Attempt ${attempt}: parsing ${path.basename(filePath)}`);
        const jobId = await uploadAndParse(filePath, mimeType);
        const result = await pollForResult(jobId);

      if (!result.markdown && !result.text) {
        throw new Error('LlamaParse returned empty content');
      }

      console.log(`[LlamaParse v2] ✓ Parsed ${path.basename(filePath)} (${result.markdown.length} chars)`);
      return result;

    } catch (err: any) {
      lastError = err;
      console.error(`[LlamaParse v2] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        const wait = 3000 * attempt;
        console.log(`[LlamaParse v2] Retrying in ${wait / 1000}s…`);
        await sleep(wait);
      }
    }
  }

  throw lastError || new Error('LlamaParse failed after all attempts');
}

/**
 * Utility: unwrap any JSON-wrapped content to plain text.
 * Use this to clean up already-stored parsed_markdown that may be raw JSON.
 */
export function unwrapParsedContent(content: string): string {
  if (!content) return '';
  return extractContent(content, 'markdown') || extractContent(content, 'text') || content;
}
