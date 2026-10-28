# Daily villas — runbook

Every day twenty new **sample villas** are added to the havs.dev catalogue: a photoreal concept render plus the
generated concept sheets (site plan, floor plans, south elevation, isometric). This file is the procedure the
scheduled routine follows; a person can follow it too.

Samples are `demo: true`: they are labelled "Concept project" and sold as concept packages; the checkout only takes
payment once the villa's files are in the private bucket (see `docs/payments.md`).
Never present them as built houses or real client work.

## How the pipeline works

1. You add twenty entries to `data/plans.json` and list their render URLs in `renders/manifest.json`,
   then push a branch `auto/villas-YYYYMMDD` (today's date, UTC).
2. The GitHub Action **Publish new villas** (`.github/workflows/publish-villas.yml`) downloads the renders,
   runs `npm run previews -- --missing` and `npm run validate -- --require-renders`, builds each new villa's
   drawing package — vector A3 PDF set (cover, site plan, floor plans, elevation — a luxury villa's also section A–A —,
   isometric, schedules),
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

1. **Choose twenty concepts.** Read `docs/design-references.md` — the design families taken from the reference
   developments (Bilgah, Sea Breeze, Mərdəkan, Istanbul) and the rotation rules — and `data/plans.json` (newest
   entries are at the end). Each villa takes one family (`"inspiration"`) and stores its render prompt (`"prompt"`).
   Pick a mix of twenty:
   - at least six pitched-roof villas (`tuscan`, `mediterranean`, `farmhouse`, `yali` or `chalet`),
   - at least eight flat-roof contemporary villas (`modern`, `minimal`, `coastal`, `luxury`, `pavilion`, `absheron`
     or `noir`),
   - the rest any style, including `duplex`;
   - at least eight single-storey or three-level villas, so the catalogue does not fill up with two-storey houses
     (single-storey plans have two or three bedrooms; when no free single-storey or three-level design key is left,
     take fewer and say so in the report);
   - at most three villas of one style and at most two of one design family in the same day.
   Before writing, list the free design keys (style + floors + bedrooms + garage + pool, + `"layout"` for
   single-storey villas — see below — not used yet) and pick from them; `npm run validate` prints the exact bedroom
   and bathroom counts the generator produces.
   **Nothing may repeat an existing design** — `npm run validate` enforces it and fails on:
   a place name, title or summary already used; the same combination of style + floors + bedrooms + garage + pool
   (+ layout) as an existing villa (mirroring does not count as different); the same style, floors and layout with an
   area less than 25 m² apart; a render prompt that is 75 % the same as another; an unknown `inspiration`; and (in
   the Action) a render that looks like a copy of an existing one. It warns when
   more than two villas share one floor-plan layout — then change bedrooms, garage, pool, set `"mirror": true`
   (the mirrored variant flips the plan left-to-right: with the standard plan the living rooms come next to the
   garage, with the split plan the master suite does) or, for a single-storey villa, use the other plan
   (`"layout": "b"`).
   Read the titles and summaries of the last twenty villas and write something different: other materials, other
   setting, other outdoor features. Allowed values per style are in `STYLE_RULES` in `scripts/drawings.mjs`
   (roofs, floors; styles marked `projectOnly` are not single villas); area per floor must be 80–320 m².
   Optional `ratio` (footprint width / depth, 1.0–2.2) varies the massing between villas of the same style, and
   optional `tree` (`olive`, `cypress`, `palm`, `pine`, `round`) sets the planting drawn on the elevation and site
   plan — match it to the setting you describe in the render prompt.

   **Single-storey villas have two plans.** A villa with one storey above ground — `floors: 1`, or `luxury` with
   `floors: 2` (one storey over its lower level) — is drawn with the standard plan, or with the split plan when the
   entry sets `"layout": "b"`:
   - standard (no `"layout"`): living wing at one end, entrance hall in the middle, bedrooms off a corridor (three
     bedrooms: 2 bathrooms) or off a compact hall (two bedrooms: 1 bathroom);
   - `"layout": "b"`, the split plan: living, dining and kitchen run through the middle of the house from the rear
     garden to the terrace and pool, glazed at both ends; the master suite takes one end (bedroom on the rear garden, a
     lobby, the en-suite and on wider plans a dressing room, plus a study on the terrace when the plan is deep); the
     entrance hall on the street front and the other bedrooms take the other end — two bedrooms and their bathroom
     (three bedrooms: 2 bathrooms), or one bedroom with its own shower room or bathroom off the hall (two bedrooms:
     **2** bathrooms). It works with every single-storey style, garage, pool, `mirror`, `ratio` and `tree`.

   The layout is part of the design key and of the 25 m² rule, so `"layout": "b"` opens a second set of single-storey
   design keys (style|floors|bedrooms|garage|pool|b) and its own area range: a layout-b villa is only compared with
   other layout-b villas of the same style and floors. Use it like this: list the free keys of both plans; for each
   single-storey villa take the plan whose floor-plan layout (the key `npm run validate` prints in its "villas share
   the floor-plan layout" warning: storeys|bedrooms|garage|pool|mirror, with `|b` for the split plan) has fewer than
   two villas, so that every floor plan serves at most two villas; while layout b has fewer villas than the standard
   plan, prefer it, and spread its areas over the whole 100–320 m² per floor (luxury on two floors: 240–640 m² in
   all, see "Luxury villas" below) instead of squeezing into the gaps left by the standard plan.
   The split plan has four columns across the house and needs a footprint at least **11.2 m wide** (11.5 m for three
   bedrooms on a plan less than 9.6 m deep; 12.1 m for `modern` and `absheron`, whose entrance has the clad fin) and,
   with three bedrooms, at least **7.2 m deep** (two bedrooms: 6.3 m); a `luxury` villa on two floors is 2.4 m wider
   than that for the stair down to its lower ground floor (13.6 m, 13.9 m with three bedrooms on a shallow plan). The
   footprint is about √(`areaM2` / `floors` × `ratio`) wide and √(`areaM2` / `floors` / `ratio`) deep — for `luxury`
   on two floors use half the area. So a small split-plan villa needs a moderate ratio: 100 m² with three bedrooms takes a ratio of
   about 1.4–1.9, with two about 1.3–2.2 (`modern`/`absheron` 100 m²: 1.5 or more); from about 130 m² per floor
   (`modern`/`absheron`: 150 m²) every ratio fits. `npm run validate` fails a footprint that is too small and prints the ratios that fit, and
   one whose rooms still come out below the minimum sizes (below). A villa takes no other `"layout"` value; two-storey villas, projects and
   interiors cannot use it (interiors have their own `"interior": { "layout" }`).
   In the render prompt describe what the elevation shows: a long single-storey house with its glazed living room in
   the middle between two solid wings, the entrance door beside it on the street front.

   **Room sizes.** Every house plan (both single-storey plans, two- and three-level villas, the duplex, a project's
   houses) is drawn with rooms of at least these clear sizes: bedrooms 2.7 m wide and 9 m², bathrooms and en-suites
   about 1.5 m wide and 3.5 m², halls, corridors and landings 1.1 m wide, the living space 3.3 m wide, and the master
   bedroom the largest bedroom (`ROOM_MIN` in `scripts/drawings.mjs`). The generator keeps a plan's own proportions
   where they give these sizes and otherwise fits its rooms in metres, taking the space from the rooms beside them;
   doors stay clear of furniture and of each other (a door moves along its wall, or is hung on its other jamb, before a
   bed is turned off its wall; no bed has its head against the glazed doors to a terrace or balcony), and no window is
   put in the wall the garage stands against. **Stairs** are drawn from the storey height (3.3 m) in the stair's box:
   a dog-leg with a half-landing (18 risers of 183 mm, goings of 25–30 cm, flights 0.9–1.2 m wide) where the box is
   long enough, otherwise a dog-leg with six winders in the turn (19 risers of 174 mm), otherwise a spiral stair (16
   risers of 206 mm, at least 1.5 m across) — `STAIR` and `fitStairs` in `scripts/drawings.mjs`. Both flights start and
   end at the stair's opening, so the stair is entered on its first flight on the lower level and left from its second
   on the upper one, and every level shows the walking line from its own opening (UP to the cut, DN round the turn).
   `npm run validate` fails a villa whose footprint is too small or too long for its rooms or its stair box and names
   the ratios or the area that work (only ones that pass every rule). In practice the standard single-storey plan
   takes, with three bedrooms, 100 m² at a ratio of about 1.3–1.8, 110 m² at 1.2–1.95, 120 m² at 1.1–2.15 and every ratio from 130 m² (less than 100 m² is too small); with
   two bedrooms 90 m² at 1.15–1.45, 100 m² at 1.0–1.6, 120 m² at 1.0–1.9 and every ratio from 140 m². A two-storey
   villa with up to five bedrooms takes every ratio from 140 m² per floor (100 m² per floor: up to 1.6); six bedrooms
   need about 140 m² per floor, seven about 200 m² per floor at a ratio of 1.55 or more (240 m²: 1.2 or more).

   **Luxury villas: the lower ground floor.** A `luxury` villa is sold with a lower ground floor under the whole house:
   `floors` counts it (2 = one storey over it, 3 = two storeys over it) and `areaM2` is spread over every level, the
   lower one included. The drawings give it its own sheet, **A-101 LOWER GROUND FLOOR PLAN** (the other plans follow as
   A-102, A-103), its preview `lower.jpg` ("Lower ground floor plan" / "Aşağı mərtəbə planı" / "План цокольного этажа"
   on the plan page), its own level in the DXF/DWG and the first rows of the schedules (rooms LG.01…), and a vertical
   drawing, **A-202 SECTION A–A** through the house, the lower floor and the court (preview `section.jpg`: "Section A–A" /
   "Kəsik A–A" / "Разрез А–А"; the cut is marked on A-101 and the ground floor plan). It has a lobby at the foot of the
   stair; under the front of the house a home cinema (a media room with one row of seats on a small or shallow
   footprint), the wine cellar, the plant room and, on a wide plan, a games room and a store; on the rear garden a gym
   and a spa with a sauna (and a hammam where the row is deep; a garden lounge beside the spa on a wide plan), glazed to
   a sunken court 4 m deep across the back of the house, its floor at −3.45 (a step below the floor inside, a linear
   drain along the glazing) with 20 steps up to the garden and a glass balustrade round its edge. Its only windows are
   on that court: the other walls are below ground. The ground floor plan shows the near part of the court and puts a
   glass balustrade (1.10 m) across every ground floor window that opens over it; the window schedule lists them as
   "glass guard 1.10 m". The stair is the ground floor's: a three-level villa's stair goes on down; a two-floor villa
   (one storey above ground) gets a stair bay 2.4 m wide and at least 3.5 m deep at the rear wall, beside the entrance
   hall on the living side, for a dog-leg with a half-landing, so its plan (standard or `"layout": "b"`) is drawn 2.4 m
   narrower than the footprint. **The lower floor adds no bedroom, bathroom, shower room or WC**, so `bedrooms` and
   `bathrooms` stay the counts of the storeys above ground (`npm run validate` checks them): the sauna and hammam are
   their own room kinds and the spa's rain shower is a fitting in the spa, not a shower room — a bathroom down there
   would change the count of every existing luxury villa. A-101 therefore carries a note that a WC and changing room for
   the spa and gym are still to be planned on that level and are not in the listed bathroom count. The elevation shows
   the lower floor dashed below the street front with what it holds, the isometric dashed below the house with the
   court behind it, the site plan the court in the rear garden. `npm run validate` also fails a luxury villa whose lower
   floor comes out too small (cinema 2.7 m wide and 14 m², media room 2.3 m and 9 m², gym and spa 2.6 m and 9 m², sauna
   and hammam 1.5 m and 3 m², wine cellar 1.4 m and 3 m², plant room 1.4 m and 3.5 m², garden lounge 2.4 m and 7 m²,
   games room 2.7 m and 12 m², lobby 1.1 m; `LG_MIN` in `scripts/drawings.mjs`) or whose living space is less than
   4.5 m wide and 35 m² (a living room beside a separate kitchen and dining room: 25 m²), and names the ratios or area
   that work. In practice: on **two floors** (the stair bay takes 2.4 m) two bedrooms need at least 240 m² in all
   (120 m² per floor) at a ratio of about 1.8–1.9, 260 m² at 1.65–2.1, 280 m² at 1.5–2.2, 320 m² at 1.35–2.2, 360 m² at 1.2–2.2 and every ratio from 420 m²; three bedrooms 260 m²
   at 1.8–2.2, 280 m² at 1.6–2.2, 300 m² at 1.5–2.2, 320 m² at 1.4–2.2, 360 m² at 1.25–2.2 and every ratio from 460 m².
   With `"layout": "b"`: 260 m² at 1.8–2.2 (three bedrooms 1.95–2.2), 280 m² at 1.7–2.2 (1.8–2.2), 300 m² at 1.6–2.2,
   320 m² at 1.5–2.2, 340–400 m² at 1.7–2.2 (the ratios in between give a separate living room that is too small),
   420 m² at 1.15–2.2 and every ratio from 520 m². On **three floors** the same areas and ratios as a two-storey villa
   (above). In the render prompt describe the storeys above ground only: from the
   street the lower floor is below ground.

2. **Name them.** Use Azerbaijani places and landscapes (Nabran, Quba, Qəbələ, Şəki, Lənkəran, Mərdəkan,
   Göygöl, Xınalıq, Zaqatala, Şuşa, Qusar, Astara, Buzovna, Novxanı, İsmayıllı, Laza, Talış, Pirqulu…), not yet used
   in the catalogue. Title e.g. "Nabran Villa" / "Nabran Villa" / "Вилла Набран". Slug: ascii, lowercase,
   followed by the next catalogue number, e.g. `nabran-11`, `quba-12`, `mardakan-13`.

3. **Write the entries** in `data/plans.json` (append at the end), same shape as the existing ones:
   `slug, style, roof, title{az,en,ru}, summary{az,en,ru}, areaM2, floors, bedrooms, bathrooms, garage, pool,
   priceCents, published: true, demo: true, location` (+ optional `ratio`, `tree`, `mirror`, and `"layout": "b"` for a
   single-storey villa).
   - Location: `"location": [longitude, latitude]` with 4 decimals — the centre of the town or village the villa is
     named after (not a plot: the villa is a concept). It places the villa on the projects map (`/<lang>/map`);
     `npm run validate` warns when it is missing and fails when it lies outside Azerbaijan.
   - Summary: two sentences, professional and factual — materials, roof, key spaces, outdoor features.
     Correct Azerbaijani (ə, ı, ö, ü, ğ, ş, ç) and Russian. No superlatives, no claims that it was built.
   - Price: `priceCents` = `areaM2` × 30 × 100 (30 per m²; visitors in Azerbaijan see it in AZN, everyone else in
     USD — `lib/pricing.ts`). `npm run validate` fails on any other value and prints the right one.
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

## Multi-unit projects (only when asked)

A catalogue entry can also be a whole development: a terrace of townhouses, a farm estate, a small village or a
commercial building (`retail`: a neighbourhood supermarket with its car park, `urban`: a corner office and showroom
building or a roadside showroom — `"bedrooms": 0`, `"bathrooms"` = WCs,
`"parking"` = bays on the masterplan; priced like everything else at 30 per m²).
Add `"project": { "kind": "row" | "farm" | "cluster" | "retail" | "urban", "units": N }` to the entry; `areaM2`, `floors`,
`bedrooms` and `bathrooms` then describe **one** house, and the generator draws the masterplan (A-001), the typical
house plans, the street elevation (row) or typical elevation, an isometric of the whole project and one of the
typical house. Allowed kinds, unit counts and styles are in `PROJECT_RULES` in `scripts/drawings.mjs`
(`townhouse` is only used in a `row`). Projects have no garages (`"garage": false` — parking is on the
masterplan) and are priced on all houses together: `areaM2` × `units` × 30 per m².
Use a family from the project section of `docs/design-references.md`. The render is an aerial three-quarter view
of the whole project that shows exactly N houses in the arrangement the masterplan draws: a straight terrace in
mirrored pairs (`row`), houses on a gentle arc above a vineyard with the barn behind (`farm`), two staggered rows
on a slope with the lodge at the entrance (`cluster`). The daily routine adds single villas only.

A **surveyed building** (`urban`: the owner's existing office building) keeps its measured `"footprint": [width, depth]`
(`npm run validate` checks it against `areaM2` and `floors`); the owner's own photos and plans go in
`renders/<slug>/owner/` and appear in the gallery after the concept renders.

## Commercial and apartment buildings (only when asked)

One building on its plot, with its forecourt, car parks and service yard or garden on the masterplan:
`"project": { "kind": "business" | "hotel" | "dining" | "events" | "residential", "units": 1 }` with the styles
`bizcenter`, `hotel`, `restaurant`, `banquet` and `apartments`. `"layout"` picks the drawn plan and `"facade"` the
cladding (`STYLE_RULES` and `FACADES` in `scripts/drawings.mjs`):

| style | floors | layouts | facades | the listing counts |
|---|---|---|---|---|
| `bizcenter` | 4–14 | `a` central core, `b` core at the back, `c` a core at each end | `glass`, `stone`, `terracotta` | WCs, parking |
| `hotel` | 3–10 | `a` rooms either side of a corridor, `b` one row of rooms with balconies | `stone`, `render` | `"rooms"` (guest rooms) |
| `restaurant` | `a` 1, `b` 2, `c` 1, `d` 2 | `a` garden, `b` city with an event hall upstairs, `c` seafront grill, `d` mountain lodge (`"roof": "gable"`, facade `lodge`) | `stone`, `glass`, `brick`, `timber`, `lodge` | `"seats"` |
| `banquet` | 1 | `a` wedding hall | `travertine`, `stone` | `"seats"` |
| `apartments` | 5–12 | `a` flats either side of a corridor, shops below | `render`, `brick` | `"flats"`, bedrooms in all flats |

`areaM2` is the whole building (per floor: `floorArea` in `STYLE_RULES`); `"bedrooms": 0` except for apartments,
`"bathrooms"` = WCs and bathrooms in the drawings, `"parking"` = bays on the masterplan, `"garage"` and `"pool"`
false; optional `"ratio"` up to 4.0 (a resort hotel is long and narrow). `npm run validate` prints the exact bathrooms,
parking, rooms, seats and flats. Identical upper floors are drawn once as the typical floor plan. Price rule:
30 per m² of `areaM2`. Take the design families from the commercial section of `docs/design-references.md`; the render
shows the building with the storeys, cladding and canopy of the drawings, eye-level or slightly raised, with no
signage, logos or text.

## Interior design projects (only when asked)

An entry with `"style": "interior"` sells an interior design concept instead of a building:
`"interior": { "type": "flat" | "penthouse" | "residence" | "cafe" | "workspace" | "boutique" | "clinic" | "salon",
"palette": "<family id>" }`, `"inspiration"` = the palette id, `"roof": "flat"`, no garage or pool. `areaM2` is the
floor area of the space; bedrooms and bathrooms (WCs for commercial spaces) must match the generated layout
(`npm run validate` prints them); the price rule is 30 per m² of `areaM2`. The package is an interior set: furniture layout,
finishes plan, ceiling and lighting plan per level, interior elevations, a cutaway axonometric, finishes / lighting /
FF&E schedules and the materials board. Two or three landscape interior renders per project.
A palette fits only the types it is written for (home palettes: flat, penthouse, residence; each commercial palette:
its own type). A commercial space or a three-bedroom flat / penthouse may add `"layout": "b"` inside `"interior"` for the second
room arrangement, and any
interior may set `"ratio"` / `"mirror"` so two projects of the same type do not share one plan.

## Custom-drawn entries (only when asked)

A sheet set drawn outside the generator (the first is the Avropa Qapıları door factory, `avropa-fabrik-118`: a whole
site with several buildings on seven A1 sheets) is listed as a **custom-drawn** entry. Nothing in the generator draws,
counts or packages it; the listing carries its own figures and previews.

- **Style and kind.** The style has `custom: true` in `STYLE_RULES` (`scripts/drawings.mjs`), with its project kind in
  `PROJECT_RULES` (`factory` / `industrial`, `"units": 1`); the entry sets `"drawings": "custom"` (`npm run validate`
  requires both to agree). `areaM2` is the gross floor area of all buildings, `"siteM2"` the plot, `"staff"` the
  workplaces, `"parking"` the car bays; `"bedrooms": 0`, `"garage"` and `"pool"` false, no `"layout"` or `"footprint"`.
  Price rule as everywhere: 30 per m² of `areaM2`.
- **Sheet titles.** `"sheetTitles"` names each sheet in az / en / ru, one title per sheet, in sheet order
  (`private-assets/<slug>/01.jpg` first). The plan page labels the previews with these titles and the sheet numbers
  (A1-01 …).
- **Files.** Concept renders go in `renders/<slug>/` (required, committed; the first is the catalogue card). The
  full-resolution sheet images go in `private-assets/<slug>/` (git-ignored). The PDF, DXF or DWG set never goes in
  the repository (`.gitignore` blocks them; the validator rejects any in a public folder). Before the previews are
  built, blur people's faces and remove third-party material (map screenshots, logos, private addresses) from the
  private copies unless the owner has cleared them for publication.
- **Previews.** Run `npm run previews -- --only <slug>` on a machine that has `private-assets/<slug>/` and commit
  `public/plans/<slug>/` and `lib/previews.generated.ts`. CI cannot rebuild them (the originals are not in the
  repository): it keeps the committed previews and fails if `public/plans/<slug>/` is missing.
- **No package, no online sale.** `build-packages.mjs` skips these entries, so nothing goes in `data/packages.json` or
  `renders/manifest.json`. The plan page shows the design price and a request button; the checkout page is an order
  request with a contact link, and `/api/checkout` refuses them even if files are uploaded to the bucket. The full set
  is supplied on request.
- **Map model (optional).** A site model sets `"model": { …, "replaces": [city building ids], "zoom": 16.8 }`:
  `replaces` hides the city-layer buildings it stands in place of (every building with a real share of its footprint
  inside the site boundary), `zoom` is the close-up that fits the whole site.

## After changing the drawing generator

The Action builds previews and packages only for new villas (`--missing`). When a change to `scripts/drawings.mjs`
redraws existing plans, rebuild them before or right after merging: `npm run previews` for every plan (commit
`public/plans/` and `lib/previews.generated.ts`) and the manual workflow **Rebuild drawing packages** (Actions → Rebuild
drawing packages) with `only` left empty, or the changed slugs — it rebuilds the PDFs, DXFs, DWGs and
`data/packages.json` (page and sheet counts) and uploads them. Say so in the pull request description.

## Do not

- push to `main` directly, rewrite history, or delete anything except the branch the Action already deletes;
- edit existing villas, prices of existing villas, or anything outside `data/plans.json` and `renders/manifest.json`
  (fixes to the pipeline itself go in a separate, reviewed change);
- commit secrets, `.env*` files, or files from `private-assets/`.
