import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, createUserClient } from '../src/lib/supabaseAdmin.js';
import { embedText } from '../src/lib/embeddings.js';

export const maxDuration = 60;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const userClient = createUserClient(token);

  const { query, embedding: providedEmbedding, topK, mode, fileId } = req.body;

  // ── Related Files Mode ─────────────────────────────────────────────────────
  // Given a fileId, find semantically similar files by using that file's  
  // AI description as a search query
  if (mode === 'related' && fileId) {
    try {
      // Fetch the source file's AI description
      const { data: sourceFile } = await userClient
        .from('files')
        .select('id, original_name, ai_description, parsed_markdown')
        .eq('id', fileId)
        .single();

      if (!sourceFile) return res.json({ results: [] });

      // Build a search query from the source file's content
      const searchText = sourceFile.ai_description
        || sourceFile.parsed_markdown?.substring(0, 1000)
        || sourceFile.original_name
        || '';

      if (!searchText.trim()) return res.json({ results: [] });

      // Embed the source file's description
      const embedResult = await embedText(searchText.substring(0, 2000));
      const sourceEmbedding = embedResult.values;

      // Vector search for similar files
      const { data: matches } = await userClient.rpc('match_embeddings', {
        query_embedding: sourceEmbedding,
        match_threshold: 0.3, // Higher threshold for related = more relevant
        match_count: 20,
        filter_owner_id: user.id,
      });

      // Deduplicate and exclude the source file
      const fileMap = new Map<string, any>();
      for (const r of (matches || [])) {
        if (r.file_id === fileId) continue; // Exclude source file
        const existing = fileMap.get(r.file_id);
        if (!existing || r.similarity > existing.similarity) {
          fileMap.set(r.file_id, r);
        }
      }

      const relatedFiles = Array.from(fileMap.values())
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK || 5)
        .map((r: any) => ({
          file_id: r.file_id,
          fileName: r.original_name || r.file_name,
          original_name: r.original_name || r.file_name,
          text: r.text,
          score: r.similarity,
        }));

      return res.json({ results: relatedFiles });
    } catch (error: any) {
      console.error('[Search API] Related files error:', error);
      return res.json({ results: [] });
    }
  }

  // ── Standard Search Mode ───────────────────────────────────────────────────
  if (!query && !providedEmbedding) return res.status(400).json({ error: 'query or embedding is required' });

  try {
    // Get embedding for the query
    let embedding = providedEmbedding;
    if (!embedding && query) {
      const embedResult = await embedText(query);
      embedding = embedResult.values;
    }

    // Vector similarity search using match_embeddings RPC
    const { data: results, error: searchError } = await userClient.rpc('match_embeddings', {
      query_embedding: embedding,
      match_threshold: 0.2,
      match_count: topK || 10,
      filter_owner_id: user.id
    });

    if (searchError) {
      console.error('[Search API] RPC error:', searchError);
      // Fallback: text + ai_description search
      const { data: fallbackResults } = await userClient
        .from('files')
        .select('id, name, original_name, parsed_markdown, ai_description')
        .not('parsed_markdown', 'is', null)
        .is('trashed_at', null)
        .limit(10);

      const queryLower = (query || '').toLowerCase();
      const scoredResults = (fallbackResults || []).map((f: any) => {
        const searchableText = [
          f.original_name || f.name || '',
          f.ai_description || '',
          f.parsed_markdown || ''
        ].join(' ').toLowerCase();

        const queryWords = queryLower.split(/\s+/).filter(Boolean);
        const matches = queryWords.filter(w => searchableText.includes(w)).length;
        const score = queryWords.length > 0 ? matches / queryWords.length : 0;

        return {
          file_id: f.id,
          fileName: f.original_name || f.name,
          original_name: f.original_name || f.name,
          text: f.ai_description || f.parsed_markdown?.substring(0, 500) || '',
          score
        };
      })
      .filter((r: any) => r.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, topK || 5);

      const finalResults = scoredResults.length > 0 ? scoredResults : (fallbackResults || []).map((f: any) => ({
        file_id: f.id,
        fileName: f.original_name || f.name,
        original_name: f.original_name || f.name,
        text: f.ai_description || f.parsed_markdown?.substring(0, 500) || '',
        score: 0.3
      })).slice(0, topK || 5);

      return res.json({ 
        results: finalResults, 
        context: finalResults.map((r: any) => `[Source: ${r.fileName}]\n${r.text}`).join('\n\n---\n\n'), 
        sourceFiles: finalResults 
      });
    }

    // Deduplicate by file_id
    const fileMap = new Map<string, any>();
    for (const r of (results || [])) {
      const existing = fileMap.get(r.file_id);
      if (!existing || r.similarity > existing.similarity) {
        fileMap.set(r.file_id, r);
      }
    }
    const deduped = Array.from(fileMap.values());

    const formattedResults = deduped.map((r: any) => ({
      file_id: r.file_id,
      fileName: r.original_name || r.file_name,
      original_name: r.original_name || r.file_name,
      text: r.text,
      score: r.similarity
    }));

    const context = formattedResults.map((r: any) => `[Source: ${r.fileName}]\n${r.text}`).join('\n\n---\n\n');
    const sourceFiles = formattedResults.map((r: any) => ({ id: r.file_id, name: r.fileName, score: r.score }));

    res.json({ results: formattedResults, context, sourceFiles });
  } catch (error: any) {
    console.error('[Search API] Error:', error);
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
}
