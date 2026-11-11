# CLAUDE.md – מערכת לידים מצפה כנרת

CRM web app for the "מצפה כנרת" project (marketing & management: שפר נדל"ן). The owner is not technical.

## How to work with the owner
- **Always talk to the owner in Hebrew** (questions, summaries, status). Code and comments can be English.
- Keep it short; the owner has little patience for long explanations. Decide like a pro, ask only real decisions.
- Core product principle: **as few taps/clicks as possible to reach any goal.** Mobile-first (the owner uses the phone a lot) but must be excellent on desktop too.
- Look & feel: RTL, brand colours (gold + teal + dark navy), logos on dark backgrounds (they are invisible on white). Heat colours are fixed by the owner: "מאוד רציני" green, "לא רלוונטי" red, "בעל פוטנציאל לעסקאות אחרות" blue, "חתם" gold, others white.
- Phone/WhatsApp copy buttons copy **digits only** (no dashes). WhatsApp button appears only when the lead has a WhatsApp number. No disabled/greyed buttons: if a value is missing, no button.
- Never put personal data (leads, phone numbers, the Excel) in git. Never commit `.env*`, backups, or the owner's login.

## Architecture
- Single-page app, no framework: `src/app.template.html` (HTML + CSS + JS in one file). `npm run build` → `dist/` (inlines logos + config, adds `sw.js`, manifest, icons, `vendor/supabase.js`).
- Hosting: GitHub Pages serving the `gh-pages` branch (built site only). Publish with `npm run deploy` (builds and force-pushes `dist/` to `gh-pages`; takes ~1 min to appear). A GitHub Actions workflow (auto-deploy on push) is prepared but not enabled, because the stored GitHub token lacks the `workflow` scope.
- Backend: Supabase project `kineret-leads` (`herokvahhjgasqosjwuu`, eu-central-1). One table `public.docs` (kind `lead|task|settings`, JSON `data`, `rev`, `seq`, `deleted`). RLS: only e-mails in `public.allowed_users`. Schema in `supabase/migrations/0001_init_docs.sql`.
- Login: the owner types a username (digits); the app signs in as `<digits>@example.com`. Sign-ups must stay disabled in the dashboard. The password is **never** stored in the repo.
- **Offline-first**: the app works on a local copy (`localStorage`, keys `crm-kineret-v2`, `crm-kineret-sync-v1`). Service worker caches the app shell. Sync engine (search `ONLINE: login + offline-first sync` in the template): pull by `seq`, push with optimistic concurrency (`rev`), field-level three-way merge, history/labels merged automatically, real clashes → conflict sheet asking the owner. Undo/redo history is local per device and not synced.
- The public Supabase publishable key in `src/config.json` is meant to be public (protected by RLS).

## Data model (lead)
`id, name, source ('פנו אלינו'|'בעלי יכולת'), via, phone, phone2, wa, email, city, address, community, age, heat, stage, status, about, labels[], history[], created, updated`. Task: `id, leadId, title, date, done`. Settings: heats (name+colour), stages, labels, vias, waTemplate.

## Commands
- `npm ci && npm run build` – build; `npm run serve` – preview `dist/` on http://localhost:5177
- `npm run backup` – daily local backup (needs `.env.local`, see `.env.local.example`); `npm run restore -- <file>`
- Backups go to `../backups` (outside the repo, never committed). Windows scheduled task "Kineret leads daily backup" runs it nightly.

## Notes for cloud sessions (computer may be off)
- You can edit `src/`, push to `main`, then run `npm run deploy` to publish (the site does NOT redeploy by itself yet).
- You cannot reach the owner's local files (Excel, backups, `.env.local`). Database schema changes need a new file in `supabase/migrations/` plus applying it on Supabase (tell the owner if you cannot).
- Test sync logic with an in-memory mock of the `REMOTE` adapter (see how `makeRemote()` is shaped) – never log in with the owner's credentials.
