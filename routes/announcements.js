const express = require('express');
const router = express.Router();
const storage = require('../utils/storage');
const { touchClient } = require('./stats');

// Middleware: Verify Admin Password for write operations
function requireAdmin(req, res, next) {
  const adminPassword = (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== 'infinityadmin123')
    ? process.env.ADMIN_PASSWORD
    : 'InfinityX9!';

  // If no password is set in .env, log a warning but allow for zero-config local dev
  if (!adminPassword || adminPassword === 'CHANGE_THIS_PASSWORD') {
    // If user hasn't changed default, allow or check header
    // Still require header match if provided
  }

  const providedPassword = req.headers['x-admin-password'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null) ||
    req.body?.adminPassword;

  if (adminPassword && adminPassword !== 'CHANGE_THIS_PASSWORD') {
    if (!providedPassword || providedPassword !== adminPassword) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid or missing administrator password.'
      });
    }
  }

  next();
}

/**
 * GET /api/announcements/latest
 * Public endpoint for Infinity Hub clients.
 * Returns the most recent active announcement.
 */
router.get('/latest', (req, res) => {
  try {
    touchClient(req);

    const list = storage.getAnnouncements();
    // Filter active announcements, sorted by createdAt descending or highest ID
    const activeList = list.filter(a => a.active === true);

    if (activeList.length === 0) {
      return res.status(200).json(null);
    }

    // Sort newest first (highest ID or latest createdAt)
    activeList.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime() || 0;
      const dateB = new Date(b.createdAt).getTime() || 0;
      return dateB - dateA || b.id - a.id;
    });

    const latest = activeList[0];
    return res.status(200).json(latest);
  } catch (err) {
    console.error('Error fetching latest announcement:', err);
    return res.status(500).json({ error: 'Internal server error while fetching announcement' });
  }
});

/**
 * GET /api/announcements
 * Returns all announcements (newest first).
 */
router.get('/', (req, res) => {
  try {
    const list = storage.getAnnouncements();
    const sorted = [...list].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime() || 0;
      const dateB = new Date(b.createdAt).getTime() || 0;
      return dateB - dateA || b.id - a.id;
    });
    return res.status(200).json(sorted);
  } catch (err) {
    console.error('Error listing announcements:', err);
    return res.status(500).json({ error: 'Failed to retrieve announcements' });
  }
});

/**
 * POST /api/announcements
 * Creates a new announcement. Requires admin password.
 */
router.post('/', requireAdmin, (req, res) => {
  try {
    const {
      title,
      message,
      type = 'announcement',
      target = 'everyone',
      targetModule = null,
      targetPlaceId = null,
      minimumHubVersion = null,
      duration = 10,
      active = true
    } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Announcement message is required.' });
    }

    const finalTitle = (title && title.trim()) ? title.trim() : 'Serenity Announcement';


    // Normalize duration
    let parsedDuration = 10;
    if (duration === 'persistent' || duration === 0 || duration === '0') {
      parsedDuration = 0; // 0 represents persistent
    } else {
      parsedDuration = parseInt(duration, 10);
      if (isNaN(parsedDuration) || parsedDuration < 0) parsedDuration = 10;
    }

    const newAnnouncement = {
      id: storage.getNextId(),
      title: finalTitle,
      message: message.trim(),

      type: (type || 'announcement').toLowerCase().trim(),
      target: (target || 'everyone').toLowerCase().trim(),
      targetModule: targetModule && targetModule.trim() ? targetModule.trim() : null,
      targetPlaceId: targetPlaceId && String(targetPlaceId).trim() ? String(targetPlaceId).trim() : null,
      minimumHubVersion: minimumHubVersion && minimumHubVersion.trim() ? minimumHubVersion.trim() : null,
      duration: parsedDuration,
      active: active !== false,
      createdAt: new Date().toISOString()
    };

    const list = storage.getAnnouncements();
    if (newAnnouncement.active) {
      list.forEach(a => { a.active = false; });
    }
    list.push(newAnnouncement);
    const saved = storage.saveAnnouncements(list);

    if (!saved) {
      return res.status(500).json({ success: false, error: 'Failed to save announcement to storage.' });
    }

    console.log(`[Admin] Created announcement ID ${newAnnouncement.id}: "${newAnnouncement.title}"`);
    return res.status(201).json({
      success: true,
      announcement: newAnnouncement
    });
  } catch (err) {
    console.error('Error creating announcement:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PATCH /api/announcements/:id
 * Allows editing or disabling an announcement. Requires admin password.
 */
router.patch('/:id', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid announcement ID.' });
    }

    const list = storage.getAnnouncements();
    const index = list.findIndex(a => a.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: `Announcement with ID ${id} not found.` });
    }

    const existing = list[index];
    const {
      title,
      message,
      type,
      target,
      targetModule,
      minimumHubVersion,
      duration,
      active
    } = req.body;

    if (title !== undefined) existing.title = String(title).trim();
    if (message !== undefined) existing.message = String(message).trim();
    if (type !== undefined) existing.type = String(type).toLowerCase().trim();
    if (target !== undefined) existing.target = String(target).toLowerCase().trim();
    if (targetModule !== undefined) {
      existing.targetModule = targetModule && String(targetModule).trim() ? String(targetModule).trim() : null;
    }
    if (req.body.targetPlaceId !== undefined) {
      existing.targetPlaceId = req.body.targetPlaceId && String(req.body.targetPlaceId).trim() ? String(req.body.targetPlaceId).trim() : null;
    }
    if (minimumHubVersion !== undefined) {
      existing.minimumHubVersion = minimumHubVersion && String(minimumHubVersion).trim() ? String(minimumHubVersion).trim() : null;
    }
    if (duration !== undefined) {
      if (duration === 'persistent' || duration === 0 || duration === '0') {
        existing.duration = 0;
      } else {
        const parsedDur = parseInt(duration, 10);
        existing.duration = isNaN(parsedDur) ? 10 : parsedDur;
      }
    }
    if (active !== undefined) {
      existing.active = Boolean(active);
    }

    storage.saveAnnouncements(list);
    console.log(`[Admin] Updated announcement ID ${id}`);

    return res.status(200).json({
      success: true,
      announcement: existing
    });
  } catch (err) {
    console.error('Error updating announcement:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /api/announcements/:id
 * Deletes an announcement. Requires admin password.
 */
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid announcement ID.' });
    }

    const list = storage.getAnnouncements();
    const index = list.findIndex(a => a.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: `Announcement with ID ${id} not found.` });
    }

    const removed = list.splice(index, 1)[0];
    storage.saveAnnouncements(list);
    console.log(`[Admin] Deleted announcement ID ${id}`);

    return res.status(200).json({
      success: true,
      message: `Announcement ID ${id} was deleted successfully.`,
      announcement: removed
    });
  } catch (err) {
    console.error('Error deleting announcement:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
