const { Chat, Message } = require('../models');
const { getIO } = require('../socket/socketHandler');

// GET /messages/:chat_id
exports.getMessages = async (req, res, next) => {
  try {
    const { chat_id } = req.params;
    const { role, id: userId } = req.user;

    const chat = await Chat.findByPk(chat_id);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }
    if (role === 'salesman' && chat.assigned_to !== userId) {
      return res.status(403).json({ success: false, message: 'This chat is not assigned to you' });
    }

    const messages = await Message.findAll({
      where: { chat_id },
      order: [['timestamp', 'ASC']]
    });

    res.json({ success: true, messages });
  } catch (err) {
    next(err);
  }
};

// POST /messages/send  { chatId, message }
// Sends a reply from the logged-in salesman/admin/traffic manager to the customer.
// In a real integration this would call the WhatsApp Business API here;
// for this project we simulate that call and just persist + broadcast.
exports.sendMessage = async (req, res, next) => {
  try {
    const { chatId, message } = req.body;
    const { role, id: userId, name } = req.user;

    if (!chatId || !message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'chatId and message are required' });
    }

    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    if (role === 'salesman' && chat.assigned_to !== userId) {
      return res.status(403).json({ success: false, message: 'This chat is not assigned to you' });
    }

    if (chat.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Cannot reply to a closed chat. Reopen it first.' });
    }

    // ---- Simulated WhatsApp Business API call ----
    // await whatsappApiClient.sendMessage(chat.phone_number, message);
    console.log(`[WhatsApp SIMULATED SEND] -> ${chat.phone_number}: ${message}`);
    // ------------------------------------------------

    const newMessage = await Message.create({
      chat_id: chat.id,
      sender: 'salesman',
      sender_user_id: userId,
      message: message.trim(),
      is_read: true,
      timestamp: new Date()
    });

    chat.last_message_at = new Date();
    if (chat.status === 'new') chat.status = 'assigned';
    await chat.save();

    const io = getIO();
    const payload = { chatId: chat.id, message: newMessage, senderName: name };
    io.to(`chat_${chat.id}`).emit('new_message', payload);
    io.to('traffic_room').emit('chat_updated', { chatId: chat.id });

    res.status(201).json({ success: true, message: newMessage });
  } catch (err) {
    next(err);
  }
};
