# Daily villas — runbook

Every day ten new **sample villas** are added to the havs.dev catalogue: a photoreal concept render plus the
generated concept sheets (site plan, floor plans, south elevation, isometric). This file is the procedure the
scheduled routine follows; a person can follow it too.

Samples are `demo: true`: they are labelled "Concept project" and sold as concept packages; the checkout only takes
payment once the villa's files are in the private bucket (see `docs/payments.md`).
Never present them as built houses or real client work.

## How the pipeline works

1. You add ten entries to `data/plans.json` and list their render URLs in `renders/manifest.json`,
   then push a branch `auto/villas-YYYYMMDD` (today's date, UTC).
2. The GitHub Action **Publish new villas** (`.github/workflows/publish-villas.yml`) downloads the renders,
   runs `npm run previews -- --missing` and `npm run validate -- --require-renders`, builds each new villa's
   drawing package — vector A3 PDF set (cover, site plan, floor plans, elevation, isometric, schedules),
   layered DXF with A3 layouts, and DWG (AutoCAD 2000, via LibreDWG) — uploads it to the private Supabase bucket
   when the `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` secrets exist (also kept as a 30-day workflow artifact),
   typechecks and builds the site, then pushes the result to `main` and deletes the branch. Vercel deploys `main`
   to havs.dev; the plan page lists the package files with locked "after payment" download buttons.

The render must go through the Action because the coding sandbox cannot reach figma.com, but GitHub can.
Do not push to `main` yourself.

## Steps

```bash
git fetch origin main && git checkout -B auto/villas-$(date -u +%Y%m%d) FETCH_HEAD
npm ci
```

1. **Choose ten concepts.** Read `docs/design-references.md` — the design families taken from the reference
   developments (Bilgah, Sea Breeze, Mərdəkan, Istanbul) and the rotation rules — and `data/plans.json` (newest
   entries are at the end). Each villa takes one family (`"inspiration"`) and stores its render prompt (`"prompt"`).
   Pick a mix of ten:
   - at least three pitched-roof villas (`tuscan`, `mediterranean`, `farmhouse`, `yali` or `chalet`),
   - at least four flat-roof contemporary villas (`modern`, `minimal`, `coastal`, `luxury`, `pavilion`, `absheron`
     or `noir`),
   - the rest any style, including `duplex`;
   - at least four single-storey or three-level villas, so the catalogue does not fill up with two-storey houses;
   - at most two villas of one style and at most two of one design family in the same day.
   Before writing, list the free design keys (style + floors + bedrooms + garage + pool not used yet) and pick from
   them; `npm run validate` prints the exact bedroom and bathroom counts the generator produces.
   **Nothing may repeat an existing design** — `npm run validate` enforces it and fails on:
   a place name, title or summary already used; the same combination of style + floors + bedrooms + garage + pool
   as an existing villa (mirroring does not count as different); the same style and floors with an area less than
   25 m² apart; a render prompt that is 75 % the same as another; an unknown `inspiration`; and (in the Action) a
   render that looks like a copy of an existing one. It warns when
   more than two villas share one floor-plan layout — then change bedrooms, garage, pool or set `"mirror": true`
   (the mirrored variant flips the plan left-to-right, with the living rooms next to the garage).
   Read the titles and summaries of the last ten villas and write something different: other materials, other
   setting, other outdoor features. Allowed values per style are in `STYLE_RULES` in `scripts/drawings.mjs`
   (roofs, floors); area per floor must be 80–320 m².
   Optional `ratio` (footprint width / depth, 1.0–2.2) varies the massing between villas of the same style, and
   optional `tree` (`olive`, `cypress`, `palm`, `pine`, `round`) sets the planting drawn on the elevation and site
   plan — match it to the setting you describe in the render prompt.

2. **Name them.** Use Azerbaijani places and landscapes (Nabran, Quba, Qəbələ, Şəki, Lənkəran, Mərdəkan,
   Göygöl, Xınalıq, Zaqatala, Şuşa, Qusar, Astara, Buzovna, Novxanı, İsmayıllı, Laza, Talış, Pirqulu…), not yet used
   in the catalogue. Title e.g. "Nabran Villa" / "Nabran Villa" / "Вилла Набран". Slug: ascii, lowercase,
   followed by the next catalogue number, e.g. `nabran-11`, `quba-12`, `mardakan-13`.

3. **Write the entries** in `data/plans.json` (append at the end), same shape as the existing ones:
   `slug, style, roof, title{az,en,ru}, summary{az,en,ru}, areaM2, floors, bedrooms, bathrooms, garage, pool,
   priceCents, published: true, demo: true` (+ optional `ratio`, `tree`).
   - Summary: two sentences, professional and factual — materials, roof, key spaces, outdoor features.
     Correct Azerbaijani (ə, ı, ö, ü, ğ, ş, ç) and Russian. No superlatives, no claims that it was built.
   - Price: `npm run validate` prints a warning if the price is more than 15 % from the rule
     (`suggestedPrice` in `scripts/validate-plans.mjs`: ≈ $300 + $4.2/m², rounded to …90, +$100 for
     tuscan/coastal/luxury/mediterranean/absheron/noir/yali). Use the rule's value.
   - Bedrooms and bathrooms must match the generated plans: run `npm run validate` — it tells you the
     exact numbers to use if they differ.

4. **Generate the renders** with the Figma `generate_image` tool:
   `planKey: "team::1669481086072167198"`, `model: "gpt-image-2.5-sunburst"`, `width: 1536`, `height: 1024`.
   Prompt template (fill in from the entry; keep everything the drawings show consistent):

   > Professional architectural visualization, photorealistic exterior render of a luxury {one-storey /
   > two-storey} {style} villa, {wall materials}, {roof description}, {window/glazing description},
   > {"attached single garage on the right" | "attached double garage on the right" | "no garage"},
   > {"rectangular swimming pool with {stone} deck in front of the house" | "no pool, landscaped garden in front"},
   > {planting and setting}, {light: golden hour / soft morning / blue hour}, eye-level three-quarter view,
   > 24mm architectural lens, Corona render quality, crisp realistic materials, no people, no text, no watermark

   Garages over 370 m² gross area are double, otherwise single. Materials per style (match the elevation):
   modern — white render, travertine fin, bronze frames, glass balustrade terrace; tuscan — honey limestone,
   terracotta hip roof, arched loggia, green shutters; minimal — white render cube, recessed glazing, roof terrace;
   coastal — white render, teak louvres, thin deep roof slabs, glass balustrades; chalet — grey stone ground floor,
   dark timber above, steep standing-seam gable facing the viewer, glazed gable; farmhouse — rough stone, terracotta
   gable roof, oak pergola with vines; luxury — dark grey stone base, white upper volume, flat slab roof;
   pavilion — single storey, deep flat canopy on slender steel columns, full-height glass; mediterranean — white
   stucco, terracotta hip roof, arched windows, wrought-iron balconies; duplex — two mirrored attached villas,
   white render, bronze frames, timber around the two entrances; absheron — sawn Absheron limestone walls,
   white render upper volume, bronze frames, timber soffits under deep flat slabs, frameless glass balustrades;
   noir — charcoal render, bronze vertical fins, dark flat slabs, warm interior light; yali — painted timber
   weatherboarding, tall timber sash windows in rhythm, slate hip roof with deep eaves, waterfront quay.
   Start from the prompt cues of the chosen family in `docs/design-references.md` and store the final prompt in
   the entry's `"prompt"` field.

   **Check the thumbnail** before accepting it: the right number of storeys, the right roof, garage present/absent
   as specified, pool present/absent, no text or watermark, no warped or impossible geometry. Regenerate (up to
   three attempts per villa) if any of these fail; if it still fails, choose a different concept.

   **Figma AI credits** (Starter plan: 500 per month, at most 150 per day) are the limit of this job. Generate the
   renders one by one and stop at the first refusal for credits or rate limit: remove the villas that have no render
   from `data/plans.json`, publish the ones that do, and say in the report how many were skipped and why.

5. **Write `renders/manifest.json`** with only today's villas (replace the previous content):
   ```json
   { "nabran-11": ["https://www.figma.com/api/mcp/asset/…png"], "quba-12": ["…"], "mardakan-13": ["…"] }
   ```
   Figma asset URLs expire after 7 days — push the same day.

6. **Check, commit, push:**
   ```bash
   npm run validate            # warnings about missing renders are expected at this point
   npm run typecheck
   git add data/plans.json renders/manifest.json
   git commit -m "Add sample villas: nabran-11, quba-12, mardakan-13"
   git push -u origin HEAD
   ```

7. **Wait for publishing** (usually 3–6 minutes): `git ls-remote origin main` changes and
   `git show origin/main --stat` lists `public/plans/<slug>/…` for every new slug. If the Action fails, read its log
   (GitHub tools), fix the cause on the same branch and push again. The run is done when the new villas are on
   `main`; then check that https://havs.dev/en/plans/<slug> loads for each of them.

## Do not

- push to `main` directly, rewrite history, or delete anything except the branch the Action already deletes;
- edit existing villas, prices of existing villas, or anything outside `data/plans.json` and `renders/manifest.json`
  (fixes to the pipeline itself go in a separate, reviewed change);
- commit secrets, `.env*` files, or files from `private-assets/`.
