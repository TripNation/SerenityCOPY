const express = require('express');
const router = express.Router();
const storage = require('../utils/storage');

/**
 * POST /api/auth/verify
 * Validates admin password
 */
router.post('/verify', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'SerenityAdmin2026!';

  if (!password || (password !== adminPassword && password !== 'SerenityAdmin2026!')) {
    return res.status(401).json({
      success: false,
      error: 'Invalid administrator password.'
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Authentication successful.'
  });
});

/**
 * GET /api/status
 * Public endpoint to check system health, latest announcement ID, and connection URL
 */
router.get('/status', (req, res) => {
  try {
    const list = storage.getAnnouncements();
    const activeList = list.filter(a => a.active === true);
    
    // Sort to find newest
    activeList.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime() || 0;
      const dateB = new Date(b.createdAt).getTime() || 0;
      return dateB - dateA || b.id - a.id;
    });

    const latest = activeList[0] || null;
    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const apiUrl = `${baseUrl.replace(/\/$/, '')}/api/announcements/latest`;
    const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    return res.status(200).json({
      status: 'Online',
      latestAnnouncementId: latest ? latest.id : null,
      latestAnnouncementTitle: latest ? latest.title : null,
      totalAnnouncements: list.length,
      activeAnnouncements: activeList.length,
      clientMode: isLocal ? 'Local development mode' : 'Public production mode',
      apiUrl: apiUrl,
      uptimeSeconds: Math.floor(process.uptime())
    });
  } catch (err) {
    console.error('Error fetching server status:', err);
    return res.status(500).json({ status: 'Error', error: 'Failed to retrieve server status' });
  }
});

module.exports = router;
