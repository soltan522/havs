import type { Locale } from "./i18n";

/** UI copy for the catalogue, plan pages and motion labels (AZ / EN / RU). */
export const COPY = {
  az: {
    view: "Bax",
    catalogTitle: "Planlar kataloqu",
    catalogLead: "Villa və ev layihələri — hər biri aksonometriya, fasad və mərtəbə planları ilə.",
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
      "Bu nümunə konsept layihədir: vərəqlər konsept mərhələsinə aiddir və tikinti üçün nəzərdə tutulmayıb. Qiymət tam paket (PDF, DWG, CAD) üçün bazar qiymətlərinə əsasən göstərilib. Sifariş və fərdiləşdirmə üçün bizimlə əlaqə saxlayın.",
    contactToOrder: "Sifariş üçün əlaqə",
    sheets: "Konsept vərəqləri",
    sheetNames: ["Aksonometriya", "Ön fasad", "Birinci mərtəbə planı", "Yuxarı mərtəbə planı"],
    priceFrom: "Paket qiyməti",
  },
  en: {
    view: "View",
    catalogTitle: "Plan catalogue",
    catalogLead: "Villa and house projects — each with an axonometric view, front elevation and floor plans.",
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
      "This is a sample concept project: the sheets are concept-stage drawings and not for construction. The price reflects the full package (PDF, DWG, CAD) based on market rates. Contact us to order or customise it.",
    contactToOrder: "Contact to order",
    sheets: "Concept sheets",
    sheetNames: ["Axonometric", "Front elevation", "Ground floor plan", "Upper floor plan"],
    priceFrom: "Package price",
  },
  ru: {
    view: "Смотреть",
    catalogTitle: "Каталог проектов",
    catalogLead: "Проекты вилл и домов — с аксонометрией, фасадом и планами этажей.",
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
      "Это пример концептуального проекта: листы относятся к стадии концепции и не предназначены для строительства. Цена указана за полный пакет (PDF, DWG, CAD) по рыночным ставкам. Свяжитесь с нами, чтобы заказать или адаптировать проект.",
    contactToOrder: "Связаться для заказа",
    sheets: "Концептуальные листы",
    sheetNames: ["Аксонометрия", "Главный фасад", "План первого этажа", "План верхнего этажа"],
    priceFrom: "Цена пакета",
  },
} satisfies Record<Locale, unknown>;

/** "2 floors" / "1 floor" in the current language (AZ and RU labels do not change for the counts we use). */
export function floorsText(lang: Locale, n: number, label: string): string {
  if (lang === "en") return `${n} ${n === 1 ? "floor" : "floors"}`;
  return `${n} ${label.toLowerCase()}`;
}
