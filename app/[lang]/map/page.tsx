import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import ProjectsMap, { type MapArea, type MapItem, type MapText } from "@/components/ProjectsMap";
import Reveal, { MaskLines } from "@/components/Reveal";
import { specsLine } from "@/lib/copy";
import { isLocale, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/meta";
import CITY from "@/public/tiles/buildings/index.json";
import { districtsIn } from "@/lib/districts";
import { landmarksIn } from "@/lib/landmarks";
import { placeOf } from "@/lib/places";
import { formatPrice, planLabel, publishedPlans } from "@/lib/plans";
import { visitorCurrency } from "@/lib/geo";

const TEXT: Record<Locale, MapText & { title: string; eyebrow: string; lead: string; count: (n: number) => string }> = {
  az: {
    title: "Layihələr xəritədə",
    mapLabel: "Layihələrin 3D xəritəsi",
    eyebrow: "Bakı · Abşeron · Azərbaycan",
    lead: "Hər konsept layihə adını aldığı yerdə: Bakının 3D xəritəsini fırladın, əyin, yaxınlaşdırın və nöqtəyə toxunaraq layihəni açın.",
    count: (n) => `Xəritədə ${n} layihə`,
    views: { baku: "Bakı", absheron: "Abşeron", country: "Azərbaycan" },
    kinds: { villa: "Villalar", interior: "İnteryerlər", project: "Layihələr" },
    areas: { baku: "Bakı", absheron: "Abşeron", regions: "Regionlar" },
    view: "Layihəyə bax",
    showOnMap: "Xəritədə göstər",
    rotate: "Fırlat",
    loading: "Xəritə yüklənir…",
    noMap: "Brauzeriniz 3D xəritəni göstərə bilmir — aşağıdakı siyahıdan istifadə edin.",
    note: "Nöqtələr layihənin adını aldığı qəsəbə və ya rayonun mərkəzini göstərir. Bütün layihələr konseptdir, tikilmiş ev deyil.",
    building: { city: "Bakı", home: "Bina", floors: "{n} mərtəbə", estimated: "≈ {n} mərtəbə (təxmini)", construction: "tikilir", soon: "Bu binanın mənzil planları və hazır dizaynları hazırlanır.", send: "Mənzil planınızı göndərin" },
  },
  en: {
    title: "Projects on the map",
    mapLabel: "3D map of the projects",
    eyebrow: "Baku · Absheron · Azerbaijan",
    lead: "Every concept project sits on the place it is named after. Rotate, tilt and zoom the 3D map of Baku and tap a point to open the project.",
    count: (n) => `${n} projects on the map`,
    views: { baku: "Baku", absheron: "Absheron", country: "Azerbaijan" },
    kinds: { villa: "Villas", interior: "Interiors", project: "Developments" },
    areas: { baku: "Baku", absheron: "Absheron", regions: "Regions" },
    view: "View project",
    showOnMap: "Show on map",
    rotate: "Rotate",
    loading: "Loading the map…",
    noMap: "Your browser cannot show the 3D map — use the list below.",
    note: "Points mark the centre of the town or district a project is named after. All projects are concepts, not built houses.",
    building: { city: "Baku", home: "Building", floors: "{n} floors", estimated: "≈ {n} floors (estimated)", construction: "under construction", soon: "Apartment plans and ready designs for this building are on the way.", send: "Send us your apartment plan" },
  },
  ru: {
    title: "Проекты на карте",
    mapLabel: "3D-карта проектов",
    eyebrow: "Баку · Апшерон · Азербайджан",
    lead: "Каждый концепт-проект отмечен там, в честь чего назван. Вращайте, наклоняйте и приближайте 3D-карту Баку и нажмите на точку, чтобы открыть проект.",
    count: (n) => `Проектов на карте: ${n}`,
    views: { baku: "Баку", absheron: "Апшерон", country: "Азербайджан" },
    kinds: { villa: "Виллы", interior: "Интерьеры", project: "Комплексы" },
    areas: { baku: "Баку", absheron: "Апшерон", regions: "Регионы" },
    view: "Открыть проект",
    showOnMap: "Показать на карте",
    rotate: "Вращать",
    loading: "Загрузка карты…",
    noMap: "Ваш браузер не может показать 3D-карту — воспользуйтесь списком ниже.",
    note: "Точки отмечают центр посёлка или района, в честь которого назван проект. Все проекты — концепты, а не построенные дома.",
    building: { city: "Баку", home: "Здание", floors: "{n} этажей", estimated: "≈ {n} этажей (оценка)", construction: "строится", soon: "Планировки квартир и готовые дизайны для этого дома готовятся.", send: "Пришлите планировку вашей квартиры" },
  },
};

const BAKU: [number, number] = [49.852, 40.378];

/** Baku city within ~12 km of the centre, the Absheron peninsula within ~45 km, the regions beyond. */
function areaOf([lng, lat]: [number, number]): MapArea {
  const dx = (lng - BAKU[0]) * 85;
  const dy = (lat - BAKU[1]) * 111;
  const km = Math.hypot(dx, dy);
  return km < 12 ? "baku" : km < 45 ? "absheron" : "regions";
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = TEXT[lang];
  return pageMetadata(lang, "/map", { title: t.title, description: t.lead });
}

export default async function MapPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = TEXT[lang];
  const cur = await visitorCurrency();
  const items: MapItem[] = [];
  for (const plan of publishedPlans()) {
    const lngLat = placeOf(plan.slug, plan.location);
    if (!lngLat) continue;
    items.push({
      slug: plan.slug,
      kind: plan.interior ? "interior" : plan.project ? "project" : "villa",
      area: areaOf(lngLat),
      title: plan.title[lang],
      label: planLabel(plan, lang),
      specs: specsLine(lang, plan),
      price: formatPrice(plan.priceCents, lang, cur),
      cover: plan.cover,
      href: `/${lang}/plans/${plan.slug}`,
      lngLat,
      ...(plan.model
        ? {
            model: {
              src: plan.model.src,
              bearing: plan.model.bearing,
              origin: placeOf(plan.slug, plan.model.origin) ?? lngLat,
              ...(plan.model.replaces?.length ? { replaces: plan.model.replaces } : {}),
              ...(plan.model.zoom !== undefined ? { zoom: plan.model.zoom } : {}),
            },
          }
        : {}),
    });
  }
  const { title, eyebrow, lead, count, ...text } = t;

  return (
    <>
      <Header locale={lang} path="/map" />
      <main className="map-page">
        <section className="wrap map-head">
          <Reveal variant="mask">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="section-title"><MaskLines lines={[title]} /></h1>
          </Reveal>
          <Reveal delay={150}>
            <p className="lead muted">{lead}</p>
            <p className="map-count">{count(items.length)}</p>
          </Reveal>
        </section>
        <section className="wrap-wide">
          <ProjectsMap items={items} districts={districtsIn(lang)} landmarks={landmarksIn(lang)}
            city={{ base: "/tiles/buildings", zoom: CITY.zoom, areas: CITY.areas.map((a) => ({ name: a.name, bounds: [a.bounds[0], a.bounds[1], a.bounds[2], a.bounds[3]] })) }} text={{ ...text, lang }} />
        </section>
      </main>
      <Footer locale={lang} />
    </>
  );
}
