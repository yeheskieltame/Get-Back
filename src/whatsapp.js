import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import config from './config.js';

const logger = pino({ level: config.logLevel });

let sock = null;
let myJid = null;

// ── Event Callbacks ───────────────────────────────────────────────

let onConnectedCb = null;
let onMessageCb = null;

export function onConnected(cb) { onConnectedCb = cb; }
export function onMessage(cb) { onMessageCb = cb; }

// ── Connection ────────────────────────────────────────────────────

export async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    // QR handled manually via connection.update event
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n[WA] Scan this QR code with WhatsApp:');
      console.log('     WhatsApp > Settings > Linked Devices > Link a Device\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      myJid = sock.user?.id;
      console.log(`[WA] Connected as: ${sock.user?.name || myJid}`);
      if (onConnectedCb) onConnectedCb(sock.user?.name || 'unknown');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`[WA] Disconnected (code: ${statusCode})`);

      if (shouldReconnect) {
        console.log('[WA] Reconnecting in 3s...');
        setTimeout(connect, 3000);
      } else {
        console.log('[WA] Logged out. Delete auth_info/ and scan QR again.');
        process.exit(0);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Skip own messages
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;

      const jid = msg.key.remoteJid;
      if (!jid) continue;

      // Pass JID to callback, let index.js decide if it's the active target
      // (supports practice mode switching)

      // Extract text
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        null;

      if (!text) continue;

      console.log(`[WA] Message from ${jid}: ${text.slice(0, 60)}`);

      if (onMessageCb) {
        await onMessageCb(text, msg, jid);
      }
    }
  });
}

// ── Sending ───────────────────────────────────────────────────────

/**
 * Send a message to Nopi with typing indicator.
 */
export async function sendToTarget(text) {
  if (!sock) throw new Error('WhatsApp not connected');

  const jid = config.targetJid;

  // Typing indicator
  try {
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);
  } catch (e) {
    // Non-fatal
  }

  // Simulate typing delay (30ms per character, min 1s, max 5s)
  const typingDelay = Math.min(Math.max(text.length * 30, 1000), 5000);
  await new Promise(r => setTimeout(r, typingDelay));

  // Stop typing
  try {
    await sock.sendPresenceUpdate('paused', jid);
  } catch (e) {
    // Non-fatal
  }

  // Send
  await sock.sendMessage(jid, { text });
  console.log(`[WA] Sent to Nopi: ${text.slice(0, 60)}`);
}

/**
 * Send a message to any JID with typing indicator.
 */
export async function sendToJid(jid, text) {
  if (!sock) throw new Error('WhatsApp not connected');

  try {
    await sock.presenceSubscribe(jid);
    await sock.sendPresenceUpdate('composing', jid);
  } catch (e) {}

  const typingDelay = Math.min(Math.max(text.length * 30, 1000), 5000);
  await new Promise(r => setTimeout(r, typingDelay));

  try {
    await sock.sendPresenceUpdate('paused', jid);
  } catch (e) {}

  await sock.sendMessage(jid, { text });
  console.log(`[WA] Sent to ${jid}: ${text.slice(0, 60)}`);
}

export function getSocket() { return sock; }
export function getMyJid() { return myJid; }
