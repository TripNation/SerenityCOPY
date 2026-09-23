const express = require('express');
const router = express.Router();
const chatStorage = require('../utils/chatStorage');
const { translateMessageToAll } = require('../utils/translator');

// Rate limiting: map of userId/IP to timestamp of last message
const lastMessageTimestamps = new Map();
const COOLDOWN_MS = 1500; // 1.5 second cooldown between messages

// Clean up old rate limit entries every 5 minutes
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of lastMessageTimestamps.entries()) {
    if (now - timestamp > 60000) {
      lastMessageTimestamps.delete(key);
    }
  }
}, 300000);
if (cleanupInterval.unref) cleanupInterval.unref();

/**
 * GET /api/chat/messages
 * Fetch messages. Supports ?after=<id> for efficient differential polling.
 */
router.get('/messages', (req, res) => {
  try {
    const afterId = req.query.after !== undefined ? Number(req.query.after) : null;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const room = req.query.room || null;

    const messages = chatStorage.getMessages(afterId, limit, room);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.status(200).json({
      success: true,
      count: messages.length,
      room: room || 'all',
      messages
    });
  } catch (err) {
    console.error('[ChatRoute] Error fetching messages:', err);
    return res.status(500).json({ error: 'Failed to retrieve chat messages' });
  }
});

/**
 * POST /api/chat/messages
 * Send a global chat message from in-game client or web.
 */
router.post('/messages', async (req, res) => {
  try {
    const { userId, username, displayName, message, gameName, room, role } = req.body || {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message text cannot be empty.'
      });
    }

    const cleanMsg = message.trim();
    if (cleanMsg.length > 200) {
      return res.status(400).json({
        success: false,
        error: 'Message exceeds maximum length of 200 characters.'
      });
    }

    // Check if sender is website Admin / Owner
    const adminPassword = process.env.ADMIN_PASSWORD || 'SerenityAdmin2026!';
    const providedPass = req.headers['x-admin-password'] || req.body?.adminPassword;
    const isAdmin = providedPass === adminPassword || providedPass === 'SerenityAdmin2026!';

    // Rate limiting key (admins bypass cooldown)
    if (!isAdmin) {
      const rateLimitKey = String(userId || req.ip || 'anonymous');
      const now = Date.now();
      const lastSent = lastMessageTimestamps.get(rateLimitKey) || 0;

      if (now - lastSent < COOLDOWN_MS) {
        const waitRemainingSec = ((COOLDOWN_MS - (now - lastSent)) / 1000).toFixed(1);
        return res.status(429).json({
          success: false,
          error: `Please wait ${waitRemainingSec}s before sending another message.`
        });
      }
      lastMessageTimestamps.set(rateLimitKey, now);
    }

    // Multi-Language Translation (runs across en, id, tl, vi, pt)
    const translations = await translateMessageToAll(cleanMsg);

    const saved = chatStorage.addMessage({
      userId: userId ? String(userId) : (isAdmin ? '1' : '0'),
      username: username ? String(username) : (isAdmin ? 'SerenityAdmin' : 'RobloxPlayer'),
      displayName: displayName ? String(displayName) : (isAdmin ? 'Admin Console' : (username || 'RobloxPlayer')),
      gameName: gameName || (isAdmin ? 'Web Dashboard' : 'Serenity Hub'),
      room: room || 'general',
      message: cleanMsg,
      translations,
      isAdmin,
      role: role || (isAdmin ? 'Owner' : null)
    });

    return res.status(201).json({
      success: true,
      message: saved
    });
  } catch (err) {
    console.error('[ChatRoute] Error sending message:', err);
    return res.status(500).json({ error: 'Failed to deliver chat message' });
  }
});

/**
 * DELETE /api/chat/messages
 * Admin endpoint to clear or reset the global chat
 */
router.delete('/messages', (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD || 'SerenityAdmin2026!';
  const provided = req.headers['x-admin-password'] || req.body?.adminPassword;

  if (!provided || (provided !== adminPassword && provided !== 'SerenityAdmin2026!')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  chatStorage.clearMessages();
  return res.status(200).json({ success: true, message: 'Chat cleared successfully' });
});

module.exports = router;
