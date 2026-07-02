# HVZEweb Telegram Bot

Live demo bot for [HVZEweb](https://hvzeweb.netlify.app) portfolio — menu, FAQ, lead capture, admin notifications.

**Bot:** [@HVZEwebDemoBot](https://t.me/HVZEwebDemoBot)

## Stack

- Telegram Bot API (webhook)
- Cloudflare Workers
- Session state via Workers Cache API

## Deploy

### Option A — Cloudflare ↔ GitHub (recommended)

1. Push this repo to GitHub.
2. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Connect GitHub**.
3. Select **`HVZEweb/hvzeweb-telegram-bot`**, branch **`main`**, root **`/`**.
4. **Settings → Variables and Secrets** → add **Secrets**:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ADMIN_CHAT_ID`
   - `WEBHOOK_SECRET`
5. Deploy. Copy worker URL (`https://hvzeweb-demo-bot.<subdomain>.workers.dev`).

### Option B — GitHub Actions

Add repository secrets:

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_API_TOKEN` | Token with **Workers Scripts Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

Worker secrets (`TELEGRAM_*`, `WEBHOOK_SECRET`) — in Cloudflare dashboard (Settings → Secrets), not in GitHub.

Push to `main` triggers `.github/workflows/deploy.yml`.

## Webhook (once after deploy)

Replace `<TOKEN>`, `<WORKER_URL>`, `<SECRET>`:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=<WORKER_URL>/telegram&secret_token=<SECRET>&drop_pending_updates=true
```

Open in browser or use curl. Check: `getWebhookInfo`.

## Local dev

```bash
npm install
cp .dev.vars.example .dev.vars   # fill values, never commit
npm run dev
```

## Site integration

Main site `js/config.js`:

- `telegramUrl`: `https://t.me/HVZEwebDemoBot`
- `telegramStartUrl`: deep link with `?start=site`
