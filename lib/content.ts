import type { Locale } from "./i18n";

export type InfoPageKey = "about" | "faq" | "contact" | "terms" | "privacy";

type Section = { heading: string; body: string[] };
type Page = { title: string; intro: string; sections: Section[] };

// Draft copy. Legal pages (terms, privacy) must be reviewed by a lawyer before launch.
export const PAGES: Record<InfoPageKey, Record<Locale, Page>> = {
  about: {
    az: {
      title: "Haqqımızda",
      intro: "havs.dev — villa layihələri və exterior dizaynların onlayn platformasıdır. Hər plan arxitektorlarımız tərəfindən hazırlanır və sizə istifadəyə hazır formatda təqdim olunur.",
      sections: [
        { heading: "Nə təklif edirik", body: ["Villa planları və exterior dizaynlar, PDF, DWG və CAD formatlarında.", "Hər layihə üçün sahə, mərtəbə, otaq və qaraj məlumatı."] },
        { heading: "Necə işləyir", body: ["Planı seçin və ödəniş üsulunu təyin edin.", "Ödənişdən sonra bütün fayllar sifariş səhifənizdə açılır."] },
      ],
    },
    en: {
      title: "About us",
      intro: "havs.dev is an online marketplace for villa projects and exterior designs. Every plan is prepared by our architects and delivered in ready-to-use formats.",
      sections: [
        { heading: "What we offer", body: ["Villa plans and exterior designs in PDF, DWG and CAD formats.", "Area, floors, rooms and garage information for every project."] },
        { heading: "How it works", body: ["Choose a plan and a payment method.", "After payment, all files are available on your order page."] },
      ],
    },
    ru: {
      title: "О нас",
      intro: "havs.dev — онлайн-платформа проектов вилл и экстерьерных дизайнов. Каждый проект подготовлен нашими архитекторами и выдаётся в готовых к использованию форматах.",
      sections: [
        { heading: "Что мы предлагаем", body: ["Проекты вилл и экстерьерные дизайны в форматах PDF, DWG и CAD.", "Площадь, этажи, комнаты и информация о гараже для каждого проекта."] },
        { heading: "Как это работает", body: ["Выберите проект и способ оплаты.", "После оплаты все файлы доступны на странице вашего заказа."] },
      ],
    },
  },
  faq: {
    az: {
      title: "Tez-tez verilən suallar",
      intro: "Ən çox verilən sualların cavabları.",
      sections: [
        { heading: "Hansı formatlar alıram?", body: ["Hər planla birlikdə PDF, DWG və CAD faylları verilir."] },
        { heading: "Hansı ödəniş üsulları var?", body: ["Ödəniş səhifəsində aktiv olan üsullar göstərilir: bank kartı (Visa, Mastercard), Apple Pay, Google Pay, PayPal, kriptovalyuta (USDT, BTC, ETH və s.) və bank köçürməsi. Azərbaycandan qiymətlər manatla göstərilir və manatla ödənilir, ona görə yalnız manat qəbul edən üsullar təklif olunur. Kart məlumatları havs.dev-də saxlanılmır."] },
        { heading: "Ödənişdən sonra nə olur?", body: ["Fayllar ödəniş təsdiqlənən kimi sifariş səhifənizdə açılır. Kripto ödənişdə şəbəkə təsdiqindən sonra (adətən 5–30 dəqiqə), bank köçürməsində isə ödəniş təsdiqləndikdən sonra açılır."] },
        { heading: "Faylları neçə dəfə yükləyə bilərəm?", body: ["Yükləmə linkləri müvəqqətidir. Lazım olduqda sifariş səhifənizə qayıdıb yenidən yükləyə bilərsiniz."] },
        { heading: "Planı dəyişdirmək olar?", body: ["Planı tikintiyə uyğunlaşdırmaq üçün xidmət təklif edirik. Əlaqə səhifəsindən müraciət edin."] },
      ],
    },
    en: {
      title: "FAQ",
      intro: "Answers to the most common questions.",
      sections: [
        { heading: "Which formats do I get?", body: ["Each plan includes PDF, DWG and CAD files."] },
        { heading: "Which payment methods can I use?", body: ["The checkout shows the methods that are switched on: bank card (Visa, Mastercard), Apple Pay, Google Pay, PayPal, cryptocurrency (USDT, BTC, ETH and more) and bank transfer. Visitors in Azerbaijan see and pay prices in manat (AZN), so they are offered only the methods that take manat. havs.dev never stores card details."] },
        { heading: "What happens after payment?", body: ["Files open on your order page as soon as the payment is confirmed. Crypto payments open after the network confirmation (usually 5–30 minutes); bank transfers once the payment is confirmed."] },
        { heading: "Can I download the files more than once?", body: ["Download links are temporary. You can return to your order page and download again whenever you need."] },
        { heading: "Can the plan be adapted?", body: ["We offer adaptation services for your site. Contact us through the contact page."] },
      ],
    },
    ru: {
      title: "Часто задаваемые вопросы",
      intro: "Ответы на самые частые вопросы.",
      sections: [
        { heading: "Какие форматы я получу?", body: ["Каждый проект включает файлы PDF, DWG и CAD."] },
        { heading: "Какие способы оплаты доступны?", body: ["На странице оплаты показаны подключённые способы: банковская карта (Visa, Mastercard), Apple Pay, Google Pay, PayPal, криптовалюта (USDT, BTC, ETH и другие) и банковский перевод. Посетителям из Азербайджана цены показываются и оплачиваются в манатах (AZN), поэтому им предлагаются только способы, принимающие манаты. havs.dev не хранит данные карт."] },
        { heading: "Что происходит после оплаты?", body: ["Файлы открываются на странице заказа сразу после подтверждения оплаты. Криптоплатёж — после подтверждения в сети (обычно 5–30 минут), банковский перевод — после подтверждения оплаты."] },
        { heading: "Можно ли скачать файлы несколько раз?", body: ["Ссылки для скачивания временные. Вы можете вернуться на страницу заказа и скачать файлы снова."] },
        { heading: "Можно ли адаптировать проект?", body: ["Мы предлагаем услуги адаптации под ваш участок. Свяжитесь с нами через страницу контактов."] },
      ],
    },
  },
  contact: {
    az: {
      title: "Əlaqə",
      intro: "Suallarınız və ya layihə adaptasiyası üçün bizimlə əlaqə saxlayın.",
      sections: [{ heading: "E-poçt", body: ["__EMAIL__"] }],
    },
    en: {
      title: "Contact",
      intro: "Contact us with questions or for project adaptation.",
      sections: [{ heading: "E-mail", body: ["__EMAIL__"] }],
    },
    ru: {
      title: "Контакты",
      intro: "Свяжитесь с нами по вопросам или для адаптации проекта.",
      sections: [{ heading: "E-mail", body: ["__EMAIL__"] }],
    },
  },
  terms: {
    az: {
      title: "İstifadə şərtləri",
      intro: "Qeyd: bu mətn qaralama versiyasıdır və yerləşdirilməzdən əvvəl hüquqşünas tərəfindən yoxlanılmalıdır.",
      sections: [
        { heading: "Satış", body: ["Planlar qeyri-ekskluziv lisenziya əsasında satılır. Fayllar yalnız ödəniş edən şəxs tərəfindən istifadə oluna bilər."] },
        { heading: "Yenidən satış", body: ["Planların fayllarını təkrar satmaq, paylaşmaq və ya açıq yerdə yerləşdirmək qadağandır."] },
        { heading: "Məsuliyyət", body: ["Plan layihə sənədidir. Tikinti üçün icazə və konstruktiv yoxlama istifadəçinin öhdəliyindədir."] },
      ],
    },
    en: {
      title: "Terms of use",
      intro: "Note: this text is a draft and must be reviewed by a lawyer before launch.",
      sections: [
        { heading: "Sale", body: ["Plans are sold under a non-exclusive licence. Files may be used only by the buyer."] },
        { heading: "Resale", body: ["Reselling, sharing or publicly posting plan files is prohibited."] },
        { heading: "Responsibility", body: ["A plan is a design document. Building permits and structural checks are the buyer's responsibility."] },
      ],
    },
    ru: {
      title: "Условия использования",
      intro: "Примечание: это черновик, его необходимо проверить юристом до запуска.",
      sections: [
        { heading: "Продажа", body: ["Проекты продаются по неисключительной лицензии. Файлы может использовать только покупатель."] },
        { heading: "Перепродажа", body: ["Перепродажа, распространение или публикация файлов проектов в открытом доступе запрещены."] },
        { heading: "Ответственность", body: ["Проект — это проектная документация. Разрешения на строительство и конструктивные проверки — ответственность покупателя."] },
      ],
    },
  },
  privacy: {
    az: {
      title: "Məxfilik siyasəti",
      intro: "Qeyd: bu mətn qaralama versiyasıdır və yerləşdirilməzdən əvvəl yoxlanılmalıdır.",
      sections: [
        { heading: "Hansı məlumatlar toplanır", body: ["Sifariş üçün e-poçt, ödəniş statusu və texniki məlumatlar (IP, brauzer). Kart məlumatları bizdə saxlanılmır, ödəniş provayderində qalır."] },
        { heading: "Məlumatların istifadəsi", body: ["Sifarişin icrası, fayl yükləmə linklərinin göndərilməsi və dəstək üçün."] },
      ],
    },
    en: {
      title: "Privacy policy",
      intro: "Note: this text is a draft and must be reviewed before launch.",
      sections: [
        { heading: "What we collect", body: ["E-mail for orders, payment status and technical data (IP, browser). Card details are not stored by us; they stay with the payment provider."] },
        { heading: "How we use it", body: ["To fulfil orders, provide download links and support."] },
      ],
    },
    ru: {
      title: "Политика конфиденциальности",
      intro: "Примечание: это черновик, его необходимо проверить до запуска.",
      sections: [
        { heading: "Какие данные собираем", body: ["E-mail для заказа, статус оплаты и технические данные (IP, браузер). Данные карт мы не храним, они остаются у платёжного провайдера."] },
        { heading: "Как используем", body: ["Для выполнения заказа, выдачи ссылок на скачивание и поддержки."] },
      ],
    },
  },
};

/** The 404 page: app/[lang]/not-found (inside a locale) and app/global-not-found (any other unknown address). */
export const NOT_FOUND: Record<Locale, { title: string; text: string; home: string }> = {
  az: { title: "Səhifə tapılmadı", text: "Axtardığınız səhifə yoxdur və ya başqa ünvana köçürülüb.", home: "Ana səhifə" },
  en: { title: "Page not found", text: "The page you are looking for does not exist or has moved.", home: "Home page" },
  ru: { title: "Страница не найдена", text: "Такой страницы нет, или она переехала по другому адресу.", home: "На главную" },
};
