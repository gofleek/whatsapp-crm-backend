const { Op } = require('sequelize');
const { Chat, Message, User } = require('../models');
const { getIO, isUserOnline } = require('../socket/socketHandler');

// GET /chats
// Admin & Traffic Manager: see all chats (optionally filter by ?status=new)
// Salesman: only sees chats assigned to them
exports.getChats = async (req, res, next) => {
  try {
    const { role, id } = req.user;
    const { status } = req.query;

    const where = {};
    if (status) where.status = status;
    if (role === 'salesman') where.assigned_to = id;

    const chats = await Chat.findAll({
      where,
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] }
      ],
      order: [['last_message_at', 'DESC'], ['created_at', 'DESC']]
    });

    // Attach unread count (messages from customer not yet read) per chat
    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.count({
          where: { chat_id: chat.id, sender: 'customer', is_read: false }
        });
        const plain = chat.toJSON();
        plain.unread_count = unreadCount;
        if (plain.assignee) {
          plain.assignee.online = isUserOnline(plain.assignee.id);
        }
        return plain;
      })
    );

    res.json({ success: true, chats: chatsWithUnread });
  } catch (err) {
    next(err);
  }
};

// GET /chats/:id  - chat detail with its messages
exports.getChatById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const chat = await Chat.findByPk(id, {
      include: [
        { model: User, as: 'assignee', attributes: ['id', 'name', 'email'] },
        { model: Message, as: 'messages', order: [['timestamp', 'ASC']] }
      ]
    });

    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    // Salesmen may only view chats assigned to them
    if (role === 'salesman' && chat.assigned_to !== userId) {
      return res.status(403).json({ success: false, message: 'This chat is not assigned to you' });
    }

    // Mark customer messages as read since the agent is now viewing the chat
    await Message.update(
      { is_read: true },
      { where: { chat_id: id, sender: 'customer', is_read: false } }
    );

    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
};

// PATCH /chats/assign  { chatId, salesmanId }
// Traffic manager / admin assigns or reassigns a chat to a salesman
exports.assignChat = async (req, res, next) => {
  try {
    const { chatId, salesmanId } = req.body;

    if (!chatId || !salesmanId) {
      return res.status(400).json({ success: false, message: 'chatId and salesmanId are required' });
    }

    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    const salesman = await User.findOne({ where: { id: salesmanId, role: 'salesman' } });
    if (!salesman) {
      return res.status(404).json({ success: false, message: 'Salesman not found' });
    }
    if (!salesman.is_active) {
      return res.status(400).json({ success: false, message: 'Cannot assign to a deactivated salesman' });
    }

    chat.assigned_to = salesman.id;
    chat.status = 'assigned';
    await chat.save();

    const io = getIO();
    // Notify the salesman directly
    io.to(`user_${salesman.id}`).emit('chat_assigned', {
      chatId: chat.id,
      phone_number: chat.phone_number,
      assignedBy: req.user.name
    });
    // Notify traffic/admin views to refresh
    io.to('traffic_room').emit('chat_updated', { chatId: chat.id });

    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
};

// PATCH /chats/status  { chatId, status }
// Salesman can close their own chat. Admin/Traffic manager can set any status.
exports.updateChatStatus = async (req, res, next) => {
  try {
    const { chatId, status } = req.body;
    const { role, id: userId } = req.user;

    if (!chatId || !status) {
      return res.status(400).json({ success: false, message: 'chatId and status are required' });
    }
    if (!['new', 'assigned', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    if (role === 'salesman' && chat.assigned_to !== userId) {
      return res.status(403).json({ success: false, message: 'This chat is not assigned to you' });
    }

    chat.status = status;
    await chat.save();

    const io = getIO();
    io.to(`chat_${chat.id}`).emit('chat_status_changed', { chatId: chat.id, status });
    io.to('traffic_room').emit('chat_updated', { chatId: chat.id });
    if (chat.assigned_to) {
      io.to(`user_${chat.assigned_to}`).emit('chat_updated', { chatId: chat.id });
    }

    res.json({ success: true, chat });
  } catch (err) {
    next(err);
  }
};
