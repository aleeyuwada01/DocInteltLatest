# DocIntel — Feature Roadmap (Pending Tasks)

This document outlines features that are planned but NOT YET BUGILT. Future AI agents should consult this file when asked "what should we build next?".

## Tier 1 — Teams & Collaboration (Next Priorities)
*Currently, Departments exist as isolated Sub-Accounts. They need file-sharing capabilities.*

1. **🔗 File Sharing (Link & User-to-User)**
   - Need to implement `shared_files` join table in Supabase.
   - Requires API adjustments to RLS policies (`auth.uid() = owner_id OR auth.uid() IN (shared_with)`).

2. **📊 Activity Feed / Audit Log**
   - Teams need to see "Who did what". 
   - Implementation: Trigger events on upload/share/delete and log to a generic `activity_log` table. Display on a timeline view.

3. **🔐 Google / GitHub OAuth**
   - Supabase Auth supports this natively. Needs UI buttons and Supabase Dashboard configuration.

## Tier 2 — File Polish & Organization
1. **🏷️ Tags / Labels System**
   - Color-coded tags across files (e.g., "Invoice", "Meeting").
   - Would require an autocomplete multi-select dropdown and a `tags` -> `file_tags` schema.

2. **✂️ PDF Page Splitting / Merging**
   - Allow users to extract pages from large compiled PDFs before sending to the AI parser, saving on LlamaParse credits.

## Tier 3 — Growth & Platform
1. **📧 Email-to-Upload**
   - Give users a unique address (e.g., `inbox_user_id@docintel.app`). 
   - Parse inbound webhooks from SendGrid or Mailgun, extract attachments, and fire them into the existing file-ingestion pipeline.

2. **📈 Web Dashboard**
   - Visualize intelligence: Pie charts of storage usage by file type, line charts of search query volume, and a tag cloud of the most common concepts in the knowledge base.

3. **📱 Progressive Web App (PWA)**
   - Add `vite-plugin-pwa` so users can Install to Home Screen on mobile/desktop without wrapping natively.
