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
4. Set `published: true` (and `demo: false` for a non-concept plan) and deploy.

Plans with `demo: true` are concept projects: they show a concept visualisation plus generated concept sheets
(site plan, floor plans, rendered south elevation with material schedule, isometric — see `scripts/drawings.mjs`)
and are labelled "Concept project". Any plan is sold only when its files are in the private bucket: the checkout page
shows the payment form, and `/api/checkout` accepts an order, only after checking that every file exists.

**Payments** — Lemon Squeezy (cards, Apple Pay, Google Pay, PayPal), NOWPayments (crypto), bank transfer, and Stripe /
PayPal for a business in a country they support. Each method switches on when its keys are set; see
[`docs/payments.md`](docs/payments.md).

**Drawing packages.** `node scripts/package/build-packages.mjs` writes each plan's package to `deliverables/<slug>/`
(git-ignored): a vector A3 PDF drawing set, a layered DXF with A3 paper-space layouts (python3 + `ezdxf`) and a DWG
(AutoCAD 2000, converted with LibreDWG `dxf2dwg` when installed; every DWG is read back before it is kept), and records
file sizes in `data/packages.json`. `scripts/package/upload-packages.mjs` puts them in the private bucket — in CI this
needs the repository secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the **Rebuild drawing packages** workflow
rebuilds and uploads all of them on demand. Plan pages show the files with locked download buttons; buyers download
them from their order page after payment.

The sample visualisations in `renders/` are AI-generated concept images (Figma AI) and are labelled as such on the site.
New sample villas are added by a daily routine — see [`docs/daily-villas.md`](docs/daily-villas.md), which also
describes the commercial buildings the generator draws (business centres, hotels, restaurants, wedding halls and
apartment buildings, each from a plan `layout` and a `facade` option). `npm run validate`
checks `data/plans.json` (styles, roofs, room counts against the generated plans, translations, price rule).

**Projects map** — `/<lang>/map` shows the catalogue on a 3D map (MapLibre GL; OpenFreeMap vector tiles with
OpenStreetMap buildings, AWS open terrain tiles; no API keys). Each plan sits at its `location` in `data/plans.json`, or
at the place its slug is named after in `data/places.json` (`null` keeps a name off the map). The style is in
`lib/map-style.ts`, the page in `app/[lang]/map/` and `components/ProjectsMap.tsx`. A plan's `model` (glTF in
`public/models/`) replaces its plain map block. Whole districts (Sea Breeze, Ağ Şəhər) are drawn as 3D models built from
`data/districts/<id>.json` — Overture Maps footprints with floor counts, `"estimated": true` where the data had none —
by `node scripts/build-district-models.mjs <id>`; correct a building's `floors` there and rebuild.
`data/districts/complexes.json` overrides a whole residential complex with a sourced floor count, its construction
status (shown on the building's card) and facade details; Sea Breeze is drawn in its resort style (white walls,
panoramic glazing, balconies with glass railings, glass towers, the Caspian Dream Liner's stepped decks), Ağ Şəhər in its
Parisian one (stone fronts with French windows over shopfronts, a cornice and a zinc mansard storey; stone towers with
a stepped crown). The models are
meshopt-compressed, so the map's GLTFLoader carries the meshopt decoder.
Baku's buildings are drawn in 3D from static vector tiles (`public/tiles/buildings/14/<x>/<y>.pbf`, built from
`data/city/<area>.geojson.gz` by `node scripts/city/build-tiles.mjs`; the areas come from Overture Maps through
`scripts/city/build_city.py`, which needs Python with pyarrow, shapely and Pillow). `components/cityBuildings.ts`
extrudes each tile's buildings in the browser by floor count and facade type; tapping one opens its card.
Landmarks are drawn as their own detailed models: `data/landmarks.json` lists each one (the city blocks it
`replaces`, its form, height and a source for the figures) and `node scripts/build-landmarks.mjs [id ...]` builds
`public/models/landmark-<id>.glb` on the real footprint, with `data/landmarks.generated.json` for the map. The forms
are drawn from the buildings' known shapes (Flame Towers, Heydar Aliyev Center, SOCAR Tower, Maiden Tower, Carpet
Museum, Deniz Mall, Crystal Hall, TV Tower, Government House, Port Baku Towers, Aquatics Centre, Philharmonic Hall,
City Hall, Ismailiyya Palace, Heydar Aliyev Palace, mosques with their domes and minarets, the Palace of the
Shirvanshahs, caravanserais and bathhouses, hotels, theatres and palaces, the Olympic Stadium, the National Flag);
heights the sources do not give are marked approximate there. A landmark outside the city layer's areas takes its
footprint from `data/landmarks.extra.geojson`, fetched from Overture by `python3 scripts/city/fetch_footprints.py
<key>:<lng>,<lat>`. Houses and small villas (up to three floors and 450 m²) in the city layer get a hipped
sheet-metal roof where their plan allows one.

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
