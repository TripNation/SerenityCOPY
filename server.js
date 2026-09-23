require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const announcementsRouter = require('./routes/announcements');
const authRouter = require('./routes/auth');
const { router: statsRouter } = require('./routes/stats');
const chatRouter = require('./routes/chat');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger for development
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`[${req.method}] ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/announcements', announcementsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/chat', chatRouter);
app.use('/api', authRouter);

// Fallback for undefined API endpoints
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// SPA / Dashboard fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err.stack || err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log('🚀 SERENITY HUB - LIVE ANNOUNCEMENT ADMIN SERVER');
  console.log('====================================================');
  console.log(`🌐 Admin Dashboard:  http://localhost:${PORT}`);
  console.log(`📡 Announcement API: ${BASE_URL.replace(/\/$/, '')}/api/announcements/latest`);
  console.log(`⚙️  Admin Password:   ${process.env.ADMIN_PASSWORD ? 'configured (.env)' : 'default (infinityadmin123)'}`);
  console.log(`📦 Mode:             ${BASE_URL.includes('localhost') ? 'Local Development' : 'Public Production'}`);
  console.log('====================================================');
});

