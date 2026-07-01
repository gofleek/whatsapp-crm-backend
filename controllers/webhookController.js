const { Chat, Message, User } = require('../models');
const { getIO } = require('../socket/socketHandler');
const { getNextSalesman } = require('../utils/autoAssign');

// POST /webhook/whatsapp
// Simulates an incoming WhatsApp message from a customer.
// Body: { phone_number, message, customer_name? }
//
// In a real deployment, the WhatsApp Business API (e.g. via Meta's Cloud API
// or Twilio) would POST here with its own payload shape - you would just
// adapt the destructuring below to match their webhook format.
exports.receiveMessage = async (req, res, next) => {
  try {
    const { phone_number, message, customer_name } = req.body;

    if (!phone_number || !message) {
      return res.status(400).json({ success: false, message: 'phone_number and message are required' });
    }

    let chat = await Chat.findOne({ where: { phone_number } });
    let isNewChat = false;

    if (!chat) {
      chat = await Chat.create({
        phone_number,
        customer_name: customer_name || null,
        status: 'new'
      });
      isNewChat = true;
    } else if (chat.status === 'closed') {
      // Reopen a previously closed conversation when the customer messages again
      chat.status = chat.assigned_to ? 'assigned' : 'new';
    }

    const newMessage = await Message.create({
      chat_id: chat.id,
      sender: 'customer',
      message,
      is_read: false,
      timestamp: new Date()
    });

    chat.last_message_at = new Date();

    // Auto-assign round-robin to an active salesman if enabled and chat is unassigned
    if (process.env.AUTO_ASSIGN === 'true' && !chat.assigned_to) {
      const salesman = await getNextSalesman();
      if (salesman) {
        chat.assigned_to = salesman.id;
        chat.status = 'assigned';
      }
    }

    await chat.save();

    const io = getIO();
    const fullChat = await Chat.findByPk(chat.id, {
      include: [{ model: User, as: 'assignee', attributes: ['id', 'name', 'email'] }]
    });

    io.to(`chat_${chat.id}`).emit('new_message', { chatId: chat.id, message: newMessage });

    if (isNewChat) {
      io.to('traffic_room').emit('new_chat', { chat: fullChat });
    } else {
      io.to('traffic_room').emit('chat_updated', { chatId: chat.id });
    }

    if (chat.assigned_to) {
      io.to(`user_${chat.assigned_to}`).emit('new_message', { chatId: chat.id, message: newMessage });
      io.to(`user_${chat.assigned_to}`).emit('chat_updated', { chatId: chat.id });
    }

    res.status(201).json({ success: true, chat: fullChat, message: newMessage });
  } catch (err) {
    next(err);
  }
};
