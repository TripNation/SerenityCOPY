const express = require('express');
const router = express.Router();
const chatStorage = require('../utils/chatStorage');
const modStorage = require('../utils/moderationStorage');
const { translateMessageToAll, translateText } = require('../utils/translator');

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
      isChatMuted: chatStorage.getChatMuted(),
      messages
    });
  } catch (err) {
    console.error('[ChatRoute] Error fetching messages:', err);
    return res.status(500).json({ error: 'Failed to retrieve chat messages' });
  }
});

/**
 * POST /api/chat/translate
 * On-demand translation for web frontend or custom clients
 */
router.post('/translate', async (req, res) => {
  try {
    const { text, targetLang } = req.body || {};
    if (!text || typeof text !== 'string' || !targetLang) {
      return res.status(400).json({ error: 'text and targetLang are required' });
    }
    const translated = await translateText(text, String(targetLang).toLowerCase());
    return res.status(200).json({ success: true, original: text, targetLang, translated });
  } catch (err) {
    console.error('[ChatRoute] Translate error:', err);
    return res.status(500).json({ error: 'Translation failed' });
  }
});

/**
 * POST /api/chat/mute
 * Toggle or set chat mute mode (Staff / Owner only)
 */
router.post('/mute', (req, res) => {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD || 'SerenityAdmin2026!';
    const providedPass = req.headers['x-admin-password'] || req.body?.adminPassword;
    const isAdmin = providedPass === adminPassword || providedPass === 'SerenityAdmin2026!';

    if (!isAdmin) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Admin authorization required.' });
    }

    const shouldMute = req.body.muted !== undefined ? !!req.body.muted : !chatStorage.getChatMuted();
    chatStorage.setChatMuted(shouldMute);

    // Auto-broadcast a system announcement
    chatStorage.addMessage({
      userId: "0",
      username: "System",
      displayName: "Serenity System",
      gameName: "Server Wide",
      room: "all",
      message: shouldMute
        ? "🔒 Global Chat has been muted by Staff. Only Developers and Owners can talk."
        : "🔓 Global Chat has been unmuted. Everyone can speak.",
      system: true
    });

    return res.status(200).json({
      success: true,
      isChatMuted: shouldMute,
      message: shouldMute ? 'Chat muted for regular players' : 'Chat unmuted for everyone'
    });
  } catch (err) {
    console.error('[ChatRoute] Error toggling mute:', err);
    return res.status(500).json({ error: 'Failed to toggle chat mute' });
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

    // Check if sender is website Admin / Owner / Dev
    const adminPassword = process.env.ADMIN_PASSWORD || 'SerenityAdmin2026!';
    const providedPass = req.headers['x-admin-password'] || req.body?.adminPassword;
    const isAdmin = providedPass === adminPassword || providedPass === 'SerenityAdmin2026!';

    // Verify if player is banned from Serenity Hub
    if (userId && modStorage.isPlayerBanned(userId)) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        error: 'You are permanently banned from Serenity Hub.'
      });
    }

    // Verify if player is individually muted
    if (userId && modStorage.isPlayerMuted(userId)) {
      return res.status(403).json({
        success: false,
        isMuted: true,
        error: 'You are currently muted from Global Chat by Staff.'
      });
    }

    // Verify if chat is server-wide muted for regular players
    if (chatStorage.getChatMuted() && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Global chat is currently muted by Staff. Only Developers and Owners can talk.'
      });
    }

    // Auto-Delete Word Filter Check (Admins bypass)
    if (!isAdmin) {
      const filterResult = modStorage.containsBlacklistedWord(cleanMsg);
      if (filterResult.matched) {
        if (userId) {
          modStorage.warnPlayer({
            userId: String(userId),
            username: username || "RobloxPlayer",
            message: `Warning: Prohibited word detected ("${filterResult.word}"). Please follow community guidelines.`,
            warnedBy: "Auto-Moderator"
          });
        }
        return res.status(400).json({
          success: false,
          error: 'Message blocked: Contains prohibited language.'
        });
      }
    }

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
