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
- **Doc Chat (Contextual Deep Dive):** Users can click "Ask DocIntel AI" on any file to enter a dedicated chat mode. This bypasses global search and feeds the document's full parsed content directly to the AI.
- **Multi-turn Conversational Memory:** The chat engine now supports continuous chaining. Users can ask follow-up questions (e.g., "Filter that table for amounts over $500") and the AI maintains full context across the entire session.
- **Tabular Data Extractions:** Optimized AI instructions for spreadsheet/CSV files to automatically generate clean Markdown tables for records like debtors or financial summaries.
- **Citation Ranking:** Visual badges attached to reference files indicate mathematical match strength.
- **Compare Documents:** Side-by-side side evaluation of two documents via Gemini Pro.
- **Main Drive Summarizer:** Snapshot generation for the entire root drive.

## Settings & Administration
- **Department Sub-Accounts:** Admin capability to generate sub-accounts with enforced data isolation via RDS.

## Known Issues / Technical Debt
- User Passwords in the Settings tab are not currently hashed if altered directly via local state (though Supabase Auth handles actual authentication securely).
- The Local proxy server (`server.ts`) handles Vercel API routing but can occasionally lag during heavy chunked uploads; Production Vercel environments handle it smoother natively.
