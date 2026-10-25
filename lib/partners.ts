import type { Locale } from "./i18n";

/** Copy for the partners page (app/[lang]/partners). */
type Partners = {
  eyebrow: string;
  title: [string, string];
  lead: string;
  ourEyebrow: string;
  ourTitle: [string, string];
  avropa: { role: string; text: string; projects: string };
  whoEyebrow: string;
  whoTitle: [string, string];
  who: { title: string; text: string }[];
  joinTitle: [string, string];
  joinText: string;
  joinButton: string;
  joinSubject: string;
  contact: string;
};

export const PARTNERS: Record<Locale, Partners> = {
  az: {
    eyebrow: "Partnyorlar",
    title: ["Konsept layihədən", "tikilmiş evə"],
    lead: "havs.dev-in konsept layihələrini real evə çevirmək üçün memarlar, tikinti şirkətləri və təchizatçılarla əməkdaşlıq qururuq.",
    ourEyebrow: "Partnyorumuz",
    ourTitle: ["Bizimlə", "işləyən şirkət"],
    avropa: {
      role: "Qapı istehsalçısı",
      text: "Öz fabrikində qapı istehsal edir. havs.dev kataloqunda şirkətin ofis binası və fabriki üçün hazırlanmış layihələr var.",
      projects: "Şirkətin havs.dev-dəki layihələri",
    },
    whoEyebrow: "Kimləri axtarırıq",
    whoTitle: ["Partnyorluq", "istiqamətləri"],
    who: [
      { title: "Memarlar və mühəndislər", text: "Konsept paketin torpaq sahəsinə uyğunlaşdırılması, konstruktiv hesablamalar və icazə sənədləri." },
      { title: "Tikinti şirkətləri", text: "Paketi alan sifarişçilər üçün villanın tikintisi, smeta və iş qrafiki." },
      { title: "Material təchizatçıları", text: "Kataloqdakı layihələr üçün qapı, pəncərə, daş, dam örtüyü və fasad materialları." },
      { title: "Developer şirkətləri", text: "Yaşayış şəhərcikləri, taunhauslar və kommersiya obyektləri üçün layihələr." },
      { title: "İnteryer studiyaları", text: "Hazır interyer konsepsiyalarının mənzil və villalarda həyata keçirilməsi." },
      { title: "Daşınmaz əmlak agentlikləri", text: "Torpaq sahələrinin hazır villa layihəsi ilə birlikdə təklif edilməsi." },
    ],
    joinTitle: ["Partnyor", "olun"],
    joinText: "Şirkətinizin adını, fəaliyyət sahəsini və əlaqə məlumatlarını göndərin — sizinlə əlaqə saxlayaq.",
    joinButton: "Müraciət göndər",
    joinSubject: "Partnyorluq müraciəti",
    contact: "Əlaqə səhifəsi",
  },
  en: {
    eyebrow: "Partners",
    title: ["From a concept project", "to a finished house"],
    lead: "We are building partnerships with architects, construction companies and suppliers to turn havs.dev concept projects into real houses.",
    ourEyebrow: "Our partner",
    ourTitle: ["Who works", "with us"],
    avropa: {
      role: "Door manufacturer",
      text: "Makes doors at its own factory. The havs.dev catalogue includes the designs for the company's office building and factory.",
      projects: "The company's projects on havs.dev",
    },
    whoEyebrow: "Who we are looking for",
    whoTitle: ["Partnership", "areas"],
    who: [
      { title: "Architects and engineers", text: "Adapting the concept package to the plot, structural calculations and permit documents." },
      { title: "Construction companies", text: "Building the villa for clients who bought a package, with a cost estimate and a work schedule." },
      { title: "Material suppliers", text: "Doors, windows, stone, roofing and facade materials for the projects in the catalogue." },
      { title: "Developers", text: "Projects for residential villages, townhouses and commercial buildings." },
      { title: "Interior studios", text: "Carrying out the ready-made interior concepts in apartments and villas." },
      { title: "Real-estate agencies", text: "Offering plots together with a ready villa project." },
    ],
    joinTitle: ["Become", "a partner"],
    joinText: "Send us your company name, field of work and contact details, and we will get in touch.",
    joinButton: "Send a request",
    joinSubject: "Partnership enquiry",
    contact: "Contact page",
  },
  ru: {
    eyebrow: "Партнёры",
    title: ["От концептуального проекта", "к построенному дому"],
    lead: "Мы выстраиваем сотрудничество с архитекторами, строительными компаниями и поставщиками, чтобы концептуальные проекты havs.dev становились настоящими домами.",
    ourEyebrow: "Наш партнёр",
    ourTitle: ["Кто работает", "с нами"],
    avropa: {
      role: "Производитель дверей",
      text: "Производит двери на собственной фабрике. В каталоге havs.dev есть проекты, разработанные для офисного здания и фабрики компании.",
      projects: "Проекты компании на havs.dev",
    },
    whoEyebrow: "Кого мы ищем",
    whoTitle: ["Направления", "партнёрства"],
    who: [
      { title: "Архитекторы и инженеры", text: "Адаптация пакета проекта к участку, конструктивные расчёты и разрешительная документация." },
      { title: "Строительные компании", text: "Строительство виллы для заказчиков, купивших пакет, со сметой и графиком работ." },
      { title: "Поставщики материалов", text: "Двери, окна, камень, кровля и фасадные материалы для проектов из каталога." },
      { title: "Девелоперы", text: "Проекты посёлков, таунхаусов и коммерческих объектов." },
      { title: "Интерьерные студии", text: "Реализация готовых интерьерных концепций в квартирах и виллах." },
      { title: "Агентства недвижимости", text: "Продажа участков вместе с готовым проектом виллы." },
    ],
    joinTitle: ["Станьте", "партнёром"],
    joinText: "Отправьте название компании, сферу деятельности и контакты — мы свяжемся с вами.",
    joinButton: "Отправить заявку",
    joinSubject: "Заявка на партнёрство",
    contact: "Страница контактов",
  },
};
