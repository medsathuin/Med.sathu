// After other route imports
const securityRoutes = require('./routes/security.routes');
app.use('/api/security', securityRoutes);
// After other route imports
const adminAnalyticsRoutes = require('./routes/adminAnalytics.routes');
const MonitoringService = require('./services/monitoring.service');

// Mount admin analytics routes
app.use('/api/admin', adminAnalyticsRoutes);

// Start monitoring service (after server is running)
const server = require('http').createServer(app);
const io = new Server(server);

// Set Socket.IO for monitoring
MonitoringService.setSocketIO(io);
MonitoringService.startMonitoring(60000); // Collect metrics every minute

// Export for other services
module.exports = { app, server, io };