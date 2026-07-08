#!/usr/bin/env node
/**
 * Установка webhook после деплоя.
 * Usage: node scripts/set-webhook.js <WORKER_URL>
 * Secrets: TELEGRAM_BOT_TOKEN, WEBHOOK_SECRET (from .dev.vars or env)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadDevVars() {
    const path = resolve(root, '.dev.vars');
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, 'utf8').splitlines()) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
}

loadDevVars();

const workerUrl = (process.argv[2] || process.env.WORKER_URL || '').replace(/\/$/, '');
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.WEBHOOK_SECRET;

if (!workerUrl || !token) {
    console.error('Usage: node scripts/set-webhook.js https://hvzeweb-telegram-bot.<subdomain>.workers.dev');
    console.error('Need TELEGRAM_BOT_TOKEN in .dev.vars or env');
    process.exit(1);
}

const params = new URLSearchParams({
    url: `${workerUrl}/telegram`,
    drop_pending_updates: 'true',
});
if (secret) params.set('secret_token', secret);

const apiUrl = `https://api.telegram.org/bot${token}/setWebhook?${params}`;

const res = await fetch(apiUrl);
const data = await res.json();
console.log(JSON.stringify(data, null, 2));

if (data.ok) {
    const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`).then((r) => r.json());
    console.log('Webhook info:', info.result?.url);
}
