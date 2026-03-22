import config from './config.js';
import * as whatsapp from './whatsapp.js';
import * as telegram from './telegram.js';
import * as strategy from './strategy.js';

// ── State ─────────────────────────────────────────────────────────
let isProcessing = false;

// ── Boot ──────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== GET-BACK Agent ===');
  console.log(`Target: Nopi (${config.targetNumber})`);
  console.log(`Claude: ${config.claudeBin} (${config.claudeModel})`);
  console.log(`Max unreplied: ${config.maxUnreplied}`);
  console.log(`Min wait: ${config.minWaitHours}h`);
  console.log('');

  // Report boot to Telegram
  await telegram.reportBoot();

  // Set up WhatsApp callbacks
  whatsapp.onConnected(async (name) => {
    await telegram.reportConnected(name);
    console.log('[Main] WhatsApp ready. Agent is active.\n');
  });

  whatsapp.onMessage(async (text, rawMsg) => {
    await handleNopiMessage(text);
  });

  // Connect WhatsApp
  await whatsapp.connect();
}

// ── Message Handler ───────────────────────────────────────────────

async function handleNopiMessage(text) {
  if (isProcessing) {
    console.log('[Main] Already processing, queuing...');
    // Simple queue: wait and retry
    await new Promise(r => setTimeout(r, 5000));
    if (isProcessing) {
      await telegram.reportCustom('*Warning:* Message received while still processing previous one.');
      return;
    }
  }

  isProcessing = true;

  try {
    // Run through strategy engine (analyzes + generates reply)
    const reply = await strategy.handleIncoming(text);

    if (!reply) {
      await telegram.reportWaiting('Strategy decided not to reply right now.');
      return;
    }

    // Send via WhatsApp
    await whatsapp.sendToTarget(reply);

    // Record in strategy state
    strategy.recordSent(reply);

    // Report to Telegram
    const state = strategy.getState();
    await telegram.reportOutgoing(reply, state.phaseName);

  } catch (err) {
    console.error('[Main] Error handling message:', err);
    await telegram.reportError('handleNopiMessage', err.message);
  } finally {
    isProcessing = false;
  }
}

// ── Manual Commands via Telegram (future) ─────────────────────────

/**
 * Send a proactive message (called manually or on schedule).
 * Usage: import and call, or hook up to a Telegram command.
 */
export async function sendProactive() {
  const check = strategy.canSendMessage();
  if (!check.allowed) {
    await telegram.reportWaiting(check.reason);
    return;
  }

  const message = await strategy.generateProactive();
  if (!message) return;

  await whatsapp.sendToTarget(message);
  strategy.recordSent(message);

  const state = strategy.getState();
  await telegram.reportOutgoing(message, `${state.phaseName} (proactive)`);
}

// ── Graceful Shutdown ─────────────────────────────────────────────

process.on('SIGINT', async () => {
  console.log('\n[Main] Shutting down...');
  await telegram.reportCustom('*Agent going offline.*');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[Main] Shutting down...');
  await telegram.reportCustom('*Agent going offline.*');
  process.exit(0);
});

// ── Start ─────────────────────────────────────────────────────────
main().catch(async (err) => {
  console.error('Fatal error:', err);
  await telegram.reportError('Fatal', err.message);
  process.exit(1);
});
