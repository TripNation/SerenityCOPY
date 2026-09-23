const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(__dirname, '..', 'data', 'stats.json');

function ensureStatsFile() {
  const dir = path.dirname(STATS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(STATS_FILE)) {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const defaultData = {
      allTime: 1,
      monthDate: month,
      monthCount: 1,
      todayDate: today,
      todayCount: 1,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(STATS_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
  }
}

function getStats() {
  ensureStatsFile();
  try {
    const content = fs.readFileSync(STATS_FILE, 'utf-8');
    const data = JSON.parse(content);

    // Check for daily / monthly roll-over
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    let modified = false;
    if (data.todayDate !== today) {
      data.todayDate = today;
      data.todayCount = 0;
      modified = true;
    }
    if (data.monthDate !== month) {
      data.monthDate = month;
      data.monthCount = 0;
      modified = true;
    }

    if (modified) {
      saveStats(data);
    }

    return data;
  } catch (err) {
    console.error('[statsStorage] Error reading stats:', err);
    return {
      allTime: 0,
      monthDate: new Date().toISOString().slice(0, 7),
      monthCount: 0,
      todayDate: new Date().toISOString().slice(0, 10),
      todayCount: 0,
      lastUpdated: new Date().toISOString()
    };
  }
}

function saveStats(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[statsStorage] Error writing stats:', err);
    return false;
  }
}

function recordExecution() {
  const data = getStats();
  data.allTime = (Number(data.allTime) || 0) + 1;
  data.monthCount = (Number(data.monthCount) || 0) + 1;
  data.todayCount = (Number(data.todayCount) || 0) + 1;
  saveStats(data);
  return data;
}

module.exports = {
  getStats,
  saveStats,
  recordExecution
};
