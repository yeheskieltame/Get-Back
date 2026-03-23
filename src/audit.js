import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const LOG_DIR = './logs';
const LOG_FILE = join(LOG_DIR, `audit-${new Date().toISOString().slice(0, 10)}.jsonl`);

// Ensure log directory exists
try { mkdirSync(LOG_DIR, { recursive: true }); } catch {}

function write(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
  try {
    appendFileSync(LOG_FILE, line);
  } catch (err) {
    console.error('[Audit] Write failed:', err.message);
  }
}

export function logBoot(config) {
  write({ event: 'boot', mode: config.mode, target: config.target, model: config.model });
}

export function logIncoming(text) {
  write({ event: 'incoming', from: 'target', length: text.length, preview: text.slice(0, 100) });
}

export function logOutgoing(text, phase) {
  write({ event: 'outgoing', to: 'target', phase, length: text.length, preview: text.slice(0, 100) });
}

export function logSentiment(sentiment) {
  write({ event: 'sentiment', ...sentiment });
}

export function logPhaseChange(from, to) {
  write({ event: 'phase_change', from, to });
}

export function logDecision(action, reason) {
  write({ event: 'decision', action, reason });
}

export function logError(context, error) {
  write({ event: 'error', context, error });
}

export function logModeSwitch(mode, target) {
  write({ event: 'mode_switch', mode, target });
}
