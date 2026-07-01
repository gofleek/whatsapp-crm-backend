const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

let io;

// userId -> Set of socket ids (a user can have multiple tabs/devices open)
const onlineUsers = new Map();

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN === '*' ? '*' : process.env.CORS_ORIGIN.split(','),
      methods: ['GET', 'POST']
    }
  });

  // Authenticate every socket connection with the same JWT used for REST
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id);

      if (!user || !user.is_active) return next(new Error('Invalid or inactive user'));

      socket.user = { id: user.id, name: user.name, role: user.role };
      next();
    } catch (err) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role, name } = socket.user;

    // Track online status
    if (!onlineUsers.has(id)) onlineUsers.set(id, new Set());
    onlineUsers.get(id).add(socket.id);

    // Room per-user (for targeted "you were assigned a chat" notifications)
    socket.join(`user_${id}`);

    // Admins & traffic managers see everything (new chats, all assignments)
    if (role === 'admin' || role === 'traffic_manager') {
      socket.join('traffic_room');
    }

    // Broadcast presence to traffic room + admins
    io.to('traffic_room').emit('user_status', { userId: id, name, status: 'online' });

    socket.on('join_chat', (chatId) => {
      socket.join(`chat_${chatId}`);
    });

    socket.on('leave_chat', (chatId) => {
      socket.leave(`chat_${chatId}`);
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(id);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(id);
          io.to('traffic_room').emit('user_status', { userId: id, name, status: 'offline' });
        }
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized yet');
  return io;
}

function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

module.exports = { initSocket, getIO, isUserOnline };
