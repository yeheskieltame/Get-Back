import config from './config.js';
import * as whatsapp from './whatsapp.js';
import * as telegram from './telegram.js';
import * as strategy from './strategy.js';

// ── State ─────────────────────────────────────────────────────────
let isProcessing = false;
let practiceMode = true; // Start in practice mode for safety
let activeTargetJid = config.practiceNumber
  ? config.practiceNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
  : config.targetJid;

// ── Boot ──────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== GET-BACK Agent ===');
  console.log(`Target: Nopi (${config.targetNumber})`);
  console.log(`Practice: ${config.practiceNumber || 'none'}`);
  console.log(`Mode: ${practiceMode ? 'PRACTICE' : 'LIVE'}`);
  console.log(`Claude: ${config.claudeBin} (${config.claudeModel})`);
  console.log(`Max unreplied: ${config.maxUnreplied}`);
  console.log(`Min wait: ${config.minWaitHours}h`);
  console.log('');

  // Report boot to Telegram
  await telegram.reportBoot();

  // Set up Telegram command handler
  telegram.onUserCommand(handleUserCommand);
  telegram.startPolling();

  // Set up WhatsApp callbacks
  whatsapp.onConnected(async (name) => {
    await telegram.reportConnected(name);
    console.log('[Main] WhatsApp ready. Agent is active.\n');
  });

  whatsapp.onMessage(async (text, rawMsg, jid) => {
    // Only respond to active target
    if (jid !== activeTargetJid) {
      console.log(`[Main] Ignored message from ${jid} (not active target: ${activeTargetJid})`);
      return;
    }
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
    await whatsapp.sendToJid(activeTargetJid, reply);

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

// ── Telegram User Commands ────────────────────────────────────────

async function handleUserCommand(text) {
  const cmd = text.trim();

  if (cmd === '/start' || cmd === '/help') {
    await telegram.reportCustom(
      `*Get-Back Agent Commands*\n\n` +
      `*Mode:*\n` +
      `/mode - Lihat mode saat ini\n` +
      `/practice - Switch ke mode latihan (Bima)\n` +
      `/live - Switch ke mode live (Nopi)\n\n` +
      `*Actions:*\n` +
      `/status - Status agent & strategy\n` +
      `/send - Kirim pesan proaktif\n` +
      `/say <pesan> - Kirim pesan spesifik\n` +
      `/phase - Lihat phase PDKT\n` +
      `/history - History percakapan\n` +
      `/stop - Hentikan agent\n\n` +
      `Atau kirim pesan biasa untuk minta saran strategi.`
    );
    return;
  }

  if (cmd === '/mode') {
    const targetName = practiceMode ? 'Bima (practice)' : 'Nopi (LIVE)';
    await telegram.reportCustom(`*Mode:* ${practiceMode ? 'PRACTICE' : 'LIVE'}\n*Target:* ${targetName}\n*JID:* ${activeTargetJid}`);
    return;
  }

  if (cmd === '/practice') {
    if (!config.practiceNumber) {
      await telegram.reportCustom('PRACTICE\\_NUMBER tidak di-set di .env');
      return;
    }
    practiceMode = true;
    activeTargetJid = config.practiceNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    await telegram.reportCustom(`*Switched to PRACTICE mode*\nTarget: Bima (${config.practiceNumber})\nSemua pesan akan dikirim ke Bima.`);
    return;
  }

  if (cmd === '/live') {
    practiceMode = false;
    activeTargetJid = config.targetJid;
    await telegram.reportCustom(`*Switched to LIVE mode*\nTarget: Nopi (${config.targetNumber})\nPerhatian: semua pesan sekarang dikirim ke Nopi!`);
    return;
  }

  if (cmd === '/status') {
    const state = strategy.getState();
    const targetName = practiceMode ? 'Bima (practice)' : 'Nopi (LIVE)';
    await telegram.reportCustom(
      `*Agent Status*\n` +
      `Mode: ${practiceMode ? 'PRACTICE' : 'LIVE'}\n` +
      `Target: ${targetName}\n` +
      `Phase: ${state.phaseName}\n` +
      `Messages sent: ${state.sentCount}\n` +
      `Messages received: ${state.receivedCount}\n` +
      `Unreplied: ${state.unrepliedCount}\n` +
      `Sentiment: ${state.lastSentiment || 'N/A'}\n` +
      `WA connected: ${whatsapp.getSocket() ? 'Yes' : 'No'}`
    );
    return;
  }

  if (cmd === '/send') {
    await sendProactive();
    return;
  }

  if (cmd.startsWith('/say ')) {
    const message = cmd.slice(5).trim();
    if (!message) {
      await telegram.reportCustom('Usage: /say <pesan yang mau dikirim>');
      return;
    }
    try {
      await whatsapp.sendToJid(activeTargetJid, message);
      strategy.recordSent(message);
      await telegram.reportOutgoing(message, 'Manual');
    } catch (err) {
      await telegram.reportError('sendManual', err.message);
    }
    return;
  }

  if (cmd === '/phase') {
    const state = strategy.getState();
    await telegram.reportCustom(
      `*Current Phase: ${state.phaseName}*\n\n` +
      `Phase 1: Ice Breaker\n` +
      `Phase 2: Show Change\n` +
      `Phase 3: Emotional Reconnection\n` +
      `Phase 4: Direct Talk\n\n` +
      `Active: Phase ${state.phase}`
    );
    return;
  }

  if (cmd === '/history') {
    const state = strategy.getState();
    const history = state.history || [];
    if (history.length === 0) {
      await telegram.reportCustom('Belum ada percakapan.');
      return;
    }
    const lines = history.slice(-10).map(h =>
      `${h.role === 'user' ? 'Nopi' : 'Kiel'}: ${h.text.slice(0, 80)}${h.text.length > 80 ? '...' : ''}`
    );
    await telegram.reportCustom(`*Last ${lines.length} messages:*\n\n${lines.join('\n')}`);
    return;
  }

  if (cmd === '/stop') {
    await telegram.reportCustom('*Agent stopping...*');
    process.exit(0);
  }

  // Free text = ask agent for advice
  const advice = await strategy.askAdvice(text);
  await telegram.reportCustom(`*Agent:* ${advice}`);
}

/**
 * Send a proactive message to Nopi.
 */
async function sendProactive() {
  const check = strategy.canSendMessage();
  if (!check.allowed) {
    await telegram.reportWaiting(check.reason);
    return;
  }

  const message = await strategy.generateProactive();
  if (!message) return;

  await whatsapp.sendToJid(activeTargetJid, message);
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
