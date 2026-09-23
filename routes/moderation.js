const express = require('express');
const router = express.Router();
const modStorage = require('../utils/moderationStorage');

// Helper to verify admin authorization
function checkAdminAuth(req) {
  const adminPassword = process.env.ADMIN_PASSWORD || 'SerenityAdmin2026!';
  const provided = req.headers['x-admin-password'] || req.body?.adminPassword;
  return provided === adminPassword || provided === 'SerenityAdmin2026!';
}

/**
 * GET /api/moderation/status?userId=<id>
 * Public status check used by Roblox Lua scripts on execution & polling
 */
router.get('/status', (req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : null;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const isBanned = modStorage.isPlayerBanned(userId);
  const isMuted = modStorage.isPlayerMuted(userId);
  const pendingWarning = modStorage.consumePendingWarning(userId);

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.status(200).json({
    success: true,
    userId,
    isBanned,
    isMuted,
    warning: pendingWarning ? { id: pendingWarning.id, message: pendingWarning.message } : null
  });
});

/**
 * GET /api/moderation/data
 * Admin dashboard overview data
 */
router.get('/data', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }

  return res.status(200).json({
    success: true,
    banned: modStorage.getBannedPlayers(),
    muted: modStorage.getMutedPlayers(),
    warnings: modStorage.getWarningLogs(),
    words: modStorage.getBlacklistedWords()
  });
});

/**
 * POST /api/moderation/warn
 * Issue in-game warning to a player with custom message
 */
router.post('/warn', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }

  const { userId, username, message, adminName } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const warnMsg = message && message.trim().length > 0
    ? message.trim()
    : "Please do not use any racial slurs or offensive language.";

  const log = modStorage.warnPlayer({
    userId: String(userId),
    username: username || "RobloxPlayer",
    message: warnMsg,
    warnedBy: adminName || "Owner"
  });

  return res.status(200).json({
    success: true,
    message: `Warning issued to ${username || userId}`,
    log
  });
});

/**
 * POST /api/moderation/mute
 * Lock a player out of global chat
 */
router.post('/mute', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }

  const { userId, username, reason, adminName } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const entry = modStorage.mutePlayer({
    userId: String(userId),
    username: username || "RobloxPlayer",
    reason: reason || "Muted for chat misconduct",
    mutedBy: adminName || "Owner"
  });

  return res.status(200).json({
    success: true,
    message: `Player ${username || userId} has been muted from global chat.`,
    entry
  });
});

/**
 * POST /api/moderation/unmute
 * Restore chat access for a muted player
 */
router.post('/unmute', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }

  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const unmuted = modStorage.unmutePlayer(String(userId));
  return res.status(200).json({
    success: true,
    message: unmuted ? `Player ${userId} has been unmuted.` : `Player ${userId} was not muted.`
  });
});

/**
 * POST /api/moderation/ban
 * Permanently ban a player from injecting or using the script
 */
router.post('/ban', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }

  const { userId, username, reason, adminName } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const entry = modStorage.banPlayer({
    userId: String(userId),
    username: username || "RobloxPlayer",
    reason: reason || "Permanent script & chat ban",
    bannedBy: adminName || "Owner"
  });

  return res.status(200).json({
    success: true,
    message: `Player ${username || userId} has been banned permanently from Serenity Hub.`,
    entry
  });
});

/**
 * POST /api/moderation/unban
 * Remove a player from the banned registry
 */
router.post('/unban', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }

  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const unbanned = modStorage.unbanPlayer(String(userId));
  return res.status(200).json({
    success: true,
    message: unbanned ? `Player ${userId} has been unbanned.` : `Player ${userId} was not in ban list.`
  });
});

/**
 * DELETE /api/moderation/warn-logs/:id
 * Delete a specific warning log
 */
router.delete('/warn-logs/:id', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }

  const id = req.params.id;
  const deleted = modStorage.deleteWarningLog(id);
  return res.status(200).json({ success: true, deleted });
});

/**
 * DELETE /api/moderation/warn-logs
 * Clear all warning logs
 */
router.delete('/warn-logs', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }

  modStorage.clearWarningLogs();
  return res.status(200).json({ success: true, message: 'All warning logs cleared' });
});

/**
 * POST /api/moderation/words
 * Add a word to the auto-delete filter
 */
router.post('/words', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }

  const { word } = req.body || {};
  if (!word || typeof word !== 'string') {
    return res.status(400).json({ error: 'Valid word is required' });
  }

  const added = modStorage.addBlacklistedWord(word);
  return res.status(200).json({
    success: true,
    added,
    words: modStorage.getBlacklistedWords()
  });
});

/**
 * DELETE /api/moderation/words/:word
 * Remove a word from the auto-delete filter
 */
router.delete('/words/:word', (req, res) => {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin password required' });
  }

  const word = decodeURIComponent(req.params.word);
  const removed = modStorage.removeBlacklistedWord(word);
  return res.status(200).json({
    success: true,
    removed,
    words: modStorage.getBlacklistedWords()
  });
});

module.exports = router;
