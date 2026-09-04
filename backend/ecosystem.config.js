module.exports = {
  apps: [
    // ========== BACKEND ==========
    {
      name: 'medsathu-backend',
      script: 'backend/src/server.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: '/var/log/medsathu/backend-error.log',
      out_file: '/var/log/medsathu/backend-out.log',
      log_file: '/var/log/medsathu/combined.log',
      time: true,
      kill_timeout: 5000,
    },

    // ========== WEBSITE ==========
    {
      name: 'medsathu-website',
      script: 'website/node_modules/.bin/next',
      args: 'start',
      instances: 1,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/medsathu/website-error.log',
      out_file: '/var/log/medsathu/website-out.log',
      time: true,
    },
  ],

  // ========== DEPLOYMENT ==========
  deploy: {
    production: {
      user: 'ubuntu',
      host: ['ec2-instance-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/YOUR_USERNAME/medsathu-inn.git',
      path: '/var/www/medsathu',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
    },
  },
};