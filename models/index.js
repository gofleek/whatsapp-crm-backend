const sequelize = require('../config/database');
const User = require('./User');
const Chat = require('./Chat');
const Message = require('./Message');

// Associations
User.hasMany(Chat, { foreignKey: 'assigned_to', as: 'assignedChats' });
Chat.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignee' });

Chat.hasMany(Message, { foreignKey: 'chat_id', as: 'messages', onDelete: 'CASCADE' });
Message.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });

User.hasMany(Message, { foreignKey: 'sender_user_id', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'sender_user_id', as: 'senderUser' });

module.exports = {
  sequelize,
  User,
  Chat,
  Message
};
