const { Server } = require('socket.io');

class ChatService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });
    this.rooms = new Map();
    this.users = new Map();
    this.setupHandlers();
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log('🟢 User connected:', socket.id);

      // ========== AUTHENTICATION ==========
      socket.on('authenticate', (userId) => {
        this.users.set(socket.id, userId);
        socket.join(`user-${userId}`);
        this.updateUserStatus(userId, 'online');
        
        // Send pending messages
        this.sendPendingMessages(userId, socket);
      });

      // ========== PRIVATE MESSAGES ==========
      socket.on('private-message', (data) => {
        const { to, message, type } = data;
        const messageId = this.generateMessageId();
        
        const messageData = {
          id: messageId,
          from: this.users.get(socket.id),
          to,
          message,
          type: type || 'text',
          timestamp: new Date().toISOString(),
          read: false,
        };
        
        // Save to database
        this.saveMessage(messageData);
        
        // Send to recipient if online
        const recipientSocket = this.findUserSocket(to);
        if (recipientSocket) {
          recipientSocket.emit('new-message', messageData);
        } else {
          // Store for later
          this.storeOfflineMessage(to, messageData);
        }
        
        // Send delivery status
        socket.emit('message-sent', {
          id: messageId,
          status: 'delivered',
          timestamp: messageData.timestamp,
        });
      });

      // ========== TYPING INDICATORS ==========
      socket.on('typing-start', (userId) => {
        const recipientSocket = this.findUserSocket(userId);
        if (recipientSocket) {
          recipientSocket.emit('user-typing', {
            from: this.users.get(socket.id),
            status: 'typing',
          });
        }
      });

      socket.on('typing-stop', (userId) => {
        const recipientSocket = this.findUserSocket(userId);
        if (recipientSocket) {
          recipientSocket.emit('user-typing', {
            from: this.users.get(socket.id),
            status: 'stopped',
          });
        }
      });

      // ========== READ RECEIPTS ==========
      socket.on('mark-read', (messageIds) => {
        messageIds.forEach(id => {
          this.markMessageRead(id);
        });
        socket.emit('messages-read', messageIds);
      });

      // ========== VIDEO CALL ==========
      socket.on('call-user', (data) => {
        const { to, callType } = data;
        const recipientSocket = this.findUserSocket(to);
        if (recipientSocket) {
          recipientSocket.emit('incoming-call', {
            from: this.users.get(socket.id),
            callType,
            callId: this.generateCallId(),
          });
        }
      });

      socket.on('call-answered', (data) => {
        const { callId, to } = data;
        const recipientSocket = this.findUserSocket(to);
        if (recipientSocket) {
          recipientSocket.emit('call-connected', { callId });
        }
      });

      socket.on('call-rejected', (data) => {
        const { callId, to } = data;
        const recipientSocket = this.findUserSocket(to);
        if (recipientSocket) {
          recipientSocket.emit('call-rejected', { callId });
        }
      });

      socket.on('call-ended', (data) => {
        const { callId, to } = data;
        const recipientSocket = this.findUserSocket(to);
        if (recipientSocket) {
          recipientSocket.emit('call-ended', { callId });
        }
      });

      // ========== GROUP CHAT ==========
      socket.on('join-group', (groupId) => {
        socket.join(`group-${groupId}`);
        this.io.to(`group-${groupId}`).emit('user-joined', {
          userId: this.users.get(socket.id),
          groupId,
        });
      });

      socket.on('leave-group', (groupId) => {
        socket.leave(`group-${groupId}`);
        this.io.to(`group-${groupId}`).emit('user-left', {
          userId: this.users.get(socket.id),
          groupId,
        });
      });

      socket.on('group-message', (data) => {
        const { groupId, message, type } = data;
        const messageData = {
          id: this.generateMessageId(),
          from: this.users.get(socket.id),
          groupId,
          message,
          type: type || 'text',
          timestamp: new Date().toISOString(),
        };
        
        this.saveGroupMessage(messageData);
        this.io.to(`group-${groupId}`).emit('new-group-message', messageData);
      });

      // ========== DISCONNECT ==========
      socket.on('disconnect', () => {
        const userId = this.users.get(socket.id);
        if (userId) {
          this.updateUserStatus(userId, 'offline');
          this.users.delete(socket.id);
        }
        console.log('🔴 User disconnected:', socket.id);
      });
    });
  }

  // ========== HELPER METHODS ==========
  findUserSocket(userId) {
    for (const [socketId, id] of this.users) {
      if (id === userId) {
        return this.io.sockets.sockets.get(socketId);
      }
    }
    return null;
  }

  updateUserStatus(userId, status) {
    this.io.emit('user-status', { userId, status });
  }

  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCallId() {
    return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ========== DATABASE METHODS ==========
  async saveMessage(messageData) {
    // Save to MongoDB
    const Message = require('../models/Message');
    await Message.create(messageData);
  }

  async saveGroupMessage(messageData) {
    const GroupMessage = require('../models/GroupMessage');
    await GroupMessage.create(messageData);
  }

  async markMessageRead(messageId) {
    const Message = require('../models/Message');
    await Message.findByIdAndUpdate(messageId, { read: true });
  }

  async sendPendingMessages(userId, socket) {
    const Message = require('../models/Message');
    const pending = await Message.find({
      to: userId,
      read: false,
    });
    pending.forEach(msg => {
      socket.emit('new-message', msg);
    });
  }

  async storeOfflineMessage(to, messageData) {
    // Store in Redis for quick retrieval
    const redis = require('../config/redis');
    await redis.lpush(`offline:${to}`, JSON.stringify(messageData));
    await redis.expire(`offline:${to}`, 86400); // 24 hours
  }
}

module.exports = ChatService;