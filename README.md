# Avalanche Training — combined web app

Two tools behind one link, chosen from a landing page:

- **AST 1 Practice** — 273-question written-exam trainer.
- **Slope-Angle Trainer** — train your eye on the 30-degree avalanche threshold.

Built with Vite + React. Optional passwordless (magic-link) sign-in via Supabase
syncs each person's history across their devices. Without signing in, the app still
works fully in **local mode** (history saved on that device only). Each tool has a
**"Back to all tools"** control to return to the landing page after a run.

> Original study tools for the AST 1 curriculum — not official Avalanche Canada exam content.

---

## File layout (flat — everything at repo root)

index.html, Root.jsx, App.jsx, SlopeApp.jsx, main.jsx, questions.js, storage.js,
supabaseClient.js, vite.config.js, package.json, schema.sql, README.md

- main.jsx -> mounts Root (inside an error boundary).
- Root.jsx -> sign-in bar + landing page; routes to a tool and back.
- App.jsx -> the AST 1 trainer (Ast1App).
- SlopeApp.jsx -> the slope trainer (SlopeApp).
- storage.js -> history persistence: Supabase when signed in, else localStorage.
- questions.js -> the 273-question bank.

---

## First-time setup

### 1. Supabase
1. supabase.com -> New project.
2. SQL Editor -> New query -> paste all of schema.sql -> Run. Creates two tables:
   runs (AST 1) and docs (slope history), each protected by row-level security.
   Safe to re-run.
3. Project Settings -> API -> copy the Project URL and the anon public key.

### 2. GitHub
Create a repo and upload the project files (see "Deploying updates" for steps).

### 3. Vercel
1. Import the repo (Vite is auto-detected).
2. Environment Variables -> add:
   - VITE_SUPABASE_URL = your Project URL
   - VITE_SUPABASE_ANON_KEY = your anon public key
3. Deploy, then copy the live URL.

### 4. Point Supabase auth at the site
Supabase -> Authentication -> URL Configuration -> set Site URL and add a Redirect
URL = your Vercel URL. (Add http://localhost:5173 too for local dev.)

---

## Deploying updates (from an existing deployment)

1. Database: run schema.sql again in the Supabase SQL Editor (adds the new docs
   table used by the slope trainer; safe to re-run).
2. Code: upload the project files to GitHub, overwriting the old ones
   (Add file -> Upload files -> drag files in -> Commit). A computer is much
   easier than a phone for this.
3. Vercel redeploys automatically on commit. Confirm the two env vars are still set.

---

## Using it (for browser users)

Share the Vercel link. No install; works on phone or desktop.

- The landing page offers the two tools; tap one to start.
- Sign in (optional): enter your email in the top bar -> click the magic link that
  arrives -> history syncs across devices. Without signing in, everything still
  works; history is saved on that one device/browser ("Local mode").
- Guest toggle (in each tool's setup): let someone else practice without affecting
  your recorded history. Resets to "recording" next time.
- Back to all tools: after a run (or from a tool's setup), return to the landing
  page and switch tools.

---

## Local development

  npm install
  cp .env.example .env.local   # paste your two Supabase values
  npm run dev                  # http://localhost:5173

Without .env.local it runs in local-only mode.
