# AST 1 Trainer

An interactive AST 1 practice-exam web app (273 questions). Built with Vite + React, with optional Supabase sign-in so each person's run history syncs across their devices.

- **Not signed in →** runs save on that device only (browser localStorage).
- **Signed in (magic link) →** runs sync to your account across devices.
- The **guest / record** toggle still works: guest runs are never saved; recorded runs go to your account (or the device if you're not signed in).

> This is an original study tool for the AST 1 curriculum, not official Avalanche Canada exam content. The 80% line is a self-study benchmark, not an official pass mark (AST 1 has no formal written exam).

---

## What you need (all free tiers)

1. A **Supabase** account — the database + sign-in.
2. A **GitHub** account — where the code lives.
3. A **Vercel** account — builds the code and gives you the live link.

Do the steps in this order. There's one bit of ordering to respect: Vercel gives you a URL, and Supabase needs that URL for sign-in to work — so we deploy first, then point Supabase at it.

---

## Step 1 — Supabase project

1. supabase.com → **New project**. Pick a name and a database password (save it somewhere; you won't need it for this app, but Supabase wants one).
2. When it's ready, open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and click **Run**. This creates the `runs` table with row-level security so each user only sees their own data.
3. Open **Project Settings → API** and copy two values:
   - **Project URL** → this is your `VITE_SUPABASE_URL`
   - **anon public** key → this is your `VITE_SUPABASE_ANON_KEY`
   (The anon key is safe to expose in a browser; row-level security is what protects the data.)

## Step 2 — GitHub repo

1. github.com → **New repository** → name it e.g. `ast1-trainer` → **Create**.
2. On the new repo page, click **uploading an existing file**.
3. Unzip the project, then drag the **contents** of the folder (the `src` folder, `index.html`, `package.json`, `vite.config.js`, `supabase` folder, `.gitignore`, etc.) into the upload area. Do **not** include `node_modules` or `dist`.
4. **Commit changes.**

## Step 3 — Vercel deploy

1. vercel.com → **Add New… → Project** → import your `ast1-trainer` repo. Vercel auto-detects Vite; leave the build settings as-is.
2. Before deploying, open **Environment Variables** and add the two from Step 1:
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon public key
3. Click **Deploy**. After a minute you'll get a live URL like `https://ast1-trainer-xxxx.vercel.app`. Copy it.

## Step 4 — Point Supabase auth at your site

1. In Supabase: **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel URL.
3. Under **Redirect URLs**, add the same Vercel URL (and `http://localhost:5173` if you also want local sign-in). Save.

That's it. Open the Vercel URL, click **Sign in to sync**, enter your email, and click the magic link it sends. Your runs now follow you across devices.

> If you change env vars later, redeploy from Vercel's **Deployments** tab (⋯ → Redeploy) so the new values take effect.

---

## Run it locally (optional)

```bash
npm install
cp .env.example .env.local   # then paste your two Supabase values into .env.local
npm run dev                  # opens http://localhost:5173
```

Without a `.env.local`, the app still runs — just in local-only mode (no sign-in, history saved per-device).

## Updating questions

The question bank lives in `src/questions.js` as `export const BANK`. Edit there (or regenerate it from the master spreadsheet) and redeploy. The app reads difficulty (`easy`/`moderate`/`hard`), topic, and question type from that file.
