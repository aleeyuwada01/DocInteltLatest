# DocIntel — Technical Brief & Whitepaper

**Title:** DocIntel: AI-Powered Document Intelligence Workspace  
**Status:** V1.0 (Production Ready)  
**Authors:** Abdulrahim Ibrahim & Aliyu Wada  

---

## 1. Executive Summary
DocIntel is a modern, AI-first document management platform designed to transform static files into interactive knowledge bases. Unlike traditional cloud drives, DocIntel leverages Retrieval-Augmented Generation (RAG) and high-fidelity parsing to allow users to "chat" with their documents, extract complex data from tables/charts, and manage knowledge through a sleek, professional interface.

## 2. Core Technology Stack

### 2.1. Frontend Evolution
- **Core:** React 19 (Vite) + TypeScript.
- **Styling:** Tailwind CSS 4.0 for utility-first design and consistent tokens.
- **Animations:** Framer Motion for premium micro-interactions and smooth transitions.
- **State Management:** React Context + Native Hooks for high-performance UI updates.
- **PWA:** Integrated Service Workers (via `vite-plugin-pwa`) for offline-ready deployment.

### 2.2. Backend & Data Layer
- **Database:** Supabase (PostgreSQL 17).
- **Security:** Strict Row Level Security (RLS) policies ensuring 100% data isolation between users.
- **Real-time:** Supabase Realtime for instant synchronization of file statuses.
- **Auth:** Supabase Auth (JWT-based) for secure session management and persistence.

### 2.3. AI & Intelligence Engine
- **LLM:** Google Gemini 1.5 Pro (via `@google/genai`).
- **Parsing:** LlamaParse (High-Fidelity) for structural extraction of PDFs, Excel, and Word docs.
- **Embeddings:** `text-embedding-004` (Google) for high-dimensional semantic mapping.
- **Vector Database:** `pgvector` on Postgres for sub-millisecond similarity searches.

## 4. System Architecture

### 4.1. Ingestion Pipeline (The "Brain" Flow)
1. **Upload:** Files are uploaded via an Express-based resumable proxy (`tus-js-client`) to private Supabase Storage.
2. **Structural Parsing:** A webhook triggers LlamaParse to convert complex documents (including tables) into clean Markdown.
3. **Semantic Fragmenting:** The markdown is split into optimized chunks and converted into 768-dimension vectors.
4. **Vector Storage:** Chunks and embeddings are stored in the `embeddings` table for future retrieval.

### 4.2. RAG & Chat Workflow
- **Hybrid Retrieval:** Queries are matched using both semantic similarity (vectors) and keyword matching (TF-IDF).
- **Context Pinning:** Users can "pin" a specific document to restrict the AI's focus, significantly reducing "hallucinations" and increasing accuracy.
- **Chained Memory:** Conversation history is maintained to allow for complex follow-up questions.

## 5. Security & Shareability

### 4.1. Access Controls
DocIntel implements a **Zero-Leak Policy**:
- **Owner-Only Access:** Files are stored in private buckets and are inaccessible via public URLs by default.
- **Signed URL Sharing:** Public sharing utilizes a secure bridge. A unique, cryptographic token is used to generate a temporary "Signed URL" (2-hour life), allowing public viewers to see a file without exposing the underlying storage bucket.
- **Database RPCs:** Secure `SECURITY DEFINER` functions handle public metadata retrieval without exposing full table access.

## 6. Unique Technical Value Propositions (TVP)

- **High-Fidelity Tabular Extraction:** Handles complex Excel and PDF tables that generic OCR fails on.
- **Global Drag-and-Drop:** A custom window-level state listener that eliminates UI flicker.
- **Signed URL Isolation:** Secure public sharing via cryptographic temporary windows.
- **Semantic Workspace:** Automatically links related documents via conceptual overlap.

---

### Appendix: Technical Stack (Specifications)
<details>
<summary>View Core Infrastructure</summary>

- **Frontend:** React 19 (Vite) + TypeScript + Framer Motion.
- **Backend:** Supabase (PostgreSQL 17) + RLS security.
- **AI:** Google Gemini 2.5 Pro + text-embedding-004.
- **Parsing:** LlamaParse Structural Extraction.
</details>

*Note: For the full interactive experience, see the high-fidelity web edition in `/whitepaper/index.html`.*

---

*© 2026 DocIntel. Confidential - Technical Stakeholders Only.*
