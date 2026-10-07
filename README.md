# Library7 v5 — Supabase

A static GitHub Pages-friendly library app backed by Supabase.

## 1. Create Supabase project

Create a project at https://supabase.com.

## 2. Create the database

Open **SQL Editor**, paste `supabase/schema.sql`, and run it.

The SQL creates:
- books
- people
- loans
- activity
- `library-media` storage bucket
- RLS policies
- one-active-loan-per-book constraint

The supplied policies use `authenticated`, so add Supabase Auth before deploying for a private library.

## 3. Get the browser-safe key

Use your Supabase **Project URL** and **Publishable key** (`sb_publishable_...`).

Do NOT put a secret/service-role key in this website. Supabase documents publishable keys for browser apps and secret keys for trusted servers.

## 4. Run the site

This is static and can be hosted on GitHub Pages. Open `index.html`, then use:

••• → Supabase setup

Enter the Project URL and Publishable key.

The configuration is stored in sessionStorage only; library data lives in Supabase.

## 5. GitHub Pages

Upload:
- index.html
- style.css
- app.js
- sounds/loan.mp3
- supabase/schema.sql

to your repository and enable GitHub Pages.

## Important

The site intentionally does NOT contain a secret Supabase key. Browser code must use a publishable key with Row Level Security. The SQL policies in this starter require authenticated users.

For a real shared library, add Supabase Auth and a login screen before allowing edits.
