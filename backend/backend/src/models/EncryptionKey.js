const mongoose = require('mongoose');

const EncryptionKeySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // Master key (encrypted with user's password)
  masterKey: { type: String, required: true },
  // Key for each resource type
  keys: {
    notes: { type: String },
    lectures: { type: String },
    syllabus: { type: String },
    messages: { type: String },
  },
  // Key version for rotation
  keyVersion: { type: Number, default: 1 },
  lastRotation: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('EncryptionKey', EncryptionKeySchema);