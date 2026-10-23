export const LOCALES = ["az", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "az";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export const UI = {
  az: {
    siteName: "havs.dev",
    tagline: "Villa layihələri və exterior dizaynlar — PDF, DWG və CAD formatlarında",
    catalog: "Planlar",
    includes: "Paketə daxildir",
    formats: "PDF, DWG, CAD",
    area: "Sahə",
    floors: "Mərtəbə",
    bedrooms: "Yataq otağı",
    garage: "Qaraj",
    garageYes: "Var",
    garageNo: "Yoxdur",
    yes: "Bəli",
    no: "Xeyr",
    backToCatalog: "← Bütün planlar",
    download: "Yüklə",
    orderNotFound: "Sifariş tapılmadı",
    footer: "© havs.dev — bütün hüquqlar qorunur",
  },
  en: {
    siteName: "havs.dev",
    tagline: "Villa projects and exterior designs — delivered as PDF, DWG and CAD",
    catalog: "Plans",
    includes: "Included in the package",
    formats: "PDF, DWG, CAD",
    area: "Area",
    floors: "Floors",
    bedrooms: "Bedrooms",
    garage: "Garage",
    garageYes: "Yes",
    garageNo: "No",
    yes: "Yes",
    no: "No",
    backToCatalog: "← All plans",
    download: "Download",
    orderNotFound: "Order not found",
    footer: "© havs.dev — all rights reserved",
  },
  ru: {
    siteName: "havs.dev",
    tagline: "Проекты вилл и экстерьерные дизайны — в форматах PDF, DWG и CAD",
    catalog: "Проекты",
    includes: "Входит в пакет",
    formats: "PDF, DWG, CAD",
    area: "Площадь",
    floors: "Этажи",
    bedrooms: "Спальни",
    garage: "Гараж",
    garageYes: "Есть",
    garageNo: "Нет",
    yes: "Да",
    no: "Нет",
    backToCatalog: "← Все проекты",
    download: "Скачать",
    orderNotFound: "Заказ не найден",
    footer: "© havs.dev — все права защищены",
  },
} as const;

export type UIStrings = (typeof UI)[Locale];
