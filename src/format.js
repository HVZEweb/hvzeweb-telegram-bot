/** Визуальное оформление сообщений (HTML). */

export function divider() {
    return '━━━━━━━━━━━━━━━━';
}

export function progressBar(step, total) {
    const filled = '▰'.repeat(step);
    const empty = '▱'.repeat(Math.max(0, total - step));
    return `${filled}${empty} <i>${step}/${total}</i>`;
}

export function card(title, body) {
    return `<b>${title}</b>\n${divider()}\n${body}`;
}

export function esc(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
