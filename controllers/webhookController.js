const { Chat, Message, User } = require('../models');
const { getIO } = require('../socket/socketHandler');
const { getNextSalesman } = require('../utils/autoAssign');

// GET /webhook/whatsapp
// Meta calls this once when you save the webhook URL in the App Dashboard,
// to prove you control the endpoint. It sends hub.mode, hub.verify_token,
// and hub.challenge as query params - if the token matches what you
// configured, echo back hub.challenge as plain text.
exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log('[Webhook] Verified successfully by Meta');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] Verification failed - token mismatch or wrong mode');
  res.sendStatus(403);
};

// Shared logic: create/find the chat, store the message, auto-assign, and
// broadcast over Socket.io. Used by both the real Meta payload path and the
// simplified test-simulator path below.
async function processIncomingMessage({ phone_number, message, customer_name }) {
  let chat = await Chat.findOne({ where: { phone_number } });
  let isNewChat = false;

  if (!chat) {
    chat = await Chat.create({
      phone_number,
      customer_name: customer_name || null,
      status: 'new'
    });
    isNewChat = true;
  } else {
    if (customer_name && !chat.customer_name) chat.customer_name = customer_name;
    if (chat.status === 'closed') {
      // Reopen a previously closed conversation when the customer messages again
      chat.status = chat.assigned_to ? 'assigned' : 'new';
    }
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

  return { chat: fullChat, message: newMessage };
}

// Extracts { phone_number, message, customer_name } entries out of Meta's
// real webhook payload shape. A single webhook call can contain multiple
// entries/changes, and each "value" can contain multiple messages, so this
// returns an array. Non-text messages (image/audio/location/etc.) and
// status updates (delivered/read receipts) are captured with a readable
// placeholder or skipped, respectively.
function extractMetaMessages(body) {
  const results = [];
  const entries = body.entry || [];

  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      const value = change.value || {};
      const messages = value.messages;
      if (!messages || messages.length === 0) continue; // e.g. a "statuses" update, not a real message - skip

      const contact = (value.contacts && value.contacts[0]) || {};
      const customer_name = contact.profile && contact.profile.name;

      for (const m of messages) {
        let text;
        if (m.type === 'text') text = m.text.body;
        else if (m.type === 'button') text = m.button.text;
        else if (m.type === 'interactive') text = m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || `[${m.type}]`;
        else text = `[Unsupported message type: ${m.type}]`;

        results.push({
          phone_number: m.from,
          message: text,
          customer_name
        });
      }
    }
  }

  return results;
}

// POST /webhook/whatsapp
// Handles TWO payload shapes:
//   1. Meta's real WhatsApp Cloud API webhook format (has a top-level
//      `entry` array) - this is what Meta actually sends once configured.
//   2. A simplified test payload { phone_number, message, customer_name }
//      - used by the admin dashboard's "Simulate Webhook" button, so you
//      can exercise the whole pipeline without a real WhatsApp number.
exports.receiveMessage = async (req, res, next) => {
  try {
    const body = req.body;

    // Meta's real payload
    if (body && Array.isArray(body.entry)) {
      const incoming = extractMetaMessages(body);

      // Meta expects a fast 200 OK regardless of content, or it will retry
      // and eventually disable the webhook. Process messages, but always ack.
      for (const item of incoming) {
        try {
          await processIncomingMessage(item);
        } catch (innerErr) {
          console.error('[Webhook] Failed to process one message:', innerErr);
        }
      }

      return res.sendStatus(200);
    }

    // Simplified test/simulator payload
    const { phone_number, message, customer_name } = body || {};
    if (!phone_number || !message) {
      return res.status(400).json({ success: false, message: 'phone_number and message are required' });
    }

    const result = await processIncomingMessage({ phone_number, message, customer_name });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
