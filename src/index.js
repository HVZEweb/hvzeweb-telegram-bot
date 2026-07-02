const SITE_URL = 'https://hvzeweb.netlify.app';

const LABELS = {
    cancel: '❌ Отмена',
};

const INLINE = {
    main: {
        inline_keyboard: [
            [
                { text: '📋 Услуги', callback_data: 'svc' },
                { text: '💰 Цены', callback_data: 'price' },
            ],
            [{ text: '❓ FAQ', callback_data: 'faq' }],
            [{ text: '📅 Оставить заявку', callback_data: 'book' }],
            [{ text: '✉️ Написать менеджеру', callback_data: 'contact' }],
            [{ text: '🌐 Сайт HVZEweb', url: SITE_URL }],
        ],
    },
    info: {
        inline_keyboard: [
            [{ text: '📅 Оставить заявку', callback_data: 'book' }],
            [{ text: '« Главное меню', callback_data: 'menu' }],
        ],
    },
    back: {
        inline_keyboard: [[{ text: '« Главное меню', callback_data: 'menu' }]],
    },
    cancel: {
        inline_keyboard: [[{ text: '❌ Отменить заявку', callback_data: 'cancel' }]],
    },
};

const SOURCE_GREETING = {
    site: '🌐 Вы перешли с сайта HVZEweb',
    portfolio_demo: '🎨 Демо из портфолио — попробуйте оставить заявку',
    direct: '',
};

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'GET' && url.pathname === '/') {
            return new Response('HVZEweb Telegram bot — webhook: POST /telegram', {
                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            });
        }

        if (request.method === 'POST' && url.pathname === '/telegram') {
            return handleWebhook(request, env);
        }

        return new Response('Not found', { status: 404 });
    },
};

async function handleWebhook(request, env) {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) {
        return new Response('Bot not configured', { status: 503 });
    }

    if (env.WEBHOOK_SECRET) {
        const header = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (header !== env.WEBHOOK_SECRET) {
            return new Response('Forbidden', { status: 403 });
        }
    }

    let update;
    try {
        update = await request.json();
    } catch {
        return new Response('Bad request', { status: 400 });
    }

    try {
        await processUpdate(update, env);
    } catch (err) {
        console.error('Update failed:', err);
    }

    return new Response('ok');
}

async function processUpdate(update, env) {
    if (update.callback_query) {
        await handleCallback(update.callback_query, env);
        return;
    }

    const message = update.message;
    if (!message?.chat || message.chat.type !== 'private') return;

    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    if (!text) return;

    if (text.startsWith('/start')) {
        const source = text.split(/\s+/)[1] || 'direct';
        await saveSession(chatId, defaultSession(source));
        await sendWelcome(env, chatId, source);
        return;
    }

    if (text === '/menu' || text === '/help') {
        const session = (await loadSession(chatId)) || defaultSession();
        await saveSession(chatId, { ...defaultSession(session.source), source: session.source });
        await sendMenuPrompt(env, chatId);
        return;
    }

    const session = (await loadSession(chatId)) || defaultSession();

    if (session.step !== 'menu' && (text === LABELS.cancel || text === '/cancel')) {
        await resetToMenu(env, chatId, session.source, true);
        return;
    }

    await handleText(env, chatId, text, session, message.from);
}

async function handleCallback(query, env) {
    const chatId = query.message?.chat?.id;
    const data = query.data;
    if (!chatId || !data) return;

    await answerCallback(env, query.id);

    const session = (await loadSession(chatId)) || defaultSession();

    if (data === 'menu') {
        await saveSession(chatId, { ...defaultSession(session.source), source: session.source });
        await sendMenuPrompt(env, chatId);
        return;
    }

    if (data === 'cancel') {
        await resetToMenu(env, chatId, session.source, true);
        return;
    }

    if (session.step !== 'menu') return;

    switch (data) {
        case 'svc':
            await sendServices(env, chatId);
            break;
        case 'faq':
            await sendFaq(env, chatId);
            break;
        case 'price':
            await sendPrices(env, chatId);
            break;
        case 'book':
            await startBooking(env, chatId, session);
            break;
        case 'contact':
            await startQuickContact(env, chatId, session);
            break;
        default:
            await sendMenuPrompt(env, chatId);
    }
}

function defaultSession(source) {
    return {
        step: 'menu',
        source: source || 'direct',
        lead: { name: '', service: '', contact: '' },
    };
}

function sessionKey(chatId) {
    return new Request(`https://hvzeweb-bot.session/s:${chatId}`);
}

async function loadSession(chatId) {
    const res = await caches.default.match(sessionKey(chatId));
    if (!res) return null;
    try {
        return await res.json();
    } catch {
        return null;
    }
}

async function saveSession(chatId, session) {
    await caches.default.put(
        sessionKey(chatId),
        new Response(JSON.stringify(session), {
            headers: { 'Cache-Control': 'max-age=86400' },
        })
    );
}

async function resetToMenu(env, chatId, source, cancelled) {
    await saveSession(chatId, defaultSession(source));
    if (cancelled) {
        await tgSend(
            env,
            chatId,
            '🔄 Заявка отменена.\n\nВы снова в главном меню — выберите действие 👇',
            INLINE.main
        );
    } else {
        await sendMenuPrompt(env, chatId);
    }
}

async function handleText(env, chatId, text, session, from) {
    switch (session.step) {
        case 'name':
            session.lead.name = text;
            session.step = 'service';
            await saveSession(chatId, session);
            await sendTyping(env, chatId);
            await tgSend(
                env,
                chatId,
                `📝 <b>Шаг 2 из 3</b>\n\nПриятно познакомиться, <b>${esc(text)}</b>!\n\nОпишите задачу своими словами:`,
                INLINE.cancel
            );
            return;

        case 'service':
            session.lead.service = text;
            session.step = 'contact';
            await saveSession(chatId, session);
            await sendTyping(env, chatId);
            await tgSend(
                env,
                chatId,
                '📝 <b>Шаг 3 из 3</b>\n\nКуда отправить ответ?\n• email\n• @username в Telegram',
                INLINE.cancel
            );
            return;

        case 'contact':
        case 'contact_only': {
            session.lead.contact = text;
            const isQuick = session.step === 'contact_only';
            await notifyAdmin(env, session, isQuick, from);
            await saveSession(chatId, defaultSession(session.source));
            await sendTyping(env, chatId);
            await tgSend(env, chatId, successText(), INLINE.main);
            return;
        }

        default:
            break;
    }

    await tgSend(
        env,
        chatId,
        '👇 Выберите действие в меню или отправьте /start',
        INLINE.main
    );
}

async function startBooking(env, chatId, session) {
    session.step = 'name';
    session.lead = { name: '', service: '', contact: '' };
    await saveSession(chatId, session);
    await sendTyping(env, chatId);
    await tgSend(
        env,
        chatId,
        '📝 <b>Шаг 1 из 3</b>\n\nКак к вам обращаться?\n\n<i>Можно отменить в любой момент.</i>',
        INLINE.cancel
    );
}

async function startQuickContact(env, chatId, session) {
    session.step = 'contact_only';
    session.lead = { name: '', service: '', contact: '' };
    await saveSession(chatId, session);
    await sendTyping(env, chatId);
    await tgSend(
        env,
        chatId,
        '✉️ <b>Связь с менеджером</b>\n\nНапишите email или @username — ответим в рабочий день (Пн–Пт, 10:00–19:00 МСК).',
        INLINE.cancel
    );
}

async function sendServices(env, chatId) {
    await sendTyping(env, chatId);
    await tgSend(
        env,
        chatId,
        `📋 <b>Наши услуги</b>\n\n` +
            `🌐 Лендинги и корпоративные сайты\n` +
            `⚙️ WordPress под ключ\n` +
            `🛒 Интернет-магазины\n` +
            `🤖 Telegram-боты и автоматизация\n\n` +
            `💬 Нужна консультация? Нажмите «Оставить заявку»`,
        INLINE.info
    );
}

async function sendFaq(env, chatId) {
    await sendTyping(env, chatId);
    await tgSend(
        env,
        chatId,
        `❓ <b>Частые вопросы</b>\n\n` +
            `⏱ <b>Сроки</b>\n` +
            `• Лендинг — 5–7 дней\n` +
            `• Бот — 3–5 дней\n\n` +
            `💳 <b>Оплата</b>\n` +
            `50% старт · 50% при сдаче\n\n` +
            `🛠 <b>Поддержка</b>\n` +
            `30 дней включены в Premium-пакет`,
        INLINE.info
    );
}

async function sendPrices(env, chatId) {
    await sendTyping(env, chatId);
    await tgSend(
        env,
        chatId,
        `💰 <b>Стартовые цены</b>\n\n` +
            `📇 Визитка — от <b>7 000 ₽</b>\n` +
            `🚀 Лендинг — от <b>10 000 ₽</b>\n` +
            `🤖 Telegram-бот — от <b>15 000 ₽</b>\n\n` +
            `<i>Точная смета — после короткого брифа, без скрытых платежей.</i>`,
        INLINE.info
    );
}

function successText() {
    return (
        `✅ <b>Заявка принята!</b>\n\n` +
        `Менеджер свяжется в течение рабочего дня\n` +
        `<i>Пн–Пт, 10:00–19:00 МСК</i>\n\n` +
        `Спасибо, что выбрали <b>HVZEweb</b> 🙌`
    );
}

async function sendWelcome(env, chatId, source) {
    const sourceLine = SOURCE_GREETING[source] || (source !== 'direct' ? `🔗 Источник: ${esc(source)}` : '');
    const sourceBlock = sourceLine ? `\n${sourceLine}\n` : '\n';

    await sendTyping(env, chatId);
    await tgSend(
        env,
        chatId,
        `✨ <b>ServiceDesk Bot</b>\n` +
            `<i>HVZEweb · веб-студия</i>` +
            `${sourceBlock}\n` +
            `Принимаю заявки <b>24/7</b>:\n` +
            `меню · цены · FAQ · связь с менеджером\n\n` +
            `👇 Выберите действие:`,
        INLINE.main
    );
}

async function sendMenuPrompt(env, chatId) {
    await sendTyping(env, chatId);
    await tgSend(env, chatId, '🏠 <b>Главное меню</b>\n\n👇 Чем могу помочь?', INLINE.main);
}

async function notifyAdmin(env, session, isQuick, from) {
    const { lead, source } = session;
    const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const userMeta = formatUserMeta(from);

    const lines = isQuick
        ? [
              '✉️ <b>Сообщение из бота</b>',
              '',
              `📬 Контакт: ${esc(lead.contact)}`,
              `🔗 Источник: ${esc(source || 'direct')}`,
              userMeta,
              `⏰ ${esc(time)} MSK`,
          ]
        : [
              '🆕 <b>Новая заявка</b>',
              '',
              `👤 Имя: ${esc(lead.name)}`,
              `📋 Задача: ${esc(lead.service)}`,
              `📬 Контакт: ${esc(lead.contact)}`,
              `🔗 Источник: ${esc(source || 'direct')}`,
              userMeta,
              `⏰ ${esc(time)} MSK`,
          ];

    await tgSend(env, env.TELEGRAM_ADMIN_CHAT_ID, lines.filter(Boolean).join('\n'));
}

function formatUserMeta(from) {
    if (!from) return '';
    const parts = [];
    if (from.username) parts.push(`@${from.username}`);
    if (from.first_name) parts.push(esc(from.first_name));
    if (!parts.length) return '';
    return `\n👤 Telegram: ${parts.join(' · ')}`;
}

async function sendTyping(env, chatId) {
    await tgApi(env, 'sendChatAction', { chat_id: chatId, action: 'typing' });
}

async function answerCallback(env, callbackQueryId) {
    await tgApi(env, 'answerCallbackQuery', { callback_query_id: callbackQueryId });
}

async function tgSend(env, chatId, text, replyMarkup) {
    const body = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    };

    if (replyMarkup) {
        body.reply_markup = replyMarkup;
    }

    await tgApi(env, 'sendMessage', body);
}

async function tgApi(env, method, body) {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(`Telegram ${method} failed:`, err);
    }
}

function esc(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
