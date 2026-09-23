const express = require('express');
const router = express.Router();
const statsStorage = require('../utils/statsStorage');

// In-memory active Roblox client sessions: Map<string, number> (clientId -> lastSeenTimestamp)
const activeClients = new Map();
const ACTIVE_TIMEOUT_MS = 10000; // 10 seconds rolling window (polls every 4s)

// Debounce map to prevent duplicate execution counts from the same injection (loader + game script + retries)
const recentInjections = new Map(); // Map<string, number> (clientId -> lastRecordedTimestamp)
const INJECTION_DEBOUNCE_MS = 60000; // 60 seconds debounce window per player/client ID

function getActiveCount() {
  const now = Date.now();
  for (const [id, lastSeen] of activeClients.entries()) {
    if (now - lastSeen > ACTIVE_TIMEOUT_MS) {
      activeClients.delete(id);
    }
  }
  // Clean up debounce cache older than 10 minutes
  for (const [id, time] of recentInjections.entries()) {
    if (now - time > 600000) {
      recentInjections.delete(id);
    }
  }
  return activeClients.size;
}

function touchClient(req, isInit = false) {
  const src = req.query?.src || req.headers?.['x-infinity-source'];
  const cid = req.query?.cid || req.headers?.['x-client-id'] || req.body?.cid;
  const isLeave = req.query?.leave === '1' || req.body?.leave === true || req.headers?.['x-infinity-leave'] === '1';

  if (isLeave && cid) {
    activeClients.delete(String(cid));
    return;
  }

  const ua = (req.headers?.['user-agent'] || '').toLowerCase();
  const isRoblox = src === 'roblox' || ua.includes('roblox') || ua.includes('synapse') || ua.includes('fluxus');

  if (!isRoblox || !cid) {
    return; // Ignore regular web browser visits, curl, and Render health checks
  }

  activeClients.set(String(cid), Date.now());

  if (isInit) {
    const lastInit = recentInjections.get(String(cid)) || 0;
    const now = Date.now();
    // Only increment execution count ONCE per client per 60 seconds
    if (now - lastInit > INJECTION_DEBOUNCE_MS) {
      recentInjections.set(String(cid), now);
      statsStorage.recordExecution();
    }
  }
}

/**
 * GET /api/stats
 * Public endpoint returning current active players count and execution statistics
 */
router.get('/', (req, res) => {
  try {
    const stats = statsStorage.getStats();
    const activeNow = getActiveCount();

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({
      success: true,
      activeNow,
      executionsToday: stats.todayCount,
      thisMonth: stats.monthCount,
      allTime: stats.allTime,
      lastUpdated: stats.lastUpdated || new Date().toISOString()
    });
  } catch (err) {
    console.error('[statsRoute] Error fetching stats:', err);
    return res.status(500).json({ error: 'Failed to retrieve telemetry stats' });
  }
});

/**
 * GET/POST /api/stats/ping
 * Heartbeat, injection counter & player leave endpoint called exclusively by Roblox scripts
 */
const handlePing = (req, res) => {
  try {
    const isInit = req.query.init === '1' || req.body?.init === true || req.headers['x-infinity-init'] === '1';

    touchClient(req, isInit);

    const stats = statsStorage.getStats();
    const activeNow = getActiveCount();

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    return res.status(200).json({
      success: true,
      activeNow,
      executionsToday: stats.todayCount,
      thisMonth: stats.monthCount,
      allTime: stats.allTime
    });
  } catch (err) {
    console.error('[statsRoute] Error handling ping:', err);
    return res.status(500).json({ error: 'Ping processing error' });
  }
};

router.get('/ping', handlePing);
router.post('/ping', handlePing);

module.exports = {
  router,
  touchClient,
  getActiveCount
};
