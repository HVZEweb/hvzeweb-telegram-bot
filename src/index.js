import {
    MASTER_LABELS,
    SLOT_LABELS,
    buildWelcome,
    getCopy,
    resolveProfile,
} from './copy.js';
import { esc } from './format.js';
import {
    buildInline,
    removeReply,
    replyContact,
    replyMain,
} from './keyboards.js';

const REPLY_MENU = '🏠 Меню';
const REPLY_BOOK_STUDIO = '📅 Записаться';
const REPLY_BOOK_AGENCY = '📅 Заявка';
const REPLY_PRICE = '💰 Прайс';
const REPLY_ADDR = '📍 Адрес';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'GET' && url.pathname === '/') {
            return json({
                ok: true,
                bot: 'HVZEweb Demo Bot',
                webhook: 'POST /telegram',
                profiles: ['agency', 'studio'],
                links: {
                    site: 'https://t.me/HVZEwebDemoBot?start=site',
                    studio: 'https://t.me/HVZEwebDemoBot?start=instagram',
                },
            });
        }

        if (request.method === 'GET' && url.pathname === '/health') {
            return json({
                ok: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_ADMIN_CHAT_ID),
            });
        }

        if (request.method === 'POST' && url.pathname === '/telegram') {
            return handleWebhook(request, env);
        }

        return new Response('Not found', { status: 404 });
    },
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

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

    if (message.contact?.phone_number) {
        const session = (await loadSession(chatId)) || defaultSession();
        if (session.step === 'contact') {
            await finishBooking(env, chatId, session, message.contact.phone_number, message.from);
        }
        return;
    }

    const text = (message.text || '').trim();
    if (!text) return;

    if (text.startsWith('/start')) {
        const source = text.split(/\s+/)[1] || 'direct';
        const profile = resolveProfile(source);
        await saveSession(chatId, defaultSession(source, profile));
        await sendWelcome(env, chatId, source, profile);
        return;
    }

    if (text === '/menu' || text === '/help' || text === REPLY_MENU) {
        const session = (await loadSession(chatId)) || defaultSession();
        await resetToMenu(env, chatId, session.source, session.profile, false);
        return;
    }

    const session = (await loadSession(chatId)) || defaultSession();
    const profile = session.profile || 'agency';

    if (text === REPLY_BOOK_STUDIO && profile === 'studio') {
        await startBooking(env, chatId, session);
        return;
    }
    if (text === REPLY_BOOK_AGENCY && profile === 'agency') {
        await startBooking(env, chatId, session);
        return;
    }
    if (text === REPLY_PRICE) {
        await sendPrices(env, chatId, profile);
        return;
    }
    if (text === REPLY_ADDR && profile === 'studio') {
        await sendAddress(env, chatId, profile);
        return;
    }

    if (session.step !== 'menu' && (text === '/cancel' || text === '❌ Отмена')) {
        await resetToMenu(env, chatId, session.source, profile, true);
        return;
    }

    await handleText(env, chatId, text, session, message.from);
}

async function handleCallback(query, env) {
    const chatId = query.message?.chat?.id;
    const data = query.data;
    if (!chatId || !data) return;

    const session = (await loadSession(chatId)) || defaultSession();
    const profile = session.profile || 'agency';
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);

    if (data === 'menu') {
        await answerCallback(env, query.id, '🏠 Меню');
        await resetToMenu(env, chatId, session.source, profile, false);
        return;
    }

    if (data === 'cancel') {
        await answerCallback(env, query.id, 'Отменено');
        await resetToMenu(env, chatId, session.source, profile, true);
        return;
    }

    if (data.startsWith('pick:') && session.step === 'service_pick') {
        const key = data.slice(5);
        session.lead.service = copy.servicePick?.[key] || key;
        session.step = 'master_pick';
        await saveSession(chatId, session);
        await answerCallback(env, query.id, session.lead.service);
        await sendTyping(env, chatId);
        await tgSend(env, chatId, copy.stepMaster, inline.masters);
        return;
    }

    if (data.startsWith('master:') && session.step === 'master_pick') {
        const key = data.slice(7);
        session.lead.master = MASTER_LABELS[key] || key;
        session.step = 'slot_pick';
        await saveSession(chatId, session);
        await answerCallback(env, query.id);
        await sendTyping(env, chatId);
        await tgSend(env, chatId, copy.stepSlot, inline.slots);
        return;
    }

    if (data.startsWith('slot:') && session.step === 'slot_pick') {
        const key = data.slice(5);
        if (key === 'custom') {
            session.step = 'datetime';
            await saveSession(chatId, session);
            await answerCallback(env, query.id, 'Своя дата');
            await tgSend(env, chatId, copy.step3, inline.cancel);
            return;
        }
        session.lead.datetime = SLOT_LABELS[key] || key;
        session.step = 'contact';
        await saveSession(chatId, session);
        await answerCallback(env, query.id, session.lead.datetime);
        await sendTyping(env, chatId);
        await tgSend(env, chatId, copy.step4, replyContact());
        return;
    }

    if (session.step !== 'menu') {
        await answerCallback(env, query.id);
        return;
    }

    await answerCallback(env, query.id);

    switch (data) {
        case 'svc':
            await sendServices(env, chatId, profile);
            break;
        case 'faq':
            await sendFaq(env, chatId, profile);
            break;
        case 'price':
            await sendPrices(env, chatId, profile);
            break;
        case 'addr':
            await sendAddress(env, chatId, profile);
            break;
        case 'masters':
            await sendMasters(env, chatId, profile);
            break;
        case 'book':
            await startBooking(env, chatId, session);
            break;
        case 'contact':
            await startQuickContact(env, chatId, session);
            break;
        default:
            await sendMenuPrompt(env, chatId, profile);
    }
}

function defaultSession(source, profile) {
    const src = source || 'direct';
    return {
        step: 'menu',
        source: src,
        profile: profile || resolveProfile(src),
        lead: { name: '', service: '', master: '', datetime: '', contact: '' },
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

async function resetToMenu(env, chatId, source, profile, cancelled) {
    const prof = profile || resolveProfile(source);
    await saveSession(chatId, defaultSession(source, prof));
    const copy = getCopy(prof);
    const inline = buildInline(prof, copy);
    if (cancelled) {
        await tgSend(env, chatId, copy.cancelled, inline.main);
        await restoreReplyKeyboard(env, chatId, prof);
    } else {
        await sendMenuPrompt(env, chatId, prof);
    }
}

async function handleText(env, chatId, text, session, from) {
    const profile = session.profile || 'agency';
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);

    switch (session.step) {
        case 'name': {
            if (text.length < 2) {
                await tgSend(env, chatId, '❗️ Введите имя (минимум 2 символа)', inline.cancel);
                return;
            }
            session.lead.name = text;
            if (profile === 'studio') {
                session.step = 'service_pick';
                await saveSession(chatId, session);
                await sendTyping(env, chatId);
                await tgSend(env, chatId, copy.step2(text), inline.services);
                return;
            }
            session.step = 'service';
            await saveSession(chatId, session);
            await sendTyping(env, chatId);
            await tgSend(env, chatId, copy.step2(text), inline.cancel);
            return;
        }

        case 'service':
            session.lead.service = text;
            session.step = 'contact';
            await saveSession(chatId, session);
            await sendTyping(env, chatId);
            await tgSend(env, chatId, copy.step3, inline.cancel);
            return;

        case 'datetime':
            session.lead.datetime = text;
            session.step = 'contact';
            await saveSession(chatId, session);
            await sendTyping(env, chatId);
            const phonePrompt =
                (copy.step4 || copy.step3) + '\n\n<i>/cancel — отмена</i>';
            await tgSend(
                env,
                chatId,
                phonePrompt,
                profile === 'studio' ? replyContact() : inline.cancel
            );
            return;

        case 'contact':
            await finishBooking(env, chatId, session, text, from);
            return;

        case 'contact_only': {
            session.lead.contact = text;
            await notifyAdmin(env, session, true, from);
            await saveSession(chatId, defaultSession(session.source, profile));
            await sendTyping(env, chatId);
            await tgSend(env, chatId, '✅ <b>Сообщение отправлено!</b>\n\nОтветим в рабочие часы.', inline.main);
            await restoreReplyKeyboard(env, chatId, profile);
            return;
        }

        default:
            break;
    }

    await tgSend(env, chatId, copy.fallback, inline.main);
}

async function restoreReplyKeyboard(env, chatId, profile) {
    const copy = getCopy(profile);
    await tgSend(env, chatId, '👇', replyMain(profile, copy));
}

async function finishBooking(env, chatId, session, contact, from) {
    const profile = session.profile || 'agency';
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);

    if (!normalizePhone(contact) && profile === 'studio') {
        await tgSend(
            env,
            chatId,
            '❗️ Укажите телефон кнопкой ниже или в формате +7 999 123-45-67',
            replyContact()
        );
        return;
    }

    session.lead.contact = contact;
    await notifyAdmin(env, session, false, from);
    await saveSession(chatId, defaultSession(session.source, profile));
    await sendTyping(env, chatId);
    await tgSend(env, chatId, copy.success, inline.main);
    await restoreReplyKeyboard(env, chatId, profile);
}

function normalizePhone(value) {
    const digits = String(value).replace(/\D/g, '');
    return digits.length >= 10 ? value : '';
}

async function startBooking(env, chatId, session) {
    const profile = session.profile || 'agency';
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);
    session.step = 'name';
    session.lead = { name: '', service: '', master: '', datetime: '', contact: '' };
    await saveSession(chatId, session);
    await sendTyping(env, chatId);
    await hideReplyKeyboard(env, chatId);
    await tgSend(env, chatId, copy.step1, inline.cancel);
}

async function startQuickContact(env, chatId, session) {
    const profile = session.profile || 'agency';
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);
    session.step = 'contact_only';
    session.lead = { name: '', service: '', master: '', datetime: '', contact: '' };
    await saveSession(chatId, session);
    await sendTyping(env, chatId);
    await hideReplyKeyboard(env, chatId);
    await tgSend(env, chatId, copy.quickContact, inline.cancel);
}

async function hideReplyKeyboard(env, chatId) {
    await tgSend(env, chatId, '…', removeReply());
}

async function sendServices(env, chatId, profile) {
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);
    await sendTyping(env, chatId);
    await tgSend(env, chatId, copy.services, inline.info);
}

async function sendFaq(env, chatId, profile) {
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);
    await sendTyping(env, chatId);
    await tgSend(env, chatId, copy.faq, inline.info);
}

async function sendPrices(env, chatId, profile) {
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);
    await sendTyping(env, chatId);
    await tgSend(env, chatId, copy.prices, inline.info);
}

async function sendAddress(env, chatId, profile) {
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);
    if (!copy.address) {
        await sendMenuPrompt(env, chatId, profile);
        return;
    }
    await sendTyping(env, chatId);
    await tgSend(env, chatId, copy.address, inline.info);
}

async function sendMasters(env, chatId, profile) {
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);
    if (!copy.masters) return;
    await sendTyping(env, chatId);
    await tgSend(env, chatId, copy.masters, inline.info);
}

async function sendWelcome(env, chatId, source, profile) {
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);
    const reply = replyMain(profile, copy);
    await sendTyping(env, chatId);
    await tgSend(env, chatId, buildWelcome(profile, source), inline.main);
    await tgSend(env, chatId, '⌨️ <i>Быстрые кнопки внизу экрана</i>', reply);
}

async function sendMenuPrompt(env, chatId, profile) {
    const copy = getCopy(profile);
    const inline = buildInline(profile, copy);
    await sendTyping(env, chatId);
    await tgSend(env, chatId, copy.menu, inline.main);
}

async function notifyAdmin(env, session, isQuick, from) {
    const { lead, source, profile } = session;
    const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const userMeta = formatUserMeta(from);
    const tag = profile === 'studio' ? '💅 STUDIO' : '🌐 AGENCY';

    let lines;

    if (isQuick) {
        lines = [
            `✉️ <b>Сообщение</b> · ${tag}`,
            '',
            `📬 ${esc(lead.contact)}`,
            `🔗 ${esc(source || 'direct')}`,
            userMeta,
            `⏰ ${esc(time)}`,
        ];
    } else if (profile === 'studio') {
        lines = [
            `📅 <b>Новая запись</b> · ${tag}`,
            '',
            `👤 ${esc(lead.name)}`,
            `💅 ${esc(lead.service)}`,
            lead.master ? `👩‍🎨 ${esc(lead.master)}` : '',
            lead.datetime ? `🕐 ${esc(lead.datetime)}` : '',
            `📱 ${esc(lead.contact)}`,
            `🔗 ${esc(source || 'direct')}`,
            userMeta,
            `⏰ ${esc(time)}`,
        ];
    } else {
        lines = [
            `🆕 <b>Заявка</b> · ${tag}`,
            '',
            `👤 ${esc(lead.name)}`,
            `📋 ${esc(lead.service)}`,
            `📬 ${esc(lead.contact)}`,
            `🔗 ${esc(source || 'direct')}`,
            userMeta,
            `⏰ ${esc(time)}`,
        ];
    }

    await tgSend(env, env.TELEGRAM_ADMIN_CHAT_ID, lines.filter(Boolean).join('\n'));
}

function formatUserMeta(from) {
    if (!from) return '';
    const parts = [];
    if (from.username) parts.push(`@${from.username}`);
    if (from.first_name) parts.push(esc(from.first_name));
    if (!parts.length) return '';
    return `👤 ${parts.join(' · ')}`;
}

async function sendTyping(env, chatId) {
    await tgApi(env, 'sendChatAction', { chat_id: chatId, action: 'typing' });
}

async function answerCallback(env, callbackQueryId, text) {
    const body = { callback_query_id: callbackQueryId };
    if (text) body.text = text;
    await tgApi(env, 'answerCallbackQuery', body);
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
