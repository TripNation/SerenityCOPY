const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'moderation.json');

// Initial default state
const DEFAULT_MODERATION_DATA = {
  banned: [],
  muted: [],
  warnings: [],
  pendingWarnings: [],
  blacklistedWords: [
    "nigger",
    "nigga",
    "faggot",
    "retard",
    "kys",
    "chink",
    "spic",
    "kike"
  ]
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_MODERATION_DATA, null, 2), 'utf-8');
  }
}

let inMemoryData = null;

function loadData() {
  ensureDataFile();
  if (inMemoryData) return inMemoryData;
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    inMemoryData = JSON.parse(raw);
    if (!Array.isArray(inMemoryData.banned)) inMemoryData.banned = [];
    if (!Array.isArray(inMemoryData.muted)) inMemoryData.muted = [];
    if (!Array.isArray(inMemoryData.warnings)) inMemoryData.warnings = [];
    if (!Array.isArray(inMemoryData.pendingWarnings)) inMemoryData.pendingWarnings = [];
    if (!Array.isArray(inMemoryData.blacklistedWords)) inMemoryData.blacklistedWords = DEFAULT_MODERATION_DATA.blacklistedWords;
  } catch (err) {
    console.error('[ModerationStorage Error] Failed to read moderation data:', err.message);
    inMemoryData = { ...DEFAULT_MODERATION_DATA };
  }
  return inMemoryData;
}

function persistData() {
  ensureDataFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(inMemoryData || DEFAULT_MODERATION_DATA, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ModerationStorage Error] Failed to write moderation data:', err.message);
  }
}

// -------------------------------------------------------------
// BAN MANAGEMENT (Full Script & Chat Anti-Injection Lockout)
// -------------------------------------------------------------
function isPlayerBanned(userId) {
  if (!userId) return false;
  const data = loadData();
  const uid = String(userId);
  return data.banned.some(b => String(b.userId) === uid);
}

function banPlayer({ userId, username, reason = "Violating Community Guidelines", bannedBy = "Admin" }) {
  if (!userId) return false;
  const data = loadData();
  const uid = String(userId);
  const uName = String(username || "UnknownPlayer");

  // Remove if already in list to update entry
  data.banned = data.banned.filter(b => String(b.userId) !== uid);

  const entry = {
    userId: uid,
    username: uName,
    reason: String(reason || "Violating Community Guidelines").slice(0, 100),
    bannedAt: new Date().toISOString(),
    bannedBy: String(bannedBy || "Admin")
  };
  data.banned.unshift(entry);

  // Also auto-mute banned players
  mutePlayer({ userId: uid, username: uName, reason: "Banned from Hub", mutedBy: bannedBy });

  persistData();
  return entry;
}

function unbanPlayer(userId) {
  if (!userId) return false;
  const data = loadData();
  const uid = String(userId);
  const beforeCount = data.banned.length;
  data.banned = data.banned.filter(b => String(b.userId) !== uid);
  
  // Also unmute on unban
  unmutePlayer(uid);

  persistData();
  return data.banned.length < beforeCount;
}

function getBannedPlayers() {
  return loadData().banned;
}

// -------------------------------------------------------------
// MUTE MANAGEMENT (Chat Lockout)
// -------------------------------------------------------------
function isPlayerMuted(userId) {
  if (!userId) return false;
  const data = loadData();
  const uid = String(userId);
  return data.muted.some(m => String(m.userId) === uid);
}

function mutePlayer({ userId, username, reason = "Muted by Administrator", mutedBy = "Admin" }) {
  if (!userId) return false;
  const data = loadData();
  const uid = String(userId);
  const uName = String(username || "UnknownPlayer");

  data.muted = data.muted.filter(m => String(m.userId) !== uid);

  const entry = {
    userId: uid,
    username: uName,
    reason: String(reason || "Muted by Administrator").slice(0, 100),
    mutedAt: new Date().toISOString(),
    mutedBy: String(mutedBy || "Admin")
  };
  data.muted.unshift(entry);
  persistData();
  return entry;
}

function unmutePlayer(userId) {
  if (!userId) return false;
  const data = loadData();
  const uid = String(userId);
  const beforeCount = data.muted.length;
  data.muted = data.muted.filter(m => String(m.userId) !== uid);
  persistData();
  return data.muted.length < beforeCount;
}

function getMutedPlayers() {
  return loadData().muted;
}

// -------------------------------------------------------------
// WARNING MANAGEMENT & LIVE NOTIFICATIONS
// -------------------------------------------------------------
function warnPlayer({ userId, username, message = "Please adhere to community rules.", warnedBy = "Admin" }) {
  if (!userId) return null;
  const data = loadData();
  const uid = String(userId);
  const uName = String(username || "UnknownPlayer");
  const warnMsg = String(message || "Please adhere to community rules.").slice(0, 150);

  const maxId = data.warnings.reduce((max, w) => (w.id > max ? w.id : max), 0);
  const nextId = maxId + 1;

  const logEntry = {
    id: nextId,
    userId: uid,
    username: uName,
    message: warnMsg,
    warnedAt: new Date().toISOString(),
    warnedBy: String(warnedBy || "Admin")
  };

  data.warnings.unshift(logEntry);
  if (data.warnings.length > 200) {
    data.warnings = data.warnings.slice(0, 200);
  }

  // Add to active queue so in-game client will trigger blur & notification
  data.pendingWarnings.push({
    id: nextId,
    userId: uid,
    message: warnMsg,
    createdAt: Date.now()
  });

  persistData();
  return logEntry;
}

function consumePendingWarning(userId) {
  if (!userId) return null;
  const data = loadData();
  const uid = String(userId);
  
  const idx = data.pendingWarnings.findIndex(w => String(w.userId) === uid);
  if (idx !== -1) {
    const warning = data.pendingWarnings[idx];
    data.pendingWarnings.splice(idx, 1);
    persistData();
    return warning;
  }
  return null;
}

function getWarningLogs() {
  return loadData().warnings;
}

function deleteWarningLog(id) {
  const data = loadData();
  const numId = Number(id);
  const before = data.warnings.length;
  data.warnings = data.warnings.filter(w => w.id !== numId);
  persistData();
  return data.warnings.length < before;
}

function clearWarningLogs() {
  const data = loadData();
  data.warnings = [];
  persistData();
  return true;
}

// -------------------------------------------------------------
// BLACKLISTED WORDS & AUTO-DELETION FILTER
// -------------------------------------------------------------
function getBlacklistedWords() {
  return loadData().blacklistedWords;
}

function addBlacklistedWord(word) {
  if (!word || typeof word !== 'string') return false;
  const clean = word.trim().toLowerCase();
  if (clean.length === 0) return false;

  const data = loadData();
  if (!data.blacklistedWords.includes(clean)) {
    data.blacklistedWords.push(clean);
    persistData();
    return true;
  }
  return false;
}

function removeBlacklistedWord(word) {
  if (!word || typeof word !== 'string') return false;
  const clean = word.trim().toLowerCase();
  const data = loadData();
  const before = data.blacklistedWords.length;
  data.blacklistedWords = data.blacklistedWords.filter(w => w.toLowerCase() !== clean);
  persistData();
  return data.blacklistedWords.length < before;
}

function containsBlacklistedWord(text) {
  if (!text || typeof text !== 'string') return { matched: false, word: null };
  const words = getBlacklistedWords();
  const lower = text.toLowerCase();

  for (const w of words) {
    if (!w) continue;
    // Word boundary or direct containment for slurs
    const regex = new RegExp(`\\b${escapeRegex(w)}\\b|${escapeRegex(w)}`, 'i');
    if (regex.test(lower)) {
      return { matched: true, word: w };
    }
  }
  return { matched: false, word: null };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  isPlayerBanned,
  banPlayer,
  unbanPlayer,
  getBannedPlayers,
  isPlayerMuted,
  mutePlayer,
  unmutePlayer,
  getMutedPlayers,
  warnPlayer,
  consumePendingWarning,
  getWarningLogs,
  deleteWarningLog,
  clearWarningLogs,
  getBlacklistedWords,
  addBlacklistedWord,
  removeBlacklistedWord,
  containsBlacklistedWord
};
