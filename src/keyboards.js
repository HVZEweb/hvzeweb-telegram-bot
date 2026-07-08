import { SITE_URL } from './copy.js';

export function buildInline(profile, copy) {
    const rows = [
        [
            { text: '💅 Услуги', callback_data: 'svc' },
            { text: '💰 Прайс', callback_data: 'price' },
        ],
        [{ text: '❓ FAQ', callback_data: 'faq' }],
    ];

    if (profile === 'studio') {
        rows.push([
            { text: '👩‍🎨 Мастера', callback_data: 'masters' },
            { text: '📍 Адрес', callback_data: 'addr' },
        ]);
    }

    rows.push(
        [{ text: copy.bookLabel, callback_data: 'book' }],
        [{ text: '💬 Написать', callback_data: 'contact' }]
    );

    if (profile === 'agency') {
        rows.push([{ text: '🌐 Сайт HVZEweb', url: SITE_URL }]);
    } else {
        rows.push([{ text: '🤖 Заказать такой бот', url: `${SITE_URL}/#contacts` }]);
    }

    return {
        main: { inline_keyboard: rows },
        info: {
            inline_keyboard: [
                [{ text: copy.bookLabel, callback_data: 'book' }],
                [{ text: '🏠 Главное меню', callback_data: 'menu' }],
            ],
        },
        cancel: {
            inline_keyboard: [[{ text: '❌ Отменить', callback_data: 'cancel' }]],
        },
        services: {
            inline_keyboard: [
                [{ text: '💅 Маникюр + покрытие · 1 800 ₽', callback_data: 'pick:manicure' }],
                [{ text: '👁 Брови · от 900 ₽', callback_data: 'pick:brows' }],
                [{ text: '✨ Комбо брови + ресницы', callback_data: 'pick:combo' }],
                [{ text: '💆 SPA-уход для рук', callback_data: 'pick:care' }],
                [{ text: '❌ Отменить', callback_data: 'cancel' }],
            ],
        },
        masters: {
            inline_keyboard: [
                [{ text: '👩 Алина · маникюр', callback_data: 'master:alina' }],
                [{ text: '👩 Мария · брови', callback_data: 'master:maria' }],
                [{ text: '👩 Катя · универсал', callback_data: 'master:katya' }],
                [{ text: '➡️ Пропустить', callback_data: 'master:any' }],
                [{ text: '❌ Отменить', callback_data: 'cancel' }],
            ],
        },
        slots: {
            inline_keyboard: [
                [
                    { text: '📅 Сегодня 15:00', callback_data: 'slot:today_15' },
                    { text: '📅 Сегодня 18:30', callback_data: 'slot:today_1830' },
                ],
                [
                    { text: '🌅 Завтра 11:00', callback_data: 'slot:tomorrow_11' },
                    { text: '🌅 Завтра 16:00', callback_data: 'slot:tomorrow_16' },
                ],
                [{ text: '✏️ Своя дата и время', callback_data: 'slot:custom' }],
                [{ text: '❌ Отменить', callback_data: 'cancel' }],
            ],
        },
    };
}

export function replyMain(profile, copy) {
    const rows =
        profile === 'studio'
            ? [
                  [{ text: copy.bookLabel }, { text: '🏠 Меню' }],
                  [{ text: '💰 Прайс' }, { text: '📍 Адрес' }],
              ]
            : [[{ text: '🏠 Меню' }, { text: '📅 Заявка' }]];

    return {
        keyboard: rows,
        resize_keyboard: true,
        is_persistent: true,
        input_field_placeholder:
            profile === 'studio' ? 'Имя, вопрос или /menu' : 'Сообщение или /menu',
    };
}

export function replyContact() {
    return {
        keyboard: [[{ text: '📱 Отправить номер телефона', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
    };
}

export function removeReply() {
    return { remove_keyboard: true };
}
