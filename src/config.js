import 'dotenv/config';

const config = {
  // WhatsApp
  targetNumber: process.env.TARGET_NUMBER || '',
  practiceNumber: process.env.PRACTICE_NUMBER || '',
  authDir: process.env.AUTH_DIR || './auth_info',

  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',

  // Claude
  claudeBin: process.env.CLAUDE_BIN || 'claude',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-opus-4-6',
  claudeMaxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '1024', 10),
  maxContext: parseInt(process.env.MAX_CONTEXT || '20', 10),
  contextTtlMs: parseInt(process.env.CONTEXT_TTL_MINUTES || '60', 10) * 60_000,

  // Strategy
  maxUnreplied: parseInt(process.env.MAX_UNREPLIED || '2', 10),
  minWaitHours: parseFloat(process.env.MIN_WAIT_HOURS || '1'),

  // Derived
  targetJid: (process.env.TARGET_NUMBER || '') + '@s.whatsapp.net',

  logLevel: process.env.LOG_LEVEL || 'warn',
};

export default config;
