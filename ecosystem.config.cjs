module.exports = {
  apps: [
    {
      name: 'vpn-api',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
      // Add timestamps to PM2 log output (in addition to Pino's built-in timestamps)
      time: true,
    },
  ],
};
