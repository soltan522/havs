import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer, Header } from "@/components";
import PlanRequestForm, { type PlanFormText } from "@/components/PlanRequestForm";
import { isLocale, type Locale } from "@/lib/i18n";

const TEXT: Record<Locale, { title: string; lead: string; steps: string[]; back: string; form: PlanFormText }> = {
  az: {
    title: "Mənzil planınızı göndərin",
    lead: "Binanızı xəritədə seçdiniz. İndi mənzilinizin planını göndərin: onu öz üslubumuzda yenidən çəkirik və həmin plan üçün hazır interyer dizaynları hazırlayırıq. Dizaynlar hazır olanda sizinlə əlaqə saxlayırıq.",
    steps: ["Planın şəkli və ya PDF-i (texniki pasport, satış broşürü, əl ilə ölçülər)", "Plan yenidən çəkilir və binaya bağlanır", "Mənziliniz üçün hazır dizaynlar"],
    back: "← Xəritəyə qayıt",
    form: {
      building: "Bina", buildingHint: "Kompleks, küçə və ya ünvan",
      apartment: "Mənzil", apartmentHint: "Mərtəbə və mənzil nömrəsi, məs. 7-ci mərtəbə, 42",
      rooms: "Otaq sayı", area: "Sahə, m²",
      files: "Plan (şəkil və ya PDF)", filesHint: "4 fayla qədər, hər biri 15 MB-a qədər. Telefonla çəkilmiş aydın şəkil də olar.",
      name: "Adınız", contact: "Telefon və ya e-poçt", contactHint: "Dizaynlar hazır olanda bununla sizə yazacağıq.",
      note: "Qeyd (istəyə görə)",
      consent: "Planınız yalnız dizayn hazırlamaq üçün istifadə olunur və üçüncü tərəflərə verilmir.",
      send: "Planı göndər", sending: "Göndərilir…", sent: "Planınız göndərildi, təşəkkür edirik.",
      sentLead: "Planı yenidən çəkib binanıza bağlayacağıq. Hazır dizaynlar çıxanda sizinlə əlaqə saxlayacağıq.",
      errors: { files: "1-4 fayl seçin: şəkil (JPG, PNG, HEIC) və ya PDF, hər biri 15 MB-a qədər.", failed: "Göndərmək alınmadı. Bir az sonra yenidən cəhd edin.", unavailable: "Göndərmə hələ işə salınmayıb. Əlaqə səhifəsindən yazın." },
    },
  },
  en: {
    title: "Send us your apartment plan",
    lead: "You picked your building on the map. Now send your apartment's plan: we redraw it in our style and prepare ready-made interior designs for it, and let you know when they are out.",
    steps: ["A photo or PDF of the plan (technical passport, sales brochure, hand-measured sketch)", "We redraw the plan and attach it to the building", "Ready designs for your apartment"],
    back: "← Back to the map",
    form: {
      building: "Building", buildingHint: "Complex, street or address",
      apartment: "Apartment", apartmentHint: "Floor and number, e.g. 7th floor, 42",
      rooms: "Rooms", area: "Area, m²",
      files: "Plan (photo or PDF)", filesHint: "Up to 4 files, 15 MB each. A clear phone photo is fine.",
      name: "Your name", contact: "Phone or email", contactHint: "We will write to you here when the designs are ready.",
      note: "Note (optional)",
      consent: "Your plan is used only to prepare designs and is never passed to third parties.",
      send: "Send the plan", sending: "Sending…", sent: "Your plan is sent — thank you.",
      sentLead: "We will redraw it and attach it to your building, and contact you when the designs are out.",
      errors: { files: "Choose 1–4 files: images (JPG, PNG, HEIC) or PDF, up to 15 MB each.", failed: "Sending failed. Please try again in a moment.", unavailable: "Sending is not switched on yet. Please write to us from the contact page." },
    },
  },
  ru: {
    title: "Пришлите планировку квартиры",
    lead: "Вы выбрали свой дом на карте. Теперь пришлите планировку квартиры: мы перерисуем её в нашем стиле и подготовим для неё готовые дизайны интерьера, а когда они появятся — сообщим вам.",
    steps: ["Фото или PDF планировки (техпаспорт, буклет застройщика, обмеры от руки)", "Мы перерисовываем план и привязываем его к дому", "Готовые дизайны для вашей квартиры"],
    back: "← К карте",
    form: {
      building: "Дом", buildingHint: "Комплекс, улица или адрес",
      apartment: "Квартира", apartmentHint: "Этаж и номер, напр. 7 этаж, 42",
      rooms: "Комнат", area: "Площадь, м²",
      files: "Планировка (фото или PDF)", filesHint: "До 4 файлов по 15 МБ. Чёткое фото с телефона подойдёт.",
      name: "Ваше имя", contact: "Телефон или e-mail", contactHint: "Сюда мы напишем, когда дизайны будут готовы.",
      note: "Комментарий (по желанию)",
      consent: "Планировка используется только для подготовки дизайнов и не передаётся третьим лицам.",
      send: "Отправить", sending: "Отправка…", sent: "Планировка отправлена, спасибо.",
      sentLead: "Мы перерисуем её и привяжем к вашему дому, а когда дизайны будут готовы — свяжемся с вами.",
      errors: { files: "Выберите 1–4 файла: изображения (JPG, PNG, HEIC) или PDF, до 15 МБ каждый.", failed: "Не удалось отправить. Попробуйте чуть позже.", unavailable: "Отправка ещё не включена. Напишите нам со страницы контактов." },
    },
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return { title: TEXT[lang].title, robots: { index: false } };
}

/** Where owners send their apartment plan, usually from a building's card on the projects map. */
export default async function PlanPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ b?: string; l?: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const { b, l } = await searchParams;
  const t = TEXT[lang];
  const buildingId = typeof b === "string" && /^[0-9a-f-]{8,80}$/i.test(b) ? b : undefined;
  const buildingLabel = typeof l === "string" ? l.slice(0, 160) : undefined;
  return (
    <>
      <Header locale={lang} path="/plan" />
      <main className="wrap checkout plan-page">
        <Link className="back" href={`/${lang}/map`}>{t.back}</Link>
        <h1 className="checkout-title">{t.title}</h1>
        <div className="checkout-grid">
          <section className="checkout-summary">
            <p className="plan-lead">{t.lead}</p>
            <ol className="plan-steps">
              {t.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
          <section className="checkout-pay" aria-label={t.title}>
            <PlanRequestForm text={t.form} locale={lang} buildingId={buildingId} buildingLabel={buildingLabel} />
          </section>
        </div>
      </main>
      <Footer locale={lang} />
    </>
  );
}
