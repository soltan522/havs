# Design references

The daily villas take their architectural language from real premium villa developments the owner pointed to —
the Absheron coast (Bilgah, Sea Breeze / Nardaran, Mərdəkan) and Istanbul. Each family below is a **design
language**, not a building to copy: take the massing, materials and mood, then design an original villa.
Never name the developers, use their logos or imply any affiliation on the site.

Every new villa records its family in `data/plans.json` as `"inspiration": "<id>"` and its full render prompt
as `"prompt"`. `npm run validate` rejects unknown ids, repeated designs and prompts that are too alike.

**Rotation:** twenty villas a day, spread over at least ten *different* families (at most two from one family),
preferring the ones used least so far (count `inspiration` in `data/plans.json`) and the ones used once or not at
all yesterday.
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
Refurbishment of an existing mid-rise corner building in central Baku as a company's own headquarters, drawn from
the owner's survey and concept: white facades with wide black anodised aluminium frames on the column lines, a fully
glazed chamfered corner, black-clad street balconies, a round stair tower, a glazed ground-floor showroom under a
glass canopy, a roof terrace and a gated forecourt car park.
- **style** `office` with `"project": { "kind": "urban", "units": 1 }`, six floors, `"footprint": [w, d]` from the
  survey; `"sign"` only with the owner's own company name (never a third-party brand)
- the owner's own photos, concept images and survey plans go in `renders/<slug>/owner/` (strip licence plates, phone
  numbers and photo metadata first) and are shown in the gallery after the renders
- **prompt cues** "six-storey corner office building", "corner cut at 45 degrees, full-height glazing between black
  frames", "white facades with black aluminium frames", "three stacked black balconies", "round silver stair tower",
  "glazed ground-floor showroom", "glass canopy on steel tie rods", "count of floors: one tall ground floor, then five
  rows of windows"; add interior views (showroom, office corridor, manager's office) as extra renders

### absheron-showroom — Absheron roadside door and window showroom
An existing double-height commercial hall on a busy Absheron road refreshed as a showroom: four equal bays between
warm-white rendered pilasters, two tiers of tall glazing in a fine black steel grid, a glass canopy over the entrance,
the owner's sign band along the top, a mezzanine gallery inside, forecourt parking off the road and a service yard.
- **style** `showroom` with `"project": { "kind": "urban", "units": 1 }`, two levels (the hall and its mezzanine),
  `"footprint": [w, d]`; `areaM2` counts the mezzanine without the double-height void (`npm run validate` prints it);
  `"sign"` only with the owner's own company name
- the owner's photos go in `renders/<slug>/owner/` (blur licence plates, people, other companies' signs and phone
  numbers, strip metadata)
- **prompt cues** "flat-roofed rectangular building about 23 metres wide and 9 metres tall", "four equal bays divided by
  five slender rounded pilasters", "two tiers of tall glazing in a fine black steel grid", "long deep green sign band
  with gilded capital letters", "glass canopy on steel tie rods", "paved forecourt with a row of parking bays"; add an
  interior view of the double-height showroom from the mezzanine

---

Families for **commercial and apartment buildings** (one building on its plot: `"project": { "kind": …, "units": 1 }`,
the drawn plan `"layout"` and the cladding `"facade"`, see `docs/daily-villas.md`). The render shows the building as
the drawings do: the same number of storeys, the cladding of its facade option, the entrance canopy, and no signage,
logos or text.

### caspian-glass-office — glass business centre
A business centre in a new city quarter: a clean rectangular slab in a curtain wall of low-iron glass with slim black
mullions and light slab-edge bands, a glazed double-height lobby under a cantilevered glass canopy, an entrance plaza
with planting, parking either side.
- **style** `bizcenter`, `"kind": "business"`, facade `glass`; layout `a` (central core) for 8–14 floors
- **prompt cues** "curtain wall with slim black mullions", "light slab-edge band at every floor", "glass entrance
  canopy", "entrance plaza with plane trees", "reflections of the sky", "no signage"

### limestone-grid-office — limestone grid office building
A sober office building of continuous limestone piers and spandrels with deep-set ribbon glazing between them — the
Baku tradition of stone facades in a contemporary grid; cafe and retail units behind full-height glass at street level.
- **style** `bizcenter`, `"kind": "business"`, facade `stone`; layout `b` (core and meeting rooms at the back)
- **prompt cues** "regular grid of sawn limestone piers", "deep-set glazing between the piers", "stone spandrel at
  every floor", "glazed ground floor with a cafe", "street trees"

### terracotta-office-slab — terracotta rainscreen office slab
A long, lower office slab clad in terracotta baguettes, ribbon windows in bronze frames, a core at each end, a
restaurant, entrance hall and fitness club along the ground floor.
- **style** `bizcenter`, `"kind": "business"`, facade `terracotta`; layout `c` (two cores, two tenancies per floor)
- **prompt cues** "terracotta rainscreen baguettes", "long horizontal ribbon windows", "bronze window frames",
  "full-height glazing at street level", "warm afternoon light on terracotta"

### boulevard-hotel — city hotel in limestone
A mid-rise city hotel: a sawn-limestone ground floor with full-height glazing to the restaurant, lobby and lounge bar,
upper floors in white render with regular punched windows of the guest rooms, a glass canopy over the drop-off.
- **style** `hotel`, `"kind": "hotel"`, facade `stone`, layout `a` (rooms either side of a central corridor)
- **prompt cues** "limestone base, white render above", "regular rows of guest-room windows", "glass canopy over the
  drop-off", "bellhop trolley and potted olive trees at the door", "evening light, warm lobby"

### spa-resort-hotel — resort hotel with balconies
A long, low resort hotel: every guest room with full-height glazing onto a balcony with a glass balustrade, white
render, a pool garden behind, lobby, restaurant, lounge bar and spa on the ground floor.
- **style** `hotel`, `"kind": "hotel"`, facade `render`, layout `b` (one row of rooms facing the front)
- **prompt cues** "continuous balconies with frameless glass balustrades", "white render", "palm and pine garden",
  "pool garden", "soft morning light"

### garden-restaurant — garden restaurant
A single-storey restaurant in a garden: dining hall and bar behind full-height glazing, a deep oak pergola with vines
across the front, the kitchen behind.
- **style** `restaurant`, `"kind": "dining"`, layout `a`, facade `timber` or `stone`
- **prompt cues** "oak pergola with grape vines", "full-height glazing", "garden terrace with tables", "walnut and
  plane trees", "string lights at dusk"

### brick-city-restaurant — two-storey city restaurant
A brick restaurant in town: the dining hall and bar behind large glazing at street level, an event hall and private
dining rooms upstairs, a roof terrace.
- **style** `restaurant`, `"kind": "dining"`, layout `b`, facade `brick`
- **prompt cues** "warm red clinker brick", "large steel-framed windows", "roof terrace with a glass balustrade",
  "street corner with plane trees", "evening light"

### seafront-grill — seafront grill under a canopy
A glass pavilion restaurant on the shore: dining room, open grill (mangal) and bar under a deep flat canopy on slender
steel columns, a covered terrace facing the sea.
- **style** `restaurant`, `"kind": "dining"`, layout `c`, facade `glass`
- **prompt cues** "deep flat canopy on slender steel columns", "travertine walls and full-height glass", "covered
  terrace with tables", "dune grasses and tamarisk", "Caspian at sunset"

### mountain-lodge — mountain restaurant lodge
A two-storey restaurant in the mountains: a grey river-stone ground floor with the dining hall and tea room, dark
timber above with private rooms off a gallery, a standing-seam pitched roof and a stone chimney.
- **style** `restaurant`, `"kind": "dining"`, layout `d`, facade `lodge`, roof `gable`
- **prompt cues** "grey river stone below, dark timber above", "standing-seam pitched roof", "stone chimney", "terrace
  with wooden tables", "beech forest and snowy peaks"

### wedding-palace — wedding and banquet hall
A wedding hall (şadlıq sarayı): one tall storey behind a colonnade of rendered pilasters with full-height glazing, a
foyer across the front, the banquet hall for several hundred guests, bridal room and VIP lounge, a forecourt with a
fountain and car parks either side.
- **style** `banquet`, `"kind": "events"`, facade `stone` (pilasters) or `travertine`
- **prompt cues** "tall colonnade of warm-white pilasters", "full-height glazing between the pilasters", "forecourt with
  a fountain", "cypress avenue", "dusk with warm light from the hall", "no signage"

### baku-residence — mid-rise apartment building
A mid-rise apartment building of the new Baku suburbs: render or brick facades with regular windows, a glass-balustraded
balcony for every front living room, shops and the entrance lobby on the ground floor, a residents' courtyard behind.
- **style** `apartments`, `"kind": "residential"`, facade `render` or `brick`
- **prompt cues** "N-storey apartment building", "regular rows of windows", "glass balconies", "shopfronts at street
  level", "young street trees", "children's playground in the courtyard behind"

---

Families for **interior design projects** (`"style": "interior"`, `"interior": { "type": …, "palette": "<id>" }`,
`"inspiration"` = the same id). The palette sets the materials board, finishes, joinery, colours and light; the
`type` sets the rooms: `flat` (1–3 bedrooms), `penthouse` (3), `residence` (two-level villa, 3–5), `cafe`, `workspace`,
`boutique`, `clinic`, `salon` (commercial: `"bedrooms": 0`, `"bathrooms"` = WCs; `"layout": "b"` picks the second room
arrangement of a commercial type or of a three-bedroom flat / penthouse). Each palette is written for certain types (its material uses name their rooms):
the home palettes for `flat`, `penthouse` and `residence`, each commercial palette for its own type only. The materials themselves are listed
in `PALETTES` in `scripts/drawings.mjs`. Renders are interior views (two or three per project, landscape) that show
the materials of the palette and the furniture of the layout; never a real brand or logo.

### baku-classic — Baku classic apartment
Neoclassical Baku apartments refreshed: plaster mouldings and panelled walls, oak herringbone, honed marble,
bottle-green joinery, velvet and aged brass.
- **prompt cues** "high ceilings with plaster cornices", "oak herringbone parquet", "bottle-green panelled kitchen",
  "Calacatta-style marble", "brass picture lights", "tall double windows onto a Baku street"

### japandi — Japandi
Pale ash, rice-paper whites and charcoal, low furniture, washi pendants, linen and boucle.
- **prompt cues** "pale ash plank floor", "slatted ash feature wall", "low linen sofa", "washi paper pendant",
  "basalt worktop", "a single bonsai or branch"

### scandi — Scandinavian
White oak, soft whites and fjord blue, terrazzo in the wet rooms, wool textiles, one mustard accent.
- **prompt cues** "white oak floor", "soft white walls", "fjord-blue accent wall", "terrazzo bathroom", "mustard
  armchair", "opal glass pendants"

### luxury-dark — Dark luxury
Smoked oak chevron, walnut panelling with bronze inlay, grey and black marble, cognac leather, champagne metal.
- **prompt cues** "smoked oak chevron parquet", "walnut panelling with bronze inlay", "black marble island",
  "cognac leather", "linear cove lighting", "night view over the city"

### mediterranean-calm — Absheron Mediterranean
Lime plaster and terracotta, limed oak, travertine and rattan, olive and sea green.
- **prompt cues** "hand-made terracotta floor", "lime-plastered walls", "exposed timber beams", "rattan pendants",
  "sea-green zellige tiles", "arched niches", "olive branches"

### oriental-modern — Azerbaijani modern
Walnut and clay plaster, shebeke-inspired lattice screens, carpet motifs in cement tiles, copper and pomegranate red.
- **prompt cues** "walnut and clay plaster", "geometric timber lattice screens inspired by shebeke windows",
  "encaustic cement tiles with carpet motifs", "hammered copper pendants", "pomegranate-red velvet banquettes",
  "pear-shaped tea glasses on the tables"

### art-deco — Art Deco
Emerald fluted panels, black lacquer, polished brass, terrazzo with brass inlay, blush velvet.
- **prompt cues** "emerald fluted panels", "black lacquer shelving with brass trims", "terrazzo floor with brass
  inlay", "curved display niches", "blush velvet curtains", "opal globe pendants"

### industrial-loft — Industrial loft
Polished concrete, reclaimed brick, black steel, oiled oak desks, felt acoustics, cognac leather.
- **prompt cues** "polished concrete floor", "reclaimed brick wall", "black steel glazed partitions", "oak desk
  clusters", "black linear pendants", "felt acoustic panels"

### biophilic — Biophilic clinic
Daylight, birch and sage, preserved moss walls, rounded corners, wipe-clean surfaces.
- **prompt cues** "birch plywood reception desk", "preserved moss wall", "sage upholstery", "rounded corners",
  "soft daylight", "calm and hygienic"

### mid-century — Mid-century
Warm terrazzo, walnut slats, mustard and teal velvet, round mirrors, globe lights, brushed brass.
- **prompt cues** "cream terrazzo floor", "walnut slatted walls", "round brass-framed mirrors", "mustard and teal
  velvet chairs", "opal globe pendants"

### warm-minimal — Warm minimal
Travertine and white oak, linen whites, soft bronze, built-in joinery, even concealed light.
- **prompt cues** "travertine and white oak", "linen-white walls", "built-in joinery", "shadow-gap details",
  "concealed coves", "sculptural pendant"

### nordic-cafe — Nordic café and bakery (cafe)
Pale oak, handmade white tile, a terrazzo bar, fog blue and rye, linen and wool, plenty of daylight.
- **prompt cues** "pale oak floor", "handmade white tiles behind the bar", "grey terrazzo bar top", "fresh bread on
  oak shelves", "fog-blue linen cushions", "opal glass pendants", "big shop windows"

### noir-jewel — Noir jewellery (boutique)
Smoked oak chevron, black marble, walnut and glass display cases, champagne bronze, cognac leather, pin-spot light.
- **prompt cues** "glass and walnut display cases", "black marble with white veining", "smoked oak chevron floor",
  "champagne bronze trims", "pin spots on each case", "cognac leather VIP lounge"

### green-studio — Green studio (workspace)
Natural cork and birch plywood, terracotta and sage, felt acoustics, a planted library wall, rounded edges.
- **prompt cues** "cork floor", "birch plywood desks", "planted shelving wall", "sage felt acoustic panels",
  "terracotta accents", "large windows with daylight"

### soft-clinic — Soft clinic (clinic)
Travertine tones, white oak and linen whites, soft bronze, curved corners, indirect glare-free light.
- **prompt cues** "curved white oak reception desk", "travertine-effect plaster wall", "ecru upholstered seating",
  "soft bronze details", "concealed cove lighting", "calm like a hotel lobby"

### barber-loft — Barber loft (salon)
Polished concrete, reclaimed brick, black steel and oiled oak, cognac leather barber chairs, filament light.
- **prompt cues** "polished concrete floor", "reclaimed brick wall", "black steel framed mirrors", "cognac leather
  barber chairs", "oiled oak stations", "filament pendants"
