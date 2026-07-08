/**
 * Тексты бота: agency (HVZEweb) и studio (Luna Beauty demo).
 */
import { card, divider, esc, progressBar } from './format.js';

export const SITE_URL = 'https://hvzeweb.netlify.app';

export const SOURCE_GREETING = {
    site: '🌐 С сайта HVZEweb',
    portfolio_demo: '🎨 Демо из портфолио',
    studio: '💅 Демо для салона / студии',
    instagram: '📸 Из Instagram',
    direct: '',
};

export const STUDIO_SOURCES = new Set(['studio', 'instagram', 'salon', 'studio_demo']);

export const SLOT_LABELS = {
    today_15: 'Сегодня, 15:00',
    today_1830: 'Сегодня, 18:30',
    tomorrow_11: 'Завтра, 11:00',
    tomorrow_16: 'Завтра, 16:00',
};

export const MASTER_LABELS = {
    alina: '👩 Алина · маникюр',
    maria: '👩 Мария · брови',
    katya: '👩 Катя · универсал',
    any: 'Любой свободный мастер',
};

export function resolveProfile(source) {
    return STUDIO_SOURCES.has(source) ? 'studio' : 'agency';
}

const AGENCY = {
    brand: 'ServiceDesk',
    subtitle: 'HVZEweb · веб-студия',
    bookLabel: '📅 Оставить заявку',
    menu: card('🏠 Главное меню', 'Выберите раздел или нажмите кнопку ниже 👇'),
    services: card(
        '📋 Услуги',
        `🌐 <b>Лендинги и корпоративные сайты</b>\n` +
            `   Современный дизайн, адаптив, формы заявок\n\n` +
            `⚙️ <b>WordPress под ключ</b>\n` +
            `   Тема, наполнение, скорость, базовое SEO\n\n` +
            `🛒 <b>Интернет-магазины</b>\n` +
            `   Каталог, корзина, оплата, админка\n\n` +
            `🤖 <b>Telegram-боты</b>\n` +
            `   Запись, заявки, уведомления, CRM\n\n` +
            `<i>💬 Консультация — кнопка «Оставить заявку»</i>`
    ),
    faq: card(
        '❓ FAQ',
        `⏱ <b>Сроки</b>\n` +
            `• Лендинг — 5–7 дней\n` +
            `• Бот — 3–5 дней\n` +
            `• Сайт с админкой — 7–14 дней\n\n` +
            `💳 <b>Оплата</b>\n` +
            `50% старт · 50% при сдаче\n\n` +
            `🛠 <b>Поддержка</b>\n` +
            `30 дней правок в Premium-пакете`
    ),
    prices: card(
        '💰 Стартовые цены',
        `📇 Визитка — <b>от 7 000 ₽</b>\n` +
            `🚀 Лендинг — <b>от 10 000 ₽</b>\n` +
            `🤖 Telegram-бот — <b>от 15 000 ₽</b>\n` +
            `📦 Под ключ + хостинг — <b>от 19 900 ₽</b>\n\n` +
            `${divider()}\n` +
            `<i>Точная смета после короткого брифа</i>`
    ),
    step1: `${progressBar(1, 3)}\n\n📝 <b>Шаг 1.</b> Как к вам обращаться?`,
    step2(name) {
        return `${progressBar(2, 3)}\n\n👋 Приятно познакомиться, <b>${esc(name)}</b>!\n\nОпишите задачу своими словами:`;
    },
    step3: `${progressBar(3, 3)}\n\n📬 Куда отправить ответ?\n<i>Email или @username</i>`,
    step4: null,
    stepMaster: null,
    stepSlot: null,
    quickContact:
        '💬 <b>Связь с менеджером</b>\n\nНапишите email или @username — ответим Пн–Пт, 10:00–19:00 МСК.',
    success: card(
        '✅ Заявка принята',
        `Менеджер свяжется в рабочий день\n` +
            `<i>Пн–Пт · 10:00–19:00 МСК</i>\n\n` +
            `Спасибо, что выбрали <b>HVZEweb</b> 🙌`
    ),
    cancelled: '🔄 Заявка отменена.\n\n🏠 Главное меню 👇',
    fallback: '👇 Выберите действие в меню или /start',
    address: null,
    servicePick: null,
    masters: null,
};

const STUDIO = {
    brand: 'Luna Beauty',
    subtitle: 'маникюр · брови · ресницы',
    bookLabel: '📅 Записаться',
    menu: card('🏠 Luna Beauty', 'Запись онлайн 24/7 · без звонков и Direct 👇'),
    services: card(
        '💅 Услуги',
        `✨ <b>Маникюр + покрытие</b> — от 1 800 ₽\n` +
            `   · классика, аппаратный, дизайн\n\n` +
            `👁 <b>Брови</b> — от 900 ₽\n` +
            `   · коррекция, окрашивание, ламинирование\n\n` +
            `🎨 <b>Комбо</b> — от 2 500 ₽\n` +
            `   · брови + ресницы\n\n` +
            `💆 <b>SPA-уход для рук</b> — от 900 ₽\n\n` +
            `${divider()}\n` +
            `<i>Нажмите «Записаться» — займёт ~1 минуту</i>`
    ),
    faq: card(
        '❓ FAQ',
        `📅 <b>Как записаться?</b>\n` +
            `Кнопка «Записаться» → услуга → мастер → время → телефон\n\n` +
            `💳 <b>Оплата</b>\n` +
            `На месте · перевод · СБП\n\n` +
            `🔄 <b>Отмена</b>\n` +
            `За 3 часа — без штрафа\n\n` +
            `⏱ <b>Опоздание</b>\n` +
            `Бронь держим 15 минут`
    ),
    prices: card(
        '💰 Прайс',
        `Маникюр классический — <b>1 200 ₽</b>\n` +
            `Маникюр + гель-лак — <b>1 800 ₽</b>\n` +
            `Коррекция бровей — <b>900 ₽</b>\n` +
            `Окрашивание бровей — <b>1 200 ₽</b>\n` +
            `Ламинирование ресниц — <b>2 200 ₽</b>\n` +
            `Комбо брови + ресницы — <b>2 500 ₽</b>\n\n` +
            `${divider()}\n` +
            `<i>Демо-прайс · подставлю ваш</i>`
    ),
    masters: card(
        '👩‍🎨 Наши мастера',
        `👩 <b>Алина</b> — маникюр, дизайн\n` +
            `   ⭐ 4.9 · 6 лет опыта\n\n` +
            `👩 <b>Мария</b> — брови, ламинирование\n` +
            `   ⭐ 5.0 · 4 года\n\n` +
            `👩 <b>Катя</b> — универсал\n` +
            `   ⭐ 4.8 · 5 лет\n\n` +
            `<i>При записи можно выбрать мастера</i>`
    ),
    address: card(
        '📍 Адрес и режим',
        `🏙 Москва, ул. Примерная, 12\n` +
            `🚇 м. Парк Культуры · 5 мин пешком\n\n` +
            `🕐 <b>Пн–Вс:</b> 10:00 – 20:00\n` +
            `📞 +7 (999) 000-00-00\n\n` +
            `<i>Демо-адрес · в вашем боте будет ваш</i>`
    ),
    servicePick: {
        manicure: '💅 Маникюр + покрытие',
        brows: '👁 Брови',
        combo: '✨ Комбо брови + ресницы',
        care: '💆 SPA-уход для рук',
    },
    step1: `${progressBar(1, 4)}\n\n📝 <b>Шаг 1.</b> Как вас зовут?`,
    step2(name) {
        return (
            `${progressBar(2, 4)}\n\n` +
            `👋 <b>${esc(name)}</b>, приятно познакомиться!\n\n` +
            `Выберите услугу 👇`
        );
    },
    stepMaster: `${progressBar(3, 4)}\n\n👩‍🎨 Выберите мастера (или «Пропустить»):`,
    stepSlot: `${progressBar(3, 4)}\n\n🕐 Выберите удобное время 👇`,
    step3: `${progressBar(3, 4)}\n\n🕐 Напишите дату и время:\n<i>Например: 12 марта в 18:30</i>`,
    step4: `${progressBar(4, 4)}\n\n📱 Отправьте телефон кнопкой ниже\n<i>или напишите номер вручную</i>`,
    quickContact:
        '💬 <b>Вопрос мастеру</b>\n\nНапишите вопрос и телефон или @username.',
    success: card(
        '✅ Вы записаны!',
        `Мастер подтвердит время в ближайшие часы\n` +
            `<i>Пн–Вс · 10:00–20:00</i>\n\n` +
            `До встречи в <b>Luna Beauty</b> 💅\n\n` +
            `<i>Это демо — так работает бот для вашего салона</i>`
    ),
    cancelled: '🔄 Запись отменена.\n\n🏠 Главное меню 👇',
    fallback: '👇 Меню ниже или /start',
};

export const PROFILES = { agency: AGENCY, studio: STUDIO };

export function getCopy(profile) {
    return PROFILES[profile] || PROFILES.agency;
}

export function buildWelcome(profile, source) {
    const copy = getCopy(profile);
    const sourceLine =
        SOURCE_GREETING[source] ||
        (source && source !== 'direct' ? `🔗 ${source}` : '');
    const sourceBlock = sourceLine ? `\n${sourceLine}\n` : '\n';

    if (profile === 'studio') {
        return (
            `💅 <b>${copy.brand}</b>\n` +
            `<i>${copy.subtitle}</i>` +
            `${sourceBlock}\n` +
            `Запись <b>24/7</b> — клиент сам выбирает услугу и время.\n` +
            `Вам приходит готовая заявка в Telegram.\n\n` +
            `👇 <b>Попробуйте как клиент:</b>`
        );
    }

    return (
        `✨ <b>${copy.brand}</b>\n` +
        `<i>${copy.subtitle}</i>` +
        `${sourceBlock}\n` +
        `Заявки <b>24/7</b> · меню · прайс · FAQ\n\n` +
        `👇 Выберите действие:`
    );
}
