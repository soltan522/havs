# Design references

The daily villas take their architectural language from real premium villa developments the owner pointed to —
the Absheron coast (Bilgah, Sea Breeze / Nardaran, Mərdəkan) and Istanbul. Each family below is a **design
language**, not a building to copy: take the massing, materials and mood, then design an original villa.
Never name the developers, use their logos or imply any affiliation on the site.

Every new villa records its family in `data/plans.json` as `"inspiration": "<id>"` and its full render prompt
as `"prompt"`. `npm run validate` rejects unknown ids, repeated designs and prompts that are too alike.

**Rotation:** ten villas a day, spread over at least eight *different* families (at most two from one family),
preferring the ones used least so far (count `inspiration` in `data/plans.json`); a family used twice yesterday is
used at most once today.
Within a family, change at least two of: storeys, bedrooms, garage, pool, mirror, footprint ratio, setting,
accent material, light.

Sources (text only — the sandbox cannot open photo pages): developer and listing descriptions of Bilgah Estates,
Sea Breeze (seabreeze.az), BRABUS Island Baku, Mardi Mekan Estate and Zekeriyaköy villa listings.

---

### bilgah-stone — Bilgah coastal estate, stone and white
Gated Absheron estate villas 900 m from the sea: two storeys, sea views, private infinity pool, 4–6 bedrooms,
living room with fireplace, sauna and hot tub, ~600 m² plots.
- **style** `absheron` (flat), 2 floors; garage on larger villas
- **materials** sawn Absheron limestone base and side walls, white-render upper volume, bronze frames,
  timber soffits under deep slabs, frameless glass balustrades
- **prompt cues** "sawn Absheron limestone walls", "white render upper volume cantilevering over the terrace",
  "warm timber soffit", "infinity pool edge facing the Caspian", "olive and pomegranate trees", "gated estate street"

### bilgah-garden — Bilgah single-storey garden villa
Low, long villa around a private garden: stone walls, deep flat roof, terrace along the living rooms, pool or
reflecting pool, olive grove.
- **style** `absheron` 1 floor (3 bedrooms) or `pavilion`
- **prompt cues** "single-storey", "long limestone garden wall", "deep flat roof", "courtyard terrace", "reflecting pool"

### bilgah-timber — Bilgah light render and warm timber
Two-storey villa mixing light render with large panels of warm timber cladding, private pool in the foreground.
- **style** `modern` or `coastal`, 2 floors
- **prompt cues** "light render combined with vertical oak cladding", "timber-framed upper volume", "pool terrace"

### seabreeze-white — Sea Breeze snow-white high-tech villa
Snow-white single-storey high-tech villas, each with a private courtyard, mini terrace, decorative pool and
clipped green hedges.
- **style** `minimal` 1 floor (3 bedrooms) or `pavilion`
- **prompt cues** "snow-white", "high-tech single-storey villa", "private courtyard with decorative pool",
  "clipped hedges", "white walls, thin black window frames"

### seabreeze-miami — Sea Breeze Miami modern
White resort architecture with horizontal bands, eyebrow canopies over windows, pastel accents, palms.
- **style** `modern` or `coastal`, 2 floors (keep the plan rectilinear — no curved walls)
- **prompt cues** "Miami-modern horizontal white bands", "eyebrow canopies", "terrazzo terrace", "royal palms"

### seabreeze-noir — Sea Breeze dark contemporary twin-villa language
Clean vertical lines and a dark, sophisticated palette (the BRABUS villas), crisp slabs, bronze details.
- **style** `noir`, 2 floors; the `duplex` style for a twin villa
- **prompt cues** "charcoal render", "bronze vertical fins", "clean vertical lines", "dark sophisticated palette",
  "warm interior light at dusk" — rectilinear, no sweeping curves

### seabreeze-coastal — Sea Breeze beachfront villa
Beachfront villa with teak louvres, deep overhangs, covered terraces and an infinity pool on the sand.
- **style** `coastal`, 1–2 floors
- **prompt cues** "teak louvres", "deep overhangs", "beachfront", "dune grasses"

### mardakan-contemporary — Mərdəkan gated estate contemporary
Clean lines, panoramic glazing and natural materials on ~600 m² plots behind stone walls.
- **style** `modern` or `luxury`
- **prompt cues** "panoramic glazing", "natural stone and oak", "garden wall of Absheron stone", "fig and mulberry trees"

### absheron-classic — Absheron dacha, Mediterranean
Absheron summer-house tradition: white stucco, arches, terracotta roof, vine pergolas, fig trees.
- **style** `mediterranean` or `tuscan`
- **prompt cues** "white lime stucco", "arched loggia", "terracotta hip roof", "vine pergola", "fig trees"

### istanbul-forest — Istanbul forest villa (Zekeriyaköy, Sarıyer)
Modern villas in mature forest: full-height glazing to the garden, large fireplaces, stone and timber,
privacy, pool in a mature garden.
- **style** `modern`, `luxury` or `noir`; `"tree": "pine"`
- **prompt cues** "mature oak and pine forest", "stone chimney", "full-height glazing", "timber soffits",
  "lawn and pool under old trees"

### bosphorus-yali — Bosphorus yalı
Traditional waterfront timber mansions: painted weatherboarding (white, pale grey, ochre), tall timber windows
in rhythm, slate or lead hip roof with deep eaves, waterfront terrace.
- **style** `yali` (hip roof), 2 floors
- **prompt cues** "Bosphorus yalı", "painted timber weatherboarding", "tall timber sash windows in rhythm",
  "slate hip roof with deep eaves", "waterfront stone quay", "Judas trees"

### istanbul-aegean — Istanbul stone and white modern
Contemporary Istanbul villa in white plaster and local stone, flat roofs, roof terrace with Bosphorus view.
- **style** `minimal` or `absheron`
- **prompt cues** "white plaster and rough local stone", "roof terrace with a view", "cypress and olive"

---

Families for **multi-unit projects** (`"project"` in `data/plans.json`, see `docs/daily-villas.md`):

### baku-townhouse — Baku hillside townhouse terrace
Terraces of two-storey family townhouses in Baku's green hillside suburbs: clinker brick, thin white slab bands,
floor-to-ceiling bronze-framed glazing, oak around the front doors, front courts with parking, private rear gardens.
- **style** `townhouse` with `"project": { "kind": "row", "units": 4–8 }`
- **prompt cues** "terrace of N attached two-storey townhouses", "warm red clinker brick", "white slab bands",
  "front doors in mirrored pairs", "tree-lined residential street", "private rear gardens", "pocket park"

### caucasus-farmstead — Caucasus foothill farm estate
Stone farmhouses of the İsmayıllı and Şamaxı foothills: rough river stone, terracotta gable roofs, oak pergolas
with vines, a stone winery barn, orchards and vineyards, walnut and cypress trees.
- **style** `farmhouse` (or `tuscan` / `mediterranean`) with `"project": { "kind": "farm", "units": 3–6 }`
- **prompt cues** "N single-storey stone farmhouses on a gentle arc", "terracotta gable roofs", "oak pergolas with
  vines", "stone winery barn and stables around a farmyard", "cypress avenue", "vineyard rows", "pond"

### shahdag-chalet — Greater Caucasus mountain chalet village
Mountain resort chalets on forested slopes: grey stone ground floor, dark timber above, steep standing-seam gables
with glazed gable ends facing the valley, timber balconies, a shared spa lodge.
- **style** `chalet` (or `modern` / `absheron` / `minimal` / `coastal` for other village types) with
  `"project": { "kind": "cluster", "units": 4–6 }`
- **prompt cues** "N chalets staggered in two rows on a pine-forested slope", "glazed gables facing the valley",
  "spa lodge at the entrance", "winding lanes", "snow-capped peaks"

### absheron-retail — Absheron neighbourhood supermarket
A contemporary local supermarket for the growing Absheron suburbs: one tall storey, anthracite façade panels,
a full-width shopfront under a plain fascia (the operator's signage goes there — never draw a real brand),
a timber entrance canopy, a car park with planted islands and EV bays, and a separate delivery yard.
- **style** `market` with `"project": { "kind": "retail", "units": 1 }`, `"bedrooms": 0`, `"bathrooms"` = WCs,
  `"parking"` = bays drawn on the masterplan (`npm run validate` prints the number)
- **prompt cues** "modern single-storey neighbourhood supermarket", "anthracite composite panels",
  "full-width glass shopfront under a plain fascia with no signage", "timber entrance canopy",
  "car park with planted islands", "delivery yard with a truck at the loading dock", "no logos, no text"

### baku-commercial — Baku corner office and showroom building
Refresh of a mid-rise corner building in central Baku for a company's own headquarters: champagne aluminium
composite panels, silver floor bands, vertical window stacks, a round glazed stair tower, a fully glazed
ground-floor showroom under a glass canopy, a roof terrace and a gated forecourt car park.
- **style** `office` with `"project": { "kind": "urban", "units": 1 }`, six floors; `"sign"` only with the owner's
  own company name (never a third-party brand)
- **prompt cues** "six-storey corner office building", "champagne aluminium panels with silver floor bands",
  "round glazed stair tower", "glazed ground-floor showroom", "glass canopy on steel tie rods", "roof terrace";
  add interior views (showroom, office floor, board room) as extra renders
