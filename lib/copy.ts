import type { Locale } from "./i18n";

/** UI copy for the catalogue, plan pages and motion labels (AZ / EN / RU). */
export const COPY = {
  az: {
    view: "Bax",
    zoom: "Böyüt",
    packageTitle: "Layihə paketi",
    packageFiles: { pdf: "Çertyojlar dəsti (PDF)", dwg: "AutoCAD (DWG)", cad: "CAD modeli (DXF)" },
    packageMeta: { pdf: (n: number) => `${n} vərəq · A3 · vektor`, dwg: "AutoCAD 2000 · qatlı", cad: "Qatlı · metr · A3 vərəqlər" },
    locked: "Ödənişdən sonra",
    unlockNote: "Fayllar ödəniş təsdiqləndikdən sonra sifariş səhifənizdə yüklənməyə açılır. Nümunə layihələr əlaqə vasitəsilə sifariş edilir.",
    unlockNotePaid: "Fayllar ödəniş təsdiqləndikdən dərhal sonra sifariş səhifənizdə yüklənməyə açılır.",
    close: "Bağla",
    catalogTitle: "Planlar kataloqu",
    catalogLead: "Lüks villa layihələri — hər biri konsept vizualizasiya, baş plan, mərtəbə planları, fasad və aksonometriya ilə.",
    allStyles: "Hamısı",
    floorsLabel: "Mərtəbə",
    anyFloors: "Hər hansı",
    sortLabel: "Sırala",
    sortPriceAsc: "Ucuzdan",
    sortPriceDesc: "Bahadan",
    sortArea: "Sahə",
    results: (n: number) => `${n} layihə`,
    empty: "Bu filtrə uyğun layihə yoxdur.",
    bathrooms: "Sanitar qovşaq",
    pool: "Hovuz",
    style: "Üslub",
    yes: "Var",
    no: "Yoxdur",
    sampleBadge: "Nümunə layihə",
    sampleNote:
      "Bu nümunə konsept layihədir: vizualizasiya ideyanı göstərir, vərəqlər konsept mərhələsinə aiddir və tikinti üçün nəzərdə tutulmayıb. Qiymət tam paket (PDF, DWG, CAD) üçün bazar qiymətlərinə əsasən göstərilib. Sifariş və fərdiləşdirmə üçün bizimlə əlaqə saxlayın.",
    contactToOrder: "Sifariş üçün əlaqə",
    sheets: "Konsept vərəqləri",
    sheetNames: { render: "Konsept vizualizasiya", image: "Təqdimat", site: "Baş plan", elevation: "Cənub fasadı", axonometric: "Aksonometriya", schedules: "Otaq, qapı və pəncərə cədvəlləri", plans: ["Birinci mərtəbə planı", "İkinci mərtəbə planı", "Üçüncü mərtəbə planı"] },
    priceFrom: "Paket qiyməti",
  },
  en: {
    view: "View",
    zoom: "Zoom",
    packageTitle: "Project package",
    packageFiles: { pdf: "Drawing set (PDF)", dwg: "AutoCAD (DWG)", cad: "CAD model (DXF)" },
    packageMeta: { pdf: (n: number) => `${n} sheets · A3 · vector`, dwg: "AutoCAD 2000 · layered", cad: "Layered · metres · A3 layouts" },
    locked: "After payment",
    unlockNote: "Files unlock on your order page once payment is confirmed. Sample projects are ordered through contact.",
    unlockNotePaid: "Files unlock on your order page as soon as payment is confirmed.",
    close: "Close",
    catalogTitle: "Plan catalogue",
    catalogLead: "Luxury villa projects — each with a concept visualisation, site plan, floor plans, elevation and axonometric view.",
    allStyles: "All",
    floorsLabel: "Floors",
    anyFloors: "Any",
    sortLabel: "Sort",
    sortPriceAsc: "Price ↑",
    sortPriceDesc: "Price ↓",
    sortArea: "Area",
    results: (n: number) => `${n} projects`,
    empty: "No projects match this filter.",
    bathrooms: "Bathrooms",
    pool: "Pool",
    style: "Style",
    yes: "Yes",
    no: "No",
    sampleBadge: "Sample project",
    sampleNote:
      "This is a sample concept project: the visualisation illustrates the design intent and the sheets are concept-stage drawings, not for construction. The price reflects the full package (PDF, DWG, CAD) based on market rates. Contact us to order or customise it.",
    contactToOrder: "Contact to order",
    sheets: "Concept sheets",
    sheetNames: { render: "Concept visualisation", image: "Presentation", site: "Site plan", elevation: "South elevation", axonometric: "Axonometric view", schedules: "Room, door and window schedules", plans: ["Ground floor plan", "First floor plan", "Second floor plan"] },
    priceFrom: "Package price",
  },
  ru: {
    view: "Смотреть",
    zoom: "Увеличить",
    packageTitle: "Пакет проекта",
    packageFiles: { pdf: "Комплект чертежей (PDF)", dwg: "AutoCAD (DWG)", cad: "CAD-модель (DXF)" },
    packageMeta: { pdf: (n: number) => `${n} листов · A3 · вектор`, dwg: "AutoCAD 2000 · по слоям", cad: "По слоям · метры · листы A3" },
    locked: "После оплаты",
    unlockNote: "Файлы откроются для скачивания на странице заказа после подтверждения оплаты. Примеры проектов заказываются через связь с нами.",
    unlockNotePaid: "Файлы откроются для скачивания на странице заказа сразу после подтверждения оплаты.",
    close: "Закрыть",
    catalogTitle: "Каталог проектов",
    catalogLead: "Проекты вилл класса люкс — с концептуальной визуализацией, генпланом, планами этажей, фасадом и аксонометрией.",
    allStyles: "Все",
    floorsLabel: "Этажи",
    anyFloors: "Любые",
    sortLabel: "Сортировка",
    sortPriceAsc: "Цена ↑",
    sortPriceDesc: "Цена ↓",
    sortArea: "Площадь",
    results: (n: number) => `${n} проектов`,
    empty: "Нет проектов по этому фильтру.",
    bathrooms: "Санузлы",
    pool: "Бассейн",
    style: "Стиль",
    yes: "Есть",
    no: "Нет",
    sampleBadge: "Пример проекта",
    sampleNote:
      "Это пример концептуального проекта: визуализация показывает замысел, а листы относятся к стадии концепции и не предназначены для строительства. Цена указана за полный пакет (PDF, DWG, CAD) по рыночным ставкам. Свяжитесь с нами, чтобы заказать или адаптировать проект.",
    contactToOrder: "Связаться для заказа",
    sheets: "Концептуальные листы",
    sheetNames: { render: "Концептуальная визуализация", image: "Презентация", site: "Генплан", elevation: "Южный фасад", axonometric: "Аксонометрия", schedules: "Экспликация, двери и окна", plans: ["План первого этажа", "План второго этажа", "План третьего этажа"] },
    priceFrom: "Цена пакета",
  },
} satisfies Record<Locale, unknown>;

type SheetNames = { render: string; image: string; site: string; elevation: string; axonometric: string; schedules: string; plans: string[] };

/** Human name of a gallery item, e.g. "First floor plan" for kind "plan-1". */
export function sheetName(names: SheetNames, kind: string): string {
  if (kind.startsWith("plan-")) return names.plans[Number(kind.slice(5))] ?? names.plans[names.plans.length - 1];
  return names[kind as keyof Omit<SheetNames, "plans">] ?? kind;
}

/** "2 floors" / "1 floor" in the current language (AZ and RU labels do not change for the counts we use). */
export function floorsText(lang: Locale, n: number, label: string): string {
  if (lang === "en") return `${n} ${n === 1 ? "floor" : "floors"}`;
  return `${n} ${label.toLowerCase()}`;
}
