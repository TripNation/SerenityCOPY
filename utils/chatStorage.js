const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'chat.json');
const MAX_MESSAGES = 100;

// Ensure data directory and file exist
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initial = [
      {
        id: 1,
        userId: "1",
        username: "SerenitySystem",
        displayName: "Serenity System",
        message: "Welcome to Serenity Hub Global Chat! Connect with players across all servers.",
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        createdAt: new Date().toISOString(),
        system: true
      }
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  }
}

let inMemoryMessages = null;

function loadMessages() {
  ensureDataFile();
  if (inMemoryMessages) return inMemoryMessages;
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    inMemoryMessages = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[ChatStorage Error] Failed to read chat:', err.message);
    inMemoryMessages = [];
  }
  return inMemoryMessages;
}

function persistMessages() {
  ensureDataFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(inMemoryMessages.slice(-MAX_MESSAGES), null, 2), 'utf-8');
  } catch (err) {
    console.error('[ChatStorage Error] Failed to write chat:', err.message);
  }
}

/**
 * Returns messages optionally after a specific message ID and filtered by room
 * @param {number|null} afterId
 * @param {number} limit
 * @param {string|null} room
 */
function getMessages(afterId = null, limit = 50, room = null) {
  const msgs = loadMessages();
  let filtered = msgs;

  if (room && room !== 'all') {
    const rLower = String(room).toLowerCase();
    filtered = filtered.filter(m => !m.room || m.room.toLowerCase() === rLower);
  }

  if (afterId !== null && !isNaN(afterId)) {
    const num = Number(afterId);
    filtered = filtered.filter(m => m.id > num);
  }

  return filtered.slice(-Math.min(limit, 100));
}

/**
 * Adds a new chat message
 */
function addMessage({ userId, username, displayName, message, gameName = "", room = "general", translations = null, isAdmin = false, role = null, system = false }) {
  const msgs = loadMessages();
  const maxId = msgs.reduce((max, m) => (m.id > max ? m.id : max), 0);
  const nextId = maxId + 1;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const cleanMsg = String(message || "").trim().slice(0, 200);

  const newEntry = {
    id: nextId,
    userId: String(userId || "0"),
    username: String(username || "Anonymous").slice(0, 25),
    displayName: String(displayName || username || "Anonymous").slice(0, 30),
    gameName: String(gameName || "Serenity Hub").slice(0, 40),
    room: String(room || "general").toLowerCase().slice(0, 25),
    message: cleanMsg,
    translations: translations || {
      original: cleanMsg,
      en: cleanMsg,
      id: cleanMsg,
      tl: cleanMsg,
      vi: cleanMsg,
      pt: cleanMsg,
      es: cleanMsg
    },
    isAdmin: !!isAdmin,
    role: role || (isAdmin ? "Owner" : null),
    time: timeStr,
    createdAt: now.toISOString(),
    system: !!system
  };

  msgs.push(newEntry);
  if (msgs.length > MAX_MESSAGES) {
    msgs.splice(0, msgs.length - MAX_MESSAGES);
  }

  persistMessages();
  return newEntry;
}

let isChatMuted = false;

function getChatMuted() {
  return isChatMuted;
}

function setChatMuted(val) {
  isChatMuted = !!val;
  return isChatMuted;
}

function clearMessages() {
  inMemoryMessages = [];
  persistMessages();
  return true;
}

/**
 * Automatically repairs any stored messages that lack complete multi-language translations
 */
async function repairMissingTranslations() {
  try {
    const { translateMessageToAll } = require('./translator');
    const msgs = loadMessages();
    let updated = false;

    for (const m of msgs) {
      if (!m.message || m.system) continue;
      const t = m.translations;
      const isMissingTranslations = !t || !t.es || !t.id || !t.vi || !t.tl || !t.pt ||
        (t.es === m.message && t.id === m.message && t.vi === m.message && m.message.trim().length > 1);

      if (isMissingTranslations) {
        const repaired = await translateMessageToAll(m.message);
        m.translations = repaired;
        updated = true;
      }
    }

    if (updated) {
      persistMessages();
      console.log('[ChatStorage] Successfully repaired stored message translations.');
    }
  } catch (err) {
    console.warn('[ChatStorage] Repair translations error:', err.message);
  }
}

// Run repair 2 seconds after startup
setTimeout(repairMissingTranslations, 2000);

module.exports = {
  getMessages,
  addMessage,
  clearMessages,
  getChatMuted,
  setChatMuted,
  repairMissingTranslations
};

