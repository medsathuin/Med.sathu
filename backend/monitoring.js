const os = require('os');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

class ProductionMonitor {
  constructor() {
    this.alerts = [];
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  // ========== SYSTEM HEALTH ==========
  checkSystemHealth() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = (usedMem / totalMem) * 100;

    const health = {
      cpu: {
        count: cpus.length,
        load: loadAvg[0],
        usage: this.getCPUUsage(cpus),
      },
      memory: {
        total: totalMem / 1024 / 1024 / 1024,
        used: usedMem / 1024 / 1024 / 1024,
        free: freeMem / 1024 / 1024 / 1024,
        usage: memUsage,
      },
      uptime: os.uptime(),
      timestamp: new Date().toISOString(),
    };

    return health;
  }

  getCPUUsage(cpus) {
    let idle = 0;
    let total = 0;
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        total += cpu.times[type];
      }
      idle += cpu.times.idle;
    });
    return 100 - (idle / total) * 100;
  }

  // ========== CHECK ALERTS ==========
  async checkAlerts() {
    const health = this.checkSystemHealth();

    // CPU alert
    if (health.cpu.usage > 80) {
      this.alerts.push({
        type: 'CPU',
        severity: 'warning',
        message: `CPU usage is ${health.cpu.usage.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    }

    // Memory alert
    if (health.memory.usage > 85) {
      this.alerts.push({
        type: 'Memory',
        severity: 'critical',
        message: `Memory usage is ${health.memory.usage.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
      });
    }

    // Send alerts
    if (this.alerts.length > 0) {
      await this.sendAlertEmail();
    }
  }

  // ========== SEND ALERT EMAIL ==========
  async sendAlertEmail() {
    const alertHtml = this.alerts.map(a =>
      `<li><b>${a.type}</b> (${a.severity}): ${a.message}</li>`
    ).join('');

    await this.transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `🚨 ${this.alerts.length} Medsathu.inn Alerts`,
      html: `
        <h1>System Alerts</h1>
        <ul>${alertHtml}</ul>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    });

    this.alerts = [];
  }

  // ========== DATABASE HEALTH ==========
  checkDatabaseHealth() {
    if (mongoose.connection.readyState === 1) {
      return {
        status: 'connected',
        collections: Object.keys(mongoose.connection.collections).length,
      };
    }
    return { status: 'disconnected' };
  }
}

module.exports = new ProductionMonitor();