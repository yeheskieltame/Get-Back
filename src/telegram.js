import config from './config.js';

const API_BASE = `https://api.telegram.org/bot${config.telegramBotToken}`;

/**
 * Send a message to the configured Telegram chat.
 * Uses plain HTTP fetch — no extra dependencies.
 */
async function sendTelegram(text, options = {}) {
  if (!config.telegramBotToken) {
    console.log('[TG] No bot token configured, skipping:', text.slice(0, 80));
    return null;
  }

  try {
    const body = {
      chat_id: config.telegramChatId,
      text,
      parse_mode: options.parseMode || 'Markdown',
      disable_web_page_preview: true,
    };

    const res = await fetch(`${API_BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error('[TG] API error:', data.description);
    }
    return data;
  } catch (err) {
    console.error('[TG] Send failed:', err.message);
    return null;
  }
}

// ── Report helpers ────────────────────────────────────────────────

export async function reportBoot() {
  await sendTelegram(
    `*Get-Back Agent Online*\n` +
    `Target: Nopi (${config.targetNumber})\n` +
    `Mode: Autonomous PDKT\n` +
    `Strategy: Phase detection active\n` +
    `---\nWaiting for connection...`
  );
}

export async function reportConnected(name) {
  await sendTelegram(
    `WhatsApp connected as *${name || 'unknown'}*\n` +
    `Listening for messages from Nopi...`
  );
}

export async function reportIncoming(text) {
  const preview = text.length > 200 ? text.slice(0, 200) + '...' : text;
  await sendTelegram(
    `*Nopi sent a message:*\n` +
    `\`\`\`\n${preview}\n\`\`\``
  );
}

export async function reportOutgoing(text, strategy) {
  const preview = text.length > 200 ? text.slice(0, 200) + '...' : text;
  await sendTelegram(
    `*Agent replied:*\n` +
    `\`\`\`\n${preview}\n\`\`\`\n` +
    `Strategy: ${strategy || 'N/A'}`
  );
}

export async function reportAnalysis(analysis) {
  await sendTelegram(
    `*Analysis Update*\n` +
    `Phase: ${analysis.phase}\n` +
    `Sentiment: ${analysis.sentiment}\n` +
    `Unreplied: ${analysis.unrepliedCount}\n` +
    `Next move: ${analysis.nextMove}`
  );
}

export async function reportError(context, error) {
  await sendTelegram(
    `*Error*: ${context}\n\`${error}\``
  );
}

export async function reportWaiting(reason) {
  await sendTelegram(`*Waiting*: ${reason}`);
}

export async function askUser(question) {
  await sendTelegram(
    `*Need your input:*\n${question}\n\n_Reply here or let the agent decide._`
  );
}

export async function reportCustom(message) {
  await sendTelegram(message);
}

// ── Polling for user commands ─────────────────────────────────────

let lastUpdateId = 0;
let commandHandler = null;

export function onUserCommand(cb) { commandHandler = cb; }

export async function startPolling() {
  if (!config.telegramBotToken) return;
  console.log('[TG] Polling for user commands...');
  pollLoop();
}

async function pollLoop() {
  try {
    const res = await fetch(`${API_BASE}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
    const data = await res.json();

    if (data.ok && data.result) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        const msg = update.message;
        if (!msg || !msg.text) continue;
        if (String(msg.chat.id) !== String(config.telegramChatId)) continue;

        console.log(`[TG] User command: ${msg.text.slice(0, 60)}`);
        if (commandHandler) {
          await commandHandler(msg.text);
        }
      }
    }
  } catch (err) {
    console.error('[TG] Poll error:', err.message);
  }

  // Continue polling
  setTimeout(pollLoop, 1000);
}
