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
 * Returns messages optionally after a specific message ID
 * @param {number|null} afterId
 * @param {number} limit
 */
function getMessages(afterId = null, limit = 50) {
  const msgs = loadMessages();
  let filtered = msgs;

  if (afterId !== null && !isNaN(afterId)) {
    const num = Number(afterId);
    filtered = msgs.filter(m => m.id > num);
  }

  return filtered.slice(-Math.min(limit, 100));
}

/**
 * Adds a new chat message
 */
function addMessage({ userId, username, displayName, message, system = false }) {
  const msgs = loadMessages();
  const maxId = msgs.reduce((max, m) => (m.id > max ? m.id : max), 0);
  const nextId = maxId + 1;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const newEntry = {
    id: nextId,
    userId: String(userId || "0"),
    username: String(username || "Anonymous").slice(0, 25),
    displayName: String(displayName || username || "Anonymous").slice(0, 30),
    message: String(message || "").trim().slice(0, 200),
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

function clearMessages() {
  inMemoryMessages = [];
  persistMessages();
  return true;
}

module.exports = {
  getMessages,
  addMessage,
  clearMessages
};
