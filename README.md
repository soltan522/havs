# havs.dev — architecture plans store

Next.js storefront for villa plans and exterior designs (AZ / EN / RU). Deployed on Vercel (`havs.dev`), database and private files on Supabase.

## Adding a real plan

1. **Metadata** — in `data/plans.json` add or edit a plan (slug, title, summary, area, floors, bedrooms, garage, price in cents, files).
   The slug is the folder name used below.
2. **Private files** — upload the sellable files to the Supabase bucket `plans-private` (Public OFF) with the keys from `files`:
   `<slug>/plan.pdf`, `<slug>/plan.dwg`, `<slug>/plan.cad`. Never commit these files.
3. **Preview images** — put the drawings/renders you want to show (watermarked) in `private-assets/<slug>/`
   (git-ignored), and optional unwatermarked concept visualisations in `renders/<slug>/` (committed). Then run:
   ```bash
   npm run previews
   ```
   This writes JPEGs to `public/plans/<slug>/` and updates `lib/previews.generated.ts`: renders first (the first one
   becomes the catalogue card), then the watermarked images — or, for plans without private originals, the generated
   concept sheets. Commit `public/plans/`, `renders/` and `lib/previews.generated.ts`.
4. Set `published: true` and `demo: false` on the plan and deploy.

Plans with `demo: true` are sample projects: they show a concept visualisation plus generated concept sheets
(site plan, floor plans, rendered south elevation with material schedule, isometric — see `scripts/drawings.mjs`)
and a "contact to order" button. Checkout refuses them, so a sample can never be sold without real files behind it.

The sample visualisations in `renders/` are AI-generated concept images (Figma AI) and are labelled as such on the site.
New sample villas are added by a daily routine — see [`docs/daily-villas.md`](docs/daily-villas.md). `npm run validate`
checks `data/plans.json` (styles, roofs, room counts against the generated plans, translations, price rule).

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
