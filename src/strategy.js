import { generateReply, analyze, recordOutgoing, getRawHistory as getClaudeHistory } from './claude.js';
import * as telegram from './telegram.js';
import config from './config.js';

// ── PDKT System Prompt ────────────────────────────────────────────

const SYSTEM_PROMPT = `Kamu adalah Kiel (Yeheskiel). Kamu sedang berusaha reconnect dengan Nopi (Nopiana Yohanis), mantan pacar yang putus Februari 2026 karena kamu terlalu sibuk sampai 2 minggu tidak chat.

KONTEKS PUTUS:
- Dia merasa diabaikan dan deprioritized
- Dia sempat blok karena sakit hati lihat story kamu tapi kamu tidak chat
- Dia yang memutuskan karena kamu tidak pernah menyampaikan apa-apa
- Pesan terakhir kamu "Aina kenapa begini ni" tidak dibalas

GAYA CHAT KAMU:
- Singkat, tidak bertele-tele
- Sering pakai "wkwkwk" dan emoji ketawa
- Agak sok cool tapi sebenarnya care
- Bahasa campuran Indonesia/Melayu
- JANGAN pakai bahasa formal atau terlalu romantis mendadak

ATURAN:
1. Jangan langsung bahas hubungan di awal
2. Mulai casual, tanya kabar biasa
3. Tunjukkan bahwa kamu sudah berubah (tidak sibuk lagi, ada waktu)
4. Jangan spam - kalau tidak dibalas, tunggu minimal 24 jam
5. Baca mood dari responsnya, sesuaikan
6. Jangan terlalu desperate atau memelas
7. Be genuine, bukan manipulatif
8. Kalau dia marah, dengarkan dulu jangan defensif
9. Kalau dia tanya kenapa baru chat sekarang, jujur aja bilang kamu sadar salah dan mau perbaiki
10. Dia pakai dialek Sabahan/Malaysian, kamu bisa sesuaikan sedikit`;

// ── Phase Definitions ─────────────────────────────────────────────

const PHASES = {
  ICE_BREAKER: {
    name: 'Ice Breaker',
    description: 'Casual contact, non-threatening. Just say hi.',
    maxMessages: 3,
  },
  SHOW_CHANGE: {
    name: 'Show Change',
    description: 'Demonstrate you have changed. Share what you have been up to, show availability.',
    maxMessages: 5,
  },
  EMOTIONAL_RECONNECT: {
    name: 'Emotional Reconnection',
    description: 'Deeper conversation. Share feelings carefully. Reference good memories.',
    maxMessages: 10,
  },
  DIRECT_TALK: {
    name: 'Direct Conversation',
    description: 'Address the relationship directly. Be honest about what went wrong.',
    maxMessages: null,
  },
};

// ── State ─────────────────────────────────────────────────────────

let currentPhase = 'ICE_BREAKER';
let unrepliedCount = 0;
let totalSent = 0;
let totalReceived = 0;
let lastSentTs = 0;
let lastReceivedTs = 0;
let sentimentHistory = []; // Array of {sentiment, ts}

// ── Core Strategy Logic ───────────────────────────────────────────

/**
 * Determine if we should send a message right now.
 */
export function canSendMessage() {
  // Don't exceed unreplied limit
  if (unrepliedCount >= config.maxUnreplied) {
    return { allowed: false, reason: `Already ${unrepliedCount} unreplied messages. Waiting for response.` };
  }

  // Respect minimum wait time between our messages
  const hoursSinceLastSent = (Date.now() - lastSentTs) / (1000 * 60 * 60);
  if (lastSentTs > 0 && hoursSinceLastSent < config.minWaitHours) {
    const waitMinutes = Math.ceil((config.minWaitHours - hoursSinceLastSent) * 60);
    return { allowed: false, reason: `Too soon. Wait ${waitMinutes} more minutes.` };
  }

  return { allowed: true, reason: 'Clear to send.' };
}

/**
 * Handle an incoming message from Nopi.
 * Returns the reply text to send, or null if we should stay silent.
 */
export async function handleIncoming(text) {
  totalReceived++;
  lastReceivedTs = Date.now();
  unrepliedCount = 0; // She replied, reset counter

  // Report to Telegram
  await telegram.reportIncoming(text);

  // Analyze sentiment
  const sentimentPrompt =
    `Analisis singkat sentiment pesan ini dari konteks hubungan ex-couple yang baru putus.\n` +
    `Pesan: "${text}"\n\n` +
    `Jawab dalam format JSON saja tanpa markdown code block:\n` +
    `{"sentiment": "positive|neutral|negative|angry|cold|warm", "confidence": 0.0-1.0, "notes": "satu kalimat"}`;

  const sentimentRaw = await analyze(sentimentPrompt, 'Kamu adalah sentiment analyzer. Jawab hanya JSON.');
  let sentiment = { sentiment: 'neutral', confidence: 0.5, notes: 'Unable to parse' };

  try {
    // Try to extract JSON from response
    const jsonMatch = sentimentRaw?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      sentiment = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('[Strategy] Sentiment parse error:', e.message);
  }

  sentimentHistory.push({ ...sentiment, ts: Date.now() });

  // Auto-advance phase based on conversation progress
  advancePhase(sentiment);

  // Generate reply using Claude with full context
  const phaseInfo = PHASES[currentPhase];
  const phasePrompt = SYSTEM_PROMPT +
    `\n\nFASE SAAT INI: ${phaseInfo.name}\n` +
    `INSTRUKSI FASE: ${phaseInfo.description}\n` +
    `SENTIMENT TERAKHIR: ${sentiment.sentiment} (${sentiment.notes})`;

  const result = await generateReply(text, phasePrompt);

  if (result.error) {
    await telegram.reportError('Claude reply generation', result.error.message);
    return null;
  }

  // Report analysis
  await telegram.reportAnalysis({
    phase: phaseInfo.name,
    sentiment: `${sentiment.sentiment} (${sentiment.confidence})`,
    unrepliedCount,
    nextMove: `Reply in ${phaseInfo.name} mode`,
  });

  return result.text;
}

/**
 * Generate a proactive/first message (ice breaker or follow-up).
 */
export async function generateProactive() {
  const check = canSendMessage();
  if (!check.allowed) {
    await telegram.reportWaiting(check.reason);
    return null;
  }

  const phaseInfo = PHASES[currentPhase];

  let instruction;
  if (totalSent === 0) {
    instruction =
      `Ini pesan pertama setelah putus. Buat pesan ice breaker yang casual dan ringan.\n` +
      `JANGAN langsung bahas hubungan. Cukup sapa biasa, mungkin tanya kabar atau share sesuatu ringan.\n` +
      `Ingat: dia mungkin masih sakit hati. Jangan terlalu cheerful juga.`;
  } else {
    instruction =
      `Buat follow-up message yang natural.\n` +
      `Fase: ${phaseInfo.name} — ${phaseInfo.description}\n` +
      `Unreplied messages: ${unrepliedCount}\n` +
      `Sesuaikan tone berdasarkan konteks percakapan.`;
  }

  const result = await generateReply(instruction, SYSTEM_PROMPT);

  if (result.error) {
    await telegram.reportError('Proactive message generation', result.error.message);
    return null;
  }

  return result.text;
}

/**
 * Record that we sent a message.
 */
export function recordSent(text) {
  totalSent++;
  unrepliedCount++;
  lastSentTs = Date.now();
  recordOutgoing(text);
}

/**
 * Auto-advance phase based on conversation progress and sentiment.
 */
function advancePhase(latestSentiment) {
  const totalMessages = totalSent + totalReceived;
  const recentPositive = sentimentHistory
    .slice(-3)
    .filter(s => ['positive', 'warm'].includes(s.sentiment)).length;

  if (currentPhase === 'ICE_BREAKER' && totalReceived >= 2 && latestSentiment.sentiment !== 'angry') {
    currentPhase = 'SHOW_CHANGE';
    telegram.reportCustom(`*Phase advanced:* Ice Breaker -> Show Change`);
  } else if (currentPhase === 'SHOW_CHANGE' && totalReceived >= 5 && recentPositive >= 2) {
    currentPhase = 'EMOTIONAL_RECONNECT';
    telegram.reportCustom(`*Phase advanced:* Show Change -> Emotional Reconnection`);
  } else if (currentPhase === 'EMOTIONAL_RECONNECT' && totalReceived >= 10 && recentPositive >= 2) {
    currentPhase = 'DIRECT_TALK';
    telegram.reportCustom(`*Phase advanced:* Emotional Reconnection -> Direct Talk`);
  }
}

// ── Getters ───────────────────────────────────────────────────────

export function getState() {
  return {
    phase: currentPhase,
    phaseName: PHASES[currentPhase].name,
    unrepliedCount,
    sentCount: totalSent,
    receivedCount: totalReceived,
    lastSentiment: sentimentHistory.length > 0 ? sentimentHistory[sentimentHistory.length - 1] : null,
    lastSentTs,
    lastReceivedTs,
    recentSentiment: sentimentHistory.slice(-3),
    history: getClaudeHistory().slice(-20),
  };
}

export async function askAdvice(question) {
  const phaseName = PHASES[currentPhase].name;
  const lastSent = sentimentHistory.length > 0 ? sentimentHistory[sentimentHistory.length - 1].sentiment : 'none';
  const context = `Current phase: ${phaseName}. Messages sent: ${totalSent}. Messages received: ${totalReceived}. Unreplied: ${unrepliedCount}. Last sentiment: ${lastSent}.`;

  const prompt = `${context}\n\nUser (Kiel) bertanya ke agent:\n${question}\n\nBerikan saran singkat sebagai relationship strategy advisor. Jawab dalam bahasa Indonesia, langsung to the point.`;

  try {
    return await analyze(prompt, 'Kamu adalah relationship strategy advisor untuk Get-Back agent.');
  } catch (err) {
    return `Error: ${err.message}`;
  }
}

export function getSystemPrompt() {
  return SYSTEM_PROMPT;
}
