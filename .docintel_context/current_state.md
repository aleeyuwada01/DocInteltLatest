# DocIntel — Current State (As of V3.0)

This file documents the exact features that are currently built, wired up, and functional in the `main` branch.

## UI/UX & Navigation
- **Landing Page & Login:** Responsive auth flow with brand value propositions.
- **Sidebar:** Left navigation containing My Drive, Starred, Recent, Compare Docs, Trash, Settings, and Storage limits.
- **Topbar:** Global semantic search bar + Mobile hamburger toggle.
- **MainContent:** The primary file browser. Supports List and Grid views.
- **ChatPanel:** The persistent right-side panel for conversing with the AI about documents.
- **Dark Mode:** Fully supported and persists to `localStorage`.

## Document Management (The Drive)
- **Folders:** Create, traverse into, and delete folders recursively. 
- **Files Dropzone:** Support for global drag-and-drop uploads over the main content area.
- **Multi/Folder Upload:** Uses `<input webkitdirectory>` and bulk files, managed by a resilient `TUS` uploading queue that handles network reconnects.
- **File Options:** Context menu supports Download, Move to Folder, Rename, Star, and Move to Trash.
- **Pagination:** Infinite scrolling/Load More button handles datasets scaling to hundreds/thousands of files efficiently by querying Supabase in chunks.
- **Recent Files:** The `last_opened_at` timestamp updates silently on file preview. Sidebar pulls chronological history.

## AI Intelligence Features
- **Semantic Search:** Located in the Topbar. Debounced inputs search the `embeddings` table for vector matches and returns AI-generated snippets with confidence scores (green gradient percentage). 
- **DocIntel Chat (With Memory & Tracking):** 
  - **History Persistence:** Every conversation is securely logged in Supabase (`chat_sessions` and `chat_messages` tables), tied to the `user_id`. When users refresh the page, their exact message history, including AI answers and cited sources, is re-hydrated.
  - **System Prompt Intelligence:** Tolerant to user typos (e.g., misspellings of document names). Understands user intent and corrects queries seamlessly.
  - **Prompt Suggestions:** Proactively generates highly professional, context-aware prompt recommendations (rendered as click-to-ask cards with icons) at the end of responses.
  - **Confidence Scores:** Visual badges attached to returned reference files, directly indicating how strongly a document matches the user's query mathematically.
- **Related Files:** Viewing a document in `ParsedContentModal` queries the API for documents with mathematically similar vectors based on their `ai_description`.
- **Compare Documents:** Modal that allows a user to pick Document A and Document B. A Vercel API calls Gemini to generate a fast diff covering Similarities, Differences, and Key Insights.
- **Drive Summarization:** Topbar button that queries an API to generate a holistic snapshot of all data currently living in the user's root drive.

## Settings & Administration
- **Storage Quota:** Tracked visually on the sidebar (e.g., `2.5 MB / 1 GB`).
- **Departments (Multi-user):** `SettingsModal.tsx` contains an admin-only tab to generate Sub-Accounts. These accounts share nothing with the parent right now (isolation is enforced by RLS), but are tracked via `parent_id`.

## Known Issues / Technical Debt
- User Passwords in the Settings tab are not currently hashed if altered directly via local state (though Supabase Auth handles actual authentication securely).
- The Local proxy server (`server.ts`) handles Vercel API routing but can occasionally lag during heavy chunked uploads; Production Vercel environments handle it smoother natively.
