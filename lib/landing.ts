import type { Locale } from "./i18n";

type Landing = {
  eyebrow: string;
  heroLines: [string, string, string];
  heroText: string;
  ctaPrimary: string;
  ctaSecondary: string;
  scroll: string;
  stats: { plans: string; formats: string; languages: string };
  marquee: string[];
  statement: string;
  featuredEyebrow: string;
  featuredTitle: [string, string];
  viewAll: string;
  processEyebrow: string;
  processTitle: [string, string];
  steps: { title: string; text: string }[];
  stylesEyebrow: string;
  stylesTitle: [string, string];
  plansWord: (n: number) => string;
  whyEyebrow: string;
  whyTitle: [string, string];
  why: { title: string; text: string }[];
  ctaTitle: [string, string];
  ctaText: string;
  ctaButton: string;
};

export const LANDING: Record<Locale, Landing> = {
  az: {
    eyebrow: "Memarlıq studiyası",
    heroLines: ["Hər evin", "əsas planı", "buradan başlayır."],
    heroText: "Villa layihələri və exterior dizaynlar — memarlar tərəfindən hazırlanmış, PDF, DWG və CAD formatlarında.",
    ctaPrimary: "Kataloqa bax",
    ctaSecondary: "Necə işləyir",
    scroll: "Aşağı",
    stats: { plans: "layihə", formats: "format", languages: "dil" },
    marquee: ["Villa planları", "Exterior dizayn", "Aksonometriya", "Fasad", "DWG", "CAD", "PDF"],
    statement:
      "Biz evi kağız üzərində başlayırıq: düzgün plan, dəqiq ölçü və işığa açıq məkanlar. Hər layihə yaşamaq üçün düşünülüb — sonra isə sizin torpağınıza uyğunlaşdırılır.",
    featuredEyebrow: "Seçilmiş layihələr",
    featuredTitle: ["Kataloqdan", "seçmələr"],
    viewAll: "Bütün kataloq",
    processEyebrow: "Proses",
    processTitle: ["Plandan", "evə qədər"],
    steps: [
      { title: "Layihəni seçin", text: "Üslub, sahə və mərtəbə sayına görə kataloqa baxın. Hər layihədə aksonometriya, fasad və planlar var." },
      { title: "Uyğunlaşdırın", text: "Torpaq sahəniz, iqlim və ehtiyaclarınıza görə dəyişikliklər üçün memarlarımızla əlaqə saxlayın." },
      { title: "Faylları alın", text: "Tam paket — PDF çertyojlar, redaktə edilə bilən DWG və CAD faylları — sifariş səhifənizdə." },
    ],
    stylesEyebrow: "Üslublar",
    stylesTitle: ["Hər zövqə", "uyğun forma"],
    plansWord: (n) => `${n} layihə`,
    whyEyebrow: "Niyə havs.dev",
    whyTitle: ["Dəqiqlik,", "detallarda"],
    why: [
      { title: "Peşəkar çertyojlar", text: "Ox şəbəkəsi, ölçü zəncirləri, divar qalınlıqları və mebel yerləşdirməsi ilə tam sənədləşdirilmiş planlar." },
      { title: "Üç format", text: "Təqdimat üçün PDF, redaktə üçün DWG və CAD — bir paketdə." },
      { title: "Uyğunlaşdırma", text: "Hər layihə sahənizə, iqliminizə və büdcənizə görə dəyişdirilə bilər." },
    ],
    ctaTitle: ["Layihənizi", "bu gün başlayın."],
    ctaText: "Kataloqdan bəyəndiyiniz planı seçin və ya fərdi layihə üçün bizimlə əlaqə saxlayın.",
    ctaButton: "Kataloqa keç",
  },
  en: {
    eyebrow: "Architecture studio",
    heroLines: ["Every home", "begins with", "the right plan."],
    heroText: "Villa projects and exterior designs prepared by architects — delivered as PDF, DWG and CAD.",
    ctaPrimary: "Browse catalogue",
    ctaSecondary: "How it works",
    scroll: "Scroll",
    stats: { plans: "projects", formats: "formats", languages: "languages" },
    marquee: ["Villa plans", "Exterior design", "Axonometric", "Elevation", "DWG", "CAD", "PDF"],
    statement:
      "We start every home on paper: a sound plan, precise dimensions and rooms open to daylight. Each project is designed to be lived in — and then adapted to your site.",
    featuredEyebrow: "Featured projects",
    featuredTitle: ["Selected", "from the catalogue"],
    viewAll: "Full catalogue",
    processEyebrow: "Process",
    processTitle: ["From plan", "to home"],
    steps: [
      { title: "Choose a project", text: "Browse by style, area and number of floors. Every project includes an axonometric view, elevation and plans." },
      { title: "Adapt it", text: "Talk to our architects about changes for your site, climate and brief." },
      { title: "Get the files", text: "The full package — PDF drawings plus editable DWG and CAD files — on your order page." },
    ],
    stylesEyebrow: "Styles",
    stylesTitle: ["A form", "for every taste"],
    plansWord: (n) => `${n} ${n === 1 ? "project" : "projects"}`,
    whyEyebrow: "Why havs.dev",
    whyTitle: ["Precision", "in the details"],
    why: [
      { title: "Professional drawings", text: "Fully documented plans with structural grids, dimension chains, wall thicknesses and furniture layouts." },
      { title: "Three formats", text: "PDF for presentation, DWG and CAD for editing — in one package." },
      { title: "Adaptation", text: "Every project can be adapted to your site, climate and budget." },
    ],
    ctaTitle: ["Start your project", "today."],
    ctaText: "Pick a plan from the catalogue or contact us for a bespoke design.",
    ctaButton: "Go to catalogue",
  },
  ru: {
    eyebrow: "Архитектурная студия",
    heroLines: ["Каждый дом", "начинается", "с верного плана."],
    heroText: "Проекты вилл и экстерьерные дизайны от архитекторов — в форматах PDF, DWG и CAD.",
    ctaPrimary: "Смотреть каталог",
    ctaSecondary: "Как это работает",
    scroll: "Вниз",
    stats: { plans: "проектов", formats: "формата", languages: "языка" },
    marquee: ["Проекты вилл", "Экстерьер", "Аксонометрия", "Фасад", "DWG", "CAD", "PDF"],
    statement:
      "Мы начинаем каждый дом на бумаге: продуманный план, точные размеры и помещения, открытые свету. Каждый проект создан для жизни — а затем адаптируется под ваш участок.",
    featuredEyebrow: "Избранные проекты",
    featuredTitle: ["Подборка", "из каталога"],
    viewAll: "Весь каталог",
    processEyebrow: "Процесс",
    processTitle: ["От плана", "до дома"],
    steps: [
      { title: "Выберите проект", text: "Фильтруйте по стилю, площади и этажности. В каждом проекте — аксонометрия, фасад и планы." },
      { title: "Адаптируйте", text: "Обсудите с нашими архитекторами изменения под ваш участок, климат и задачи." },
      { title: "Получите файлы", text: "Полный пакет — чертежи PDF и редактируемые файлы DWG и CAD — на странице заказа." },
    ],
    stylesEyebrow: "Стили",
    stylesTitle: ["Форма", "на любой вкус"],
    plansWord: (n) => `${n} проект${n === 1 ? "" : n < 5 ? "а" : "ов"}`,
    whyEyebrow: "Почему havs.dev",
    whyTitle: ["Точность", "в деталях"],
    why: [
      { title: "Профессиональные чертежи", text: "Полностью оформленные планы с осями, размерными цепочками, толщинами стен и расстановкой мебели." },
      { title: "Три формата", text: "PDF для презентации, DWG и CAD для редактирования — в одном пакете." },
      { title: "Адаптация", text: "Любой проект можно адаптировать под ваш участок, климат и бюджет." },
    ],
    ctaTitle: ["Начните свой проект", "сегодня."],
    ctaText: "Выберите проект в каталоге или свяжитесь с нами для индивидуального проектирования.",
    ctaButton: "В каталог",
  },
};
