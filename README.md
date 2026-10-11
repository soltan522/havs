# havs.dev — architecture plans store

Next.js storefront for villa plans and exterior designs (AZ / EN / RU). Deployed on Vercel (`havs.dev`), database and private files on Supabase.

## Adding a real plan

1. **Metadata** — in `lib/plans.ts` add or edit a plan (slug, title, summary, area, floors, bedrooms, garage, price in cents, files).
   The slug is the folder name used below.
2. **Private files** — upload the sellable files to the Supabase bucket `plans-private` (Public OFF) with the keys from `files`:
   `<slug>/plan.pdf`, `<slug>/plan.dwg`, `<slug>/plan.cad`. Never commit these files.
3. **Preview images** — put the original renders in `private-assets/<slug>/` (this folder is git-ignored), then run:
   ```bash
   npm run previews
   ```
   This writes watermarked JPEGs to `public/plans/<slug>/` and updates `lib/previews.generated.ts`. Plans without originals get a neutral placeholder.
   Commit `public/plans/` and `lib/previews.generated.ts`.
4. Set `published: true` on the plan and deploy.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values, never commit it
npm run dev
```

## Environment

See `.env.example`. Required for orders and downloads: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PLANS_BUCKET`. Payment providers are enabled only when their keys are present. Optional: `CONTACT_EMAIL` (shown on the contact page), `ADMIN_TOKEN` (bank-transfer confirmation).

## Database

Run `supabase/schema.sql` once in the Supabase SQL editor (creates `orders`, enables RLS, grants the server role access).
