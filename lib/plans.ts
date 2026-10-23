import type { Locale } from "./i18n";
import { PREVIEWS, type SheetKind } from "./previews.generated";
import { planPriceCents, pricedAreaM2, PRICE_PER_M2, type Currency } from "./pricing";
import PACKAGES from "@/data/packages.json";
import RAW from "@/data/plans.json";

export type LocalizedText = Record<Locale, string>;

export type PlanStyle =
  | "modern"
  | "tuscan"
  | "minimal"
  | "coastal"
  | "chalet"
  | "farmhouse"
  | "luxury"
  | "pavilion"
  | "mediterranean"
  | "duplex"
  | "absheron"
  | "noir"
  | "yali"
  | "townhouse"
  | "market"
  | "office"
  | "showroom"
  | "interior"
  | "bizcenter"
  | "hotel"
  | "restaurant"
  | "banquet"
  | "apartments"
  | "factory";

/**
 * row = terrace of townhouses on a street; farm = farmhouses around a vineyard and barn; cluster = houses on a slope
 * around a lodge; retail = one commercial building (supermarket) with its car park and delivery yard;
 * urban = a commercial building in town: a multi-storey showroom and office building on a corner plot, or a
 * roadside showroom with a mezzanine and forecourt parking. business, hotel, dining, events and residential = one
 * business centre, hotel, restaurant, wedding hall or apartment building on its plot (plan.layout, plan.facade).
 * industrial = a factory site with its halls, yards and offices, drawn outside the generator (plan.drawings "custom").
 */
export type ProjectKind = "row" | "farm" | "cluster" | "retail" | "urban" | "business" | "hotel" | "dining" | "events" | "residential" | "industrial";

/** Interior design projects: the kind of space and its design language (docs/design-references.md). */
export type InteriorType = "flat" | "penthouse" | "residence" | "cafe" | "workspace" | "boutique" | "clinic" | "salon";
export type InteriorPalette =
  | "baku-classic"
  | "japandi"
  | "scandi"
  | "luxury-dark"
  | "mediterranean-calm"
  | "oriental-modern"
  | "art-deco"
  | "industrial-loft"
  | "biophilic"
  | "mid-century"
  | "warm-minimal"
  | "nordic-cafe"
  | "noir-jewel"
  | "green-studio"
  | "soft-clinic"
  | "barber-loft";

export type { SheetKind };
export type GalleryItem = { src: string; kind: SheetKind };

export type Plan = {
  slug: string;
  style: PlanStyle;
  roof: "flat" | "hip" | "gable" | "frontgable";
  title: LocalizedText;
  summary: LocalizedText;
  areaM2: number;
  floors: number;
  bedrooms: number;
  bathrooms: number;
  garage: boolean;
  pool: boolean;
  /** Area × units × PRICE_PER_M2, in minor units; the same number in AZN and USD (lib/pricing.ts, checked by the validator). */
  priceCents: number;
  published: boolean;
  /** Concept project (AI-assisted visualisation and generated concept drawings): labelled as such on the site. */
  demo: boolean;
  /** Multi-unit project: area, rooms and floors describe one house; `units` houses are laid out on the masterplan. */
  project?: { kind: ProjectKind; units: number };
  /** Commercial buildings: parking bays on the masterplan (bedrooms is 0, bathrooms counts the WCs). */
  parking?: number;
  /** Commercial buildings: the drawn plan variant and the cladding (scripts/drawings.mjs). */
  layout?: string;
  facade?: string;
  /** Hotel guest rooms, restaurant / hall seats and apartment flats, as the drawings count them. */
  rooms?: number;
  seats?: number;
  flats?: number;
  /** Industrial buildings: workplaces the design is laid out for. */
  staff?: number;
  /** Area of the whole plot in m² (a site with several buildings: areaM2 is their gross floor area). */
  siteM2?: number;
  /**
   * "custom": the sheet set was drawn outside the generator (scripts/drawings.mjs STYLE_RULES custom). Its previews are
   * the watermarked sheets named by `sheetTitles` (in order), and the full set is supplied on request, not as a package.
   */
  drawings?: "custom";
  sheetTitles?: LocalizedText[];
  /** Owner's sign drawn on the building (their own name only). */
  sign?: string;
  /** Surveyed footprint [width, depth] in metres (buildings drawn from the owner's measured plans). */
  footprint?: [number, number];
  /** Map position [longitude, latitude] of the place the plan is named after (otherwise looked up in data/places.json). */
  location?: number[];
  /**
   * A detailed 3D model (glTF in public/models/) shown on the projects map: `origin` is where the model's origin stands
   * (the centre of its footprint; `location`, the map point, if left out) and `bearing` the way its front faces.
   * A model of a whole site also names the city-layer buildings it stands in place of (`replaces`, ids in
   * public/tiles/buildings) and the map zoom that fits it in the close-up (`zoom`).
   */
  model?: { src: string; bearing: number; origin?: number[]; replaces?: string[]; zoom?: number };
  /** Interior design project: the type of space, the design palette (style is "interior") and the plan variant (commercial spaces, three-bedroom apartments). */
  interior?: { type: InteriorType; palette: InteriorPalette; layout?: "a" | "b" };
  /** Concept visualisations followed by the drawing sheets. Generated by scripts/build-previews.mjs */
  gallery: GalleryItem[];
  /** Catalogue card images: the main visualisation, and the rendered elevation shown on hover. */
  cover: string;
  hover: string;
  /** Object keys inside the PRIVATE Supabase bucket. */
  files: { pdf: string; dwg: string; cad: string };
  /** The downloadable package (file names, sizes, sheet count), when it has been built. */
  package: PlanPackage | null;
};

export type PackageFile = { kind: "pdf" | "dwg" | "cad"; name: string; bytes: number; pages?: number };
export type PlanPackage = { files: PackageFile[]; sheets: number; builtAt: string };

type RawPlan = Omit<Plan, "gallery" | "files" | "cover" | "hover" | "package">;
const PACKAGE_INDEX = PACKAGES as Record<string, PlanPackage>;

/** Bucket keys: generated packages use their real file names, hand-uploaded plans the plan.* convention. */
function fileKeys(slug: string, pkg: PlanPackage | undefined) {
  const named = (kind: PackageFile["kind"], fallback: string) => `${slug}/${pkg?.files.find((f) => f.kind === kind)?.name ?? fallback}`;
  return { pdf: named("pdf", "plan.pdf"), dwg: named("dwg", "plan.dwg"), cad: named("cad", "plan.cad") };
}

// Catalogue lives in data/plans.json so the preview script can read the same data.
export const PLANS: Plan[] = (RAW as RawPlan[]).map((p) => ({
  ...p,
  priceCents: planPriceCents(p),
  gallery: PREVIEWS[p.slug]?.sheets ?? [],
  cover: PREVIEWS[p.slug]?.cover ?? "",
  hover: PREVIEWS[p.slug]?.hover ?? "",
  files: fileKeys(p.slug, PACKAGE_INDEX[p.slug]),
  package: PACKAGE_INDEX[p.slug] ?? null,
}));

export const STYLE_LABELS: Record<PlanStyle, LocalizedText> = {
  modern: { az: "Müasir", en: "Modern", ru: "Современный" },
  tuscan: { az: "Toskana", en: "Tuscan", ru: "Тосканский" },
  minimal: { az: "Minimalist", en: "Minimalist", ru: "Минимализм" },
  coastal: { az: "Dəniz kənarı", en: "Coastal", ru: "У моря" },
  chalet: { az: "Şale", en: "Chalet", ru: "Шале" },
  farmhouse: { az: "Bağ evi", en: "Farmhouse", ru: "Фермерский" },
  luxury: { az: "Müasir lüks", en: "Contemporary luxury", ru: "Современный люкс" },
  pavilion: { az: "Pavilyon", en: "Pavilion", ru: "Павильон" },
  mediterranean: { az: "Aralıq dənizi", en: "Mediterranean", ru: "Средиземноморский" },
  duplex: { az: "Dupleks", en: "Duplex", ru: "Дуплекс" },
  absheron: { az: "Abşeron müasir", en: "Absheron contemporary", ru: "Апшеронский модерн" },
  noir: { az: "Tünd müasir", en: "Noir contemporary", ru: "Тёмный модерн" },
  yali: { az: "Bosfor yalısı", en: "Bosphorus yalı", ru: "Ялы (Босфор)" },
  townhouse: { az: "Taunhaus", en: "Townhouse", ru: "Таунхаус" },
  market: { az: "Supermarket", en: "Supermarket", ru: "Супермаркет" },
  office: { az: "Ofis və şourum", en: "Office and showroom", ru: "Офис и шоурум" },
  showroom: { az: "Şourum", en: "Showroom", ru: "Шоурум" },
  interior: { az: "İnteryer dizaynı", en: "Interior design", ru: "Дизайн интерьера" },
  bizcenter: { az: "İş mərkəzi", en: "Business centre", ru: "Бизнес-центр" },
  hotel: { az: "Otel", en: "Hotel", ru: "Отель" },
  restaurant: { az: "Restoran", en: "Restaurant", ru: "Ресторан" },
  banquet: { az: "Şadlıq sarayı", en: "Wedding hall", ru: "Банкетный зал" },
  apartments: { az: "Yaşayış binası", en: "Apartment building", ru: "Жилой дом" },
  factory: { az: "Zavod", en: "Factory", ru: "Завод" },
};

export const INTERIOR_TYPE_LABELS: Record<InteriorType, LocalizedText> = {
  flat: { az: "Mənzil interyeri", en: "Apartment interior", ru: "Интерьер квартиры" },
  penthouse: { az: "Penthaus interyeri", en: "Penthouse interior", ru: "Интерьер пентхауса" },
  residence: { az: "Villa interyeri", en: "Villa interior", ru: "Интерьер виллы" },
  cafe: { az: "Kafe interyeri", en: "Café interior", ru: "Интерьер кафе" },
  workspace: { az: "Ofis interyeri", en: "Office interior", ru: "Интерьер офиса" },
  boutique: { az: "Butik interyeri", en: "Boutique interior", ru: "Интерьер бутика" },
  clinic: { az: "Klinika interyeri", en: "Clinic interior", ru: "Интерьер клиники" },
  salon: { az: "Salon interyeri", en: "Salon interior", ru: "Интерьер салона" },
};

export const PALETTE_LABELS: Record<InteriorPalette, LocalizedText> = {
  "baku-classic": { az: "Bakı klassikası", en: "Baku classic", ru: "Бакинская классика" },
  japandi: { az: "Japandi", en: "Japandi", ru: "Джапанди" },
  scandi: { az: "Skandinav", en: "Scandinavian", ru: "Скандинавский" },
  "luxury-dark": { az: "Tünd lüks", en: "Dark luxury", ru: "Тёмный люкс" },
  "mediterranean-calm": { az: "Aralıq dənizi", en: "Mediterranean", ru: "Средиземноморский" },
  "oriental-modern": { az: "Azərbaycan müasir", en: "Azerbaijani modern", ru: "Азербайджанский модерн" },
  "art-deco": { az: "Art-deko", en: "Art Deco", ru: "Ар-деко" },
  "industrial-loft": { az: "İndustrial loft", en: "Industrial loft", ru: "Индустриальный лофт" },
  biophilic: { az: "Biofilik", en: "Biophilic", ru: "Биофильный" },
  "mid-century": { az: "Mid-century", en: "Mid-century", ru: "Мид-сенчури" },
  "warm-minimal": { az: "İsti minimalizm", en: "Warm minimal", ru: "Тёплый минимализм" },
  "nordic-cafe": { az: "Nordik kafe", en: "Nordic café", ru: "Скандинавское кафе" },
  "noir-jewel": { az: "Tünd zərgərlik", en: "Noir jewellery", ru: "Ювелирный нуар" },
  "green-studio": { az: "Yaşıl studiya", en: "Green studio", ru: "Зелёная студия" },
  "soft-clinic": { az: "Yumşaq klinika", en: "Soft clinic", ru: "Мягкая клиника" },
  "barber-loft": { az: "Bərbər loftu", en: "Barber loft", ru: "Барбер-лофт" },
};

const COMMERCIAL_INTERIORS: InteriorType[] = ["cafe", "workspace", "boutique", "clinic", "salon"];

export const PROJECT_LABELS: Record<ProjectKind, LocalizedText> = {
  row: { az: "Taunhaus layihəsi", en: "Townhouse project", ru: "Проект таунхаусов" },
  farm: { az: "Ferma kompleksi", en: "Farm estate", ru: "Фермерская усадьба" },
  cluster: { az: "Kənd layihəsi", en: "Village project", ru: "Коттеджный посёлок" },
  retail: { az: "Kommersiya layihəsi", en: "Commercial project", ru: "Коммерческий проект" },
  urban: { az: "Kommersiya binası", en: "Commercial building", ru: "Коммерческое здание" },
  business: { az: "İş mərkəzi", en: "Business centre", ru: "Бизнес-центр" },
  hotel: { az: "Otel", en: "Hotel", ru: "Отель" },
  dining: { az: "Restoran", en: "Restaurant", ru: "Ресторан" },
  events: { az: "Şadlıq sarayı", en: "Wedding hall", ru: "Банкетный зал" },
  residential: { az: "Yaşayış binası", en: "Apartment building", ru: "Жилой дом" },
  industrial: { az: "Sənaye binası", en: "Industrial building", ru: "Производственное здание" },
};

/** Eyebrow label of a plan: its style, or the kind of multi-unit project. */
export const planLabel = (plan: Plan, lang: Locale) =>
  plan.interior ? `${INTERIOR_TYPE_LABELS[plan.interior.type][lang]} · ${PALETTE_LABELS[plan.interior.palette][lang]}` : plan.project ? PROJECT_LABELS[plan.project.kind][lang] : STYLE_LABELS[plan.style][lang];

/** "180 m²" for a villa or a single building, "7 × 180 m²" for a project of seven houses. */
export const areaText = (plan: Plan) => `${plan.project && plan.project.units > 1 ? `${plan.project.units} × ` : ""}${plan.areaM2} m²`;

/** A commercial building (no bedrooms; WCs and parking instead). */
export const isCommercial = (plan: Plan) => ["retail", "urban", "business", "hotel", "dining", "events", "industrial"].includes(plan.project?.kind ?? "");

/** Drawn outside the generator: the sheet set is supplied on request, so the page promises no package download. */
export const isCustomDrawn = (plan: Plan) => plan.drawings === "custom";

/** An apartment building (flats, bedrooms and parking). */
export const isResidential = (plan: Plan) => plan.project?.kind === "residential";

/** An interior design project of a commercial space (WCs instead of bedrooms). */
export const isCommercialInterior = (plan: Plan) => !!plan.interior && COMMERCIAL_INTERIORS.includes(plan.interior.type);

export const coverOf = (plan: Plan) => plan.cover || plan.gallery[0]?.src;

/** The files a buyer receives and their bucket keys: the built package, or all three for a hand-uploaded plan. */
export function deliverables(plan: Plan): { kind: PackageFile["kind"]; key: string }[] {
  const kinds = plan.package ? plan.package.files.map((f) => f.kind) : (["pdf", "dwg", "cad"] as const);
  return kinds.map((kind) => ({ kind, key: plan.files[kind] }));
}

// A plan is listed only once its preview images exist (npm run previews), so a half-added plan never shows up broken.
export const publishedPlans = () => PLANS.filter((p) => p.published && p.cover);
export const findPlan = (slug: string) => publishedPlans().find((p) => p.slug === slug);

const intlLocale = (locale: Locale) => (locale === "az" ? "az-AZ" : locale === "ru" ? "ru-RU" : "en-US");

/** A large figure grouped the local way: "23,255" (en), "23.255" (az), "23 255" (ru). */
export const formatNumber = (n: number, locale: Locale) => new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(n);

/** Manat with the code, as customers in Azerbaijan expect ("9.000 AZN" in az); dollars as "$9,000" (en) or "9.000 $" (az). */
export function formatPrice(cents: number, locale: Locale, currency: string): string {
  if (currency === "AZN") return `${new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(cents / 100)} AZN`;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** How the price is made up: "1 260 m² × 30 AZN/m²" (all houses of a multi-unit project). */
export function priceBasis(plan: Plan, locale: Locale, currency: Currency): string {
  const area = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(pricedAreaM2(plan));
  const rate = formatPrice(PRICE_PER_M2 * 100, locale, currency);
  return `${area} m² × ${rate}/m²`;
}
