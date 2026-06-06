require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

const app = express();

const limiter = rateLimit({ windowMs: 15*60*1000, max: 500, message: { success: false, message: 'Too many requests.' } });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: { success: false, message: 'Too many auth attempts.' } });

const corsWhitelist = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsWhitelist.includes('*') || corsWhitelist.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

app.use(express.static(path.join(__dirname, '../public')));

async function startServer() {
  try {
    const dbReady = require('./database/migrate');
    await dbReady;
  } catch (err) {
    console.error('Database initialization failed, server may have limited functionality:', err.message);
  }
  
  try {
    const seed = require('./database/seed');
    await seed();
  } catch (err) {
    console.error('Seed failed (non-fatal):', err.message);
  }

  app.use('/api/auth', authLimiter, require('./routes/auth'));
  app.use('/api/projects', require('./routes/projects'));
  app.use('/api/tasks', require('./routes/tasks'));
  app.use('/api/dashboard', require('./routes/dashboard'));

  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'TaskFlow API running!', version: '1.0.0', timestamp: new Date().toISOString() });
  });

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
      res.status(404).json({ success: false, message: 'Route not found.' });
    }
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 TaskFlow running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔌 API: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
