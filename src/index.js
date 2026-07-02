import { COPY, INLINE, SOURCE_GREETING } from './copy.js';

const LABELS = {
    cancel: '❌ Отмена',
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
        await tgSend(env, chatId, COPY.cancelled, INLINE.main);
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
            await tgSend(env, chatId, COPY.step2(esc(text)), INLINE.cancel);
            return;

        case 'service':
            session.lead.service = text;
            session.step = 'contact';
            await saveSession(chatId, session);
            await sendTyping(env, chatId);
            await tgSend(env, chatId, COPY.step3, INLINE.cancel);
            return;

        case 'contact':
        case 'contact_only': {
            session.lead.contact = text;
            const isQuick = session.step === 'contact_only';
            await notifyAdmin(env, session, isQuick, from);
            await saveSession(chatId, defaultSession(session.source));
            await sendTyping(env, chatId);
            await tgSend(env, chatId, COPY.success, INLINE.main);
            return;
        }

        default:
            break;
    }

    await tgSend(env, chatId, COPY.fallback, INLINE.main);
}

async function startBooking(env, chatId, session) {
    session.step = 'name';
    session.lead = { name: '', service: '', contact: '' };
    await saveSession(chatId, session);
    await sendTyping(env, chatId);
    await tgSend(env, chatId, COPY.step1, INLINE.cancel);
}

async function startQuickContact(env, chatId, session) {
    session.step = 'contact_only';
    session.lead = { name: '', service: '', contact: '' };
    await saveSession(chatId, session);
    await sendTyping(env, chatId);
    await tgSend(env, chatId, COPY.quickContact, INLINE.cancel);
}

async function sendServices(env, chatId) {
    await sendTyping(env, chatId);
    await tgSend(env, chatId, COPY.services, INLINE.info);
}

async function sendFaq(env, chatId) {
    await sendTyping(env, chatId);
    await tgSend(env, chatId, COPY.faq, INLINE.info);
}

async function sendPrices(env, chatId) {
    await sendTyping(env, chatId);
    await tgSend(env, chatId, COPY.prices, INLINE.info);
}

async function sendWelcome(env, chatId, source) {
    await sendTyping(env, chatId);
    await tgSend(env, chatId, COPY.welcome(source), INLINE.main);
}

async function sendMenuPrompt(env, chatId) {
    await sendTyping(env, chatId);
    await tgSend(env, chatId, COPY.menu, INLINE.main);
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
