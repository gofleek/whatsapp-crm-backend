require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');

const sequelize = require('./config/database');
require('./models'); // registers associations

const { initSocket } = require('./socket/socketHandler');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const messageRoutes = require('./routes/messageRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const server = http.createServer(app);

// ---- Middleware ----
app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' ? '*' : (process.env.CORS_ORIGIN || '*').split(',')
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- API routes ----
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/chats', chatRoutes);
app.use('/messages', messageRoutes);
app.use('/webhook', webhookRoutes);

app.get('/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

// NOTE: this backend is now API-only. The frontend is deployed separately
// on Vercel (see /frontend), so there's no static file serving or catch-all
// route here anymore - just the JSON API + Socket.io below.

// ---- Error handler (must be last) ----
app.use(errorHandler);

// ---- Socket.io ----
initSocket(server);

// ---- Start ----
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // sync() creates tables if they don't exist yet. For a real production
    // workflow you'd swap this for Sequelize migrations.
    await sequelize.sync();
    console.log('✅ Models synced');

    server.listen(PORT, () => {
      console.log(`🚀 WhatsApp CRM server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Unable to start server:', err);
    process.exit(1);
  }
}

start();
