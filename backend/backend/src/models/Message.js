const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'file', 'audio'], default: 'text' },
  read: { type: Boolean, default: false },
  delivered: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: String,
  }],
  deleted: { type: Boolean, default: false },
  edited: { type: Boolean, default: false },
  metadata: { type: mongoose.Schema.Types.Mixed },
});

module.exports = mongoose.model('Message', MessageSchema);