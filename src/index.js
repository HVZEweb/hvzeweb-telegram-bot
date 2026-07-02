const MENU = {
    keyboard: [
        [{ text: '📋 Услуги' }, { text: '📅 Оставить заявку' }],
        [{ text: '❓ FAQ' }, { text: '💰 Цены' }],
        [{ text: '✉️ Написать менеджеру' }],
    ],
    resize_keyboard: true,
};

const LABELS = {
    services: '📋 Услуги',
    book: '📅 Оставить заявку',
    faq: '❓ FAQ',
    price: '💰 Цены',
    contact: '✉️ Написать менеджеру',
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
        await saveSession(chatId, defaultSession());
        await sendMenuPrompt(env, chatId);
        return;
    }

    const session = (await loadSession(chatId)) || defaultSession();
    await handleText(env, chatId, text, session);
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

async function handleText(env, chatId, text, session) {
    switch (session.step) {
        case 'name':
            session.lead.name = text;
            session.step = 'service';
            await saveSession(chatId, session);
            await tgSend(env, chatId, `Приятно познакомиться, <b>${esc(text)}</b>! Какая задача у вас?`, {
                remove_keyboard: true,
            });
            return;

        case 'service':
            session.lead.service = text;
            session.step = 'contact';
            await saveSession(chatId, session);
            await tgSend(env, chatId, 'Куда отправить ответ — email или Telegram (@username)?');
            return;

        case 'contact':
        case 'contact_only':
            session.lead.contact = text;
            await notifyAdmin(env, session, session.step === 'contact_only');
            await saveSession(chatId, defaultSession(session.source));
            await tgSend(
                env,
                chatId,
                '✅ Заявка принята! Менеджер свяжется в течение рабочего дня.\n\nСпасибо, что написали в <b>ServiceDesk Bot</b> — демо HVZEweb.',
                MENU
            );
            return;

        default:
            break;
    }

    if (text === LABELS.services) {
        await tgSend(
            env,
            chatId,
            'Мы делаем:\n\n• Лендинги и сайты\n• WordPress под ключ\n• Интернет-магазины\n• Telegram-боты и автоматизация\n\nВыберите действие 👇',
            MENU
        );
        return;
    }

    if (text === LABELS.faq) {
        await tgSend(
            env,
            chatId,
            '❓ <b>FAQ</b>\n\n<b>Сроки:</b> лендинг 5–7 дней, бот 3–5 дней.\n<b>Оплата:</b> 50% старт, 50% сдача.\n<b>Поддержка:</b> 30 дней в премиум-пакете.',
            MENU
        );
        return;
    }

    if (text === LABELS.price) {
        await tgSend(
            env,
            chatId,
            '💰 Стартовые цены:\n\nВизитка — от 7 000 ₽\nЛендинг — от 10 000 ₽\nБот — от 15 000 ₽\n\nТочная смета после брифа.',
            MENU
        );
        return;
    }

    if (text === LABELS.book) {
        session.step = 'name';
        session.lead = { name: '', service: '', contact: '' };
        await saveSession(chatId, session);
        await tgSend(env, chatId, 'Отлично! Как к вам обращаться?', { remove_keyboard: true });
        return;
    }

    if (text === LABELS.contact) {
        session.step = 'contact_only';
        session.lead = { name: '', service: '', contact: '' };
        await saveSession(chatId, session);
        await tgSend(
            env,
            chatId,
            'Напишите email или @username в Telegram — менеджер ответит в рабочий день.',
            { remove_keyboard: true }
        );
        return;
    }

    await tgSend(env, chatId, 'Выберите пункт меню 👇 или отправьте /start', MENU);
}

async function sendWelcome(env, chatId, source) {
    const sourceNote =
        source && source !== 'direct'
            ? `\n\n<i>Источник: ${esc(source)}</i>`
            : '';

    await tgSend(
        env,
        chatId,
        `👋 Добро пожаловать в <b>ServiceDesk Bot</b>!\n\nПомогаю принимать заявки 24/7: меню, FAQ, запись и мгновенные уведомления менеджеру.${sourceNote}`,
        MENU
    );
}

async function sendMenuPrompt(env, chatId) {
    await tgSend(env, chatId, 'Главное меню 👇', MENU);
}

async function notifyAdmin(env, session, isQuick) {
    const { lead, source } = session;
    const lines = isQuick
        ? [
              '✉️ Сообщение из Telegram-бота',
              '',
              `📬 Контакт: ${esc(lead.contact)}`,
              `🔗 Источник: ${esc(source || 'direct')}`,
          ]
        : [
              '🆕 Новая заявка из Telegram-бота',
              '',
              `👤 Имя: ${esc(lead.name)}`,
              `📋 Задача: ${esc(lead.service)}`,
              `📬 Контакт: ${esc(lead.contact)}`,
              `🔗 Источник: ${esc(source || 'direct')}`,
          ];

    await tgSend(env, env.TELEGRAM_ADMIN_CHAT_ID, lines.join('\n'));
}

async function tgSend(env, chatId, text, replyMarkup) {
    const body = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    };

    if (replyMarkup) {
        if (replyMarkup.remove_keyboard) {
            body.reply_markup = { remove_keyboard: true };
        } else if (replyMarkup.keyboard) {
            body.reply_markup = replyMarkup;
        } else {
            body.reply_markup = replyMarkup;
        }
    }

    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const err = await res.text();
        console.error('Telegram sendMessage failed:', err);
    }
}

function esc(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
