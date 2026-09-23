const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'announcements.json');

// Ensure data directory and file exist
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

/**
 * Reads all announcements from data/announcements.json
 * @returns {Array} List of announcements
 */
function getAnnouncements() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[Storage Error] Failed to read announcements:', err.message);
    return [];
  }
}

/**
 * Saves all announcements atomically to data/announcements.json
 * @param {Array} list
 */
function saveAnnouncements(list) {
  ensureDataFile();
  const tempFile = `${DATA_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(list, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
    return true;
  } catch (err) {
    console.error('[Storage Error] Failed to write announcements:', err.message);
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (_) {}
    }
    // Fallback direct write if atomic rename fails on Windows file locks
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
      return true;
    } catch (fallbackErr) {
      console.error('[Storage Error] Direct write also failed:', fallbackErr.message);
      return false;
    }
  }
}

/**
 * Generates the next sequential unique ID (starting from 101 or max existing + 1)
 * @returns {number}
 */
function getNextId() {
  const items = getAnnouncements();
  if (items.length === 0) return 101;
  const maxId = items.reduce((max, item) => (typeof item.id === 'number' && item.id > max ? item.id : max), 100);
  return maxId + 1;
}

module.exports = {
  getAnnouncements,
  saveAnnouncements,
  getNextId
};
