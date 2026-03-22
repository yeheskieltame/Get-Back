import { spawn } from 'node:child_process';
import config from './config.js';

// ── Conversation memory ───────────────────────────────────────────
// Single conversation thread (agent talks to one person)
const history = [];
let lastActivityTs = 0;

function getHistory() {
  const now = Date.now();

  // Reset if stale
  if (history.length > 0 && lastActivityTs > 0) {
    if (now - lastActivityTs > config.contextTtlMs) {
      history.length = 0;
    }
  }

  return history;
}

/**
 * Build the full prompt with conversation context
 */
function buildPrompt(conversationHistory, newMessage, direction) {
  const recent = conversationHistory.slice(-(config.maxContext * 2));

  let prompt = '';

  if (recent.length > 0) {
    prompt += '<conversation_history>\n';
    for (const msg of recent) {
      const label = msg.role === 'nopi' ? 'Nopi' : 'Kiel';
      prompt += `${label}: ${msg.text}\n`;
    }
    prompt += '</conversation_history>\n\n';
  }

  if (direction === 'incoming') {
    prompt += `Nopi baru saja mengirim pesan ini:\n"${newMessage}"\n\n`;
    prompt += `Balas sebagai Kiel. Hanya tulis pesan balasan, tanpa penjelasan atau catatan tambahan. Jangan pakai tanda kutip di awal/akhir.`;
  } else {
    prompt += `${newMessage}`;
  }

  return prompt;
}

/**
 * Run Claude Code CLI
 */
function runClaude(prompt, systemPrompt) {
  return new Promise((resolve, reject) => {
    const args = [
      '--print',
      '--output-format', 'text',
    ];

    if (systemPrompt) {
      args.push('--append-system-prompt', systemPrompt);
    }

    if (config.claudeModel) {
      args.push('--model', config.claudeModel);
    }

    args.push('--max-tokens', String(config.claudeMaxTokens));

    const proc = spawn(config.claudeBin, args, {
      timeout: 120_000,
      env: { ...process.env },
    });

    // Send prompt via stdin
    proc.stdin.write(prompt);
    proc.stdin.end();

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`claude exited ${code}: ${stderr.trim().slice(0, 300)}`));
      }
    });

    proc.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error(
          `Claude CLI not found at "${config.claudeBin}". ` +
          'Install: npm i -g @anthropic-ai/claude-code && claude login'
        ));
      } else {
        reject(err);
      }
    });
  });
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Generate a reply to an incoming message from Nopi.
 * @param {string} incomingText - What Nopi said
 * @param {string} systemPrompt - The PDKT system prompt
 * @returns {{ text: string, error: Error|null }}
 */
export async function generateReply(incomingText, systemPrompt) {
  const h = getHistory();

  const prompt = buildPrompt(h, incomingText, 'incoming');

  try {
    const response = await runClaude(prompt, systemPrompt);

    // Record both sides
    h.push({ role: 'nopi', text: incomingText, ts: Date.now() });
    h.push({ role: 'kiel', text: response, ts: Date.now() });
    lastActivityTs = Date.now();

    // Trim
    while (h.length > config.maxContext * 2) {
      h.shift();
    }

    return { text: response, error: null };
  } catch (err) {
    console.error('[Claude] Error:', err.message);
    return { text: null, error: err };
  }
}

/**
 * Ask Claude for a strategy analysis.
 * @param {string} question - What to analyze
 * @param {string} systemPrompt - System prompt
 * @returns {string|null}
 */
export async function analyze(question, systemPrompt) {
  const h = getHistory();
  const prompt = buildPrompt(h, question, 'analysis');

  try {
    return await runClaude(prompt, systemPrompt);
  } catch (err) {
    console.error('[Claude] Analysis error:', err.message);
    return null;
  }
}

/**
 * Record a message we sent (so context stays in sync when we initiate)
 */
export function recordOutgoing(text) {
  const h = getHistory();
  h.push({ role: 'kiel', text, ts: Date.now() });
  lastActivityTs = Date.now();
}

/**
 * Get conversation stats
 */
export function getConversationStats() {
  return {
    messageCount: history.length,
    lastActivity: lastActivityTs ? new Date(lastActivityTs).toISOString() : 'never',
  };
}

/**
 * Reset conversation memory
 */
export function resetConversation() {
  history.length = 0;
  lastActivityTs = 0;
}
