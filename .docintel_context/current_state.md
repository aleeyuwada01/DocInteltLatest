# DocIntel — Current State (As of V3.0)

This file documents the exact features that are currently built, wired up, and functional in the `main` branch.

## UI/UX & Navigation
- **Main Drive:** Formerly "DocIntel Workspace". Redesigned for a cleaner, high-fidelity experience.
- **Folders:** Formerly "Directory Segments". Supports recursive traversal.
- **Simpler Terminology:** Moved away from technical jargon (e.g., "Establish Link" -> "Share Link", "Rename Alias" -> "Rename File").
- **Global Drag-and-Drop:** Robust window-level implementation that prevents flickering and triggers an overlay from anywhere in the app.
- **Refined List View:** New headers for "Name", "Status", "Last modified", and "Size".

## Document Management (The Drive)
- **File Management:** Right-click context menu supports Rename, Move to Folder, Star File, and Move to Trash.
- **Status Clarity:** Removed the redundant "Ready" badges for a cleaner interface focused on content.

## AI Intelligence Features
- **Doc Chat (Contextual Deep Dive):** Dedicated chat mode with continuous conversation memory focusing on the full content of specific document fragments.
- **Improved Semantic Search:** Global search now uses high-dimensional embeddings. It is fully "trash-aware," automatically filtering out deleted items from vector search results.
- **Side-by-Side Comparison:** AI-driven document evaluation that highlights differences between complex datasets or contracts.
- **Drive Summarizer:** Generates an executive snapshot for the user's root knowledge base.
- **Public Share Links:** Secure document sharing for unauthenticated viewers via a backend proxy that generates temporary server-side storage credentials.

## Settings & Administration
- **Department Sub-Accounts:** Admin capability to generate sub-accounts with enforced data isolation via RDS.

## Known Issues / Technical Debt
- **PWA Removal:** The `vite-plugin-pwa` was removed due to service worker caching issues (stale builds). This improved development stability significantly.
- **Vercel Hobby Limit:** Consolidates public share logic into `api/search.ts` to stay within the 12-function limit.
- **Settings State:** Local state for passwords in the Settings tab is for UI placeholder purposes; Supabase handles the actual secure auth.
