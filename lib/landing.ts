import type { Locale } from "./i18n";

type Landing = {
  eyebrow: string;
  heroTitle: [string, string];
  heroText: string;
  ctaPrimary: string;
  ctaSecondary: string;
  marquee: string[];
  featuredTitle: string;
  featuredText: string;
  viewAll: string;
  processTitle: string;
  steps: { title: string; text: string }[];
  whyTitle: string;
  why: { title: string; text: string }[];
  ctaTitle: string;
  ctaText: string;
  ctaButton: string;
};

export const LANDING: Record<Locale, Landing> = {
  az: {
    eyebrow: "Memarlıq · Villa layihələri",
    heroTitle: ["Hər evin", "əsas planı burada"],
    heroText: "Villa layihələri və exterior dizaynlar, peşəkar memarlar tərəfindən hazırlanıb. PDF, DWG və CAD formatlarında, dərhal yükləmə ilə.",
    ctaPrimary: "Planlara bax",
    ctaSecondary: "Necə işləyir",
    marquee: ["Villa planları", "Exterior dizayn", "PDF", "DWG", "CAD", "Dərhal yükləmə", "Təhlükəsiz ödəniş"],
    featuredTitle: "Seçilmiş layihələr",
    featuredText: "Hər layihə sahə, mərtəbə və otaq planı ilə tam sənədləşdirilib.",
    viewAll: "Bütün planlar →",
    processTitle: "Üç addımda",
    steps: [
      { title: "Layihəni seçin", text: "Sahə, mərtəbə və stilə görə planlara baxın." },
      { title: "Ödəyin", text: "Kartla, PayPal və ya bank köçürməsi ilə təhlükəsiz ödəniş." },
      { title: "Yükləyin", text: "PDF, DWG və CAD fayllarını dərhal sifariş səhifənizdən götürün." },
    ],
    whyTitle: "Niyə havs.dev",
    why: [
      { title: "Peşəkar sənədlər", text: "Hər plan tikintiyə hazır təqdimat və ölçülərlə hazırlanıb." },
      { title: "Üç format", text: "Vizualizasiya üçün PDF, redaktə üçün DWG və CAD birlikdə." },
      { title: "Ömürlük giriş", text: "Sifarişiniz hesabınızda qalır, fayllarınızı istənilən vaxt yükləyə bilərsiniz." },
    ],
    ctaTitle: "Layihənizi bu gün başlayın",
    ctaText: "Bəyəndiyiniz planı seçin, bir neçə dəqiqədə fayllarınız hazırdır.",
    ctaButton: "Planlara keç",
  },
  en: {
    eyebrow: "Architecture · Villa projects",
    heroTitle: ["The foundation", "of every home"],
    heroText: "Villa projects and exterior designs prepared by professional architects. Delivered as PDF, DWG and CAD for instant download.",
    ctaPrimary: "Browse plans",
    ctaSecondary: "How it works",
    marquee: ["Villa plans", "Exterior design", "PDF", "DWG", "CAD", "Instant download", "Secure payment"],
    featuredTitle: "Featured projects",
    featuredText: "Every project comes with a full set of area, floor and room information.",
    viewAll: "All plans →",
    processTitle: "In three steps",
    steps: [
      { title: "Choose a project", text: "Browse plans by area, floors and style." },
      { title: "Pay securely", text: "Card, PayPal or bank transfer." },
      { title: "Download", text: "Get PDF, DWG and CAD files from your order page right away." },
    ],
    whyTitle: "Why havs.dev",
    why: [
      { title: "Professional documents", text: "Every plan is prepared with construction-ready drawings and dimensions." },
      { title: "Three formats", text: "PDF for presentation, DWG and CAD for editing, all in one purchase." },
      { title: "Lasting access", text: "Your orders stay in your account, so you can download files whenever you need." },
    ],
    ctaTitle: "Start your project today",
    ctaText: "Pick the plan you like and your files are ready in minutes.",
    ctaButton: "Go to plans",
  },
  ru: {
    eyebrow: "Архитектура · Проекты вилл",
    heroTitle: ["Основа каждого", "дома — здесь"],
    heroText: "Проекты вилл и экстерьерные дизайны от профессиональных архитекторов. PDF, DWG и CAD с мгновенным скачиванием.",
    ctaPrimary: "Смотреть проекты",
    ctaSecondary: "Как это работает",
    marquee: ["Проекты вилл", "Экстерьер", "PDF", "DWG", "CAD", "Мгновенное скачивание", "Безопасная оплата"],
    featuredTitle: "Избранные проекты",
    featuredText: "Каждый проект включает полную информацию о площади, этажах и комнатах.",
    viewAll: "Все проекты →",
    processTitle: "В три шага",
    steps: [
      { title: "Выберите проект", text: "Смотрите проекты по площади, этажам и стилю." },
      { title: "Оплатите", text: "Картой, PayPal или банковским переводом." },
      { title: "Скачайте", text: "Файлы PDF, DWG и CAD — сразу на странице заказа." },
    ],
    whyTitle: "Почему havs.dev",
    why: [
      { title: "Профессиональная документация", text: "Каждый проект готов к строительству, с размерами и чертежами." },
      { title: "Три формата", text: "PDF для презентации, DWG и CAD для редактирования — в одной покупке." },
      { title: "Постоянный доступ", text: "Заказы остаются в вашем аккаунте, файлы можно скачать в любой момент." },
    ],
    ctaTitle: "Начните свой проект сегодня",
    ctaText: "Выберите понравившийся проект, и файлы будут готовы за несколько минут.",
    ctaButton: "К проектам",
  },
};
