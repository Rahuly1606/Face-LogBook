#!/usr/bin/env node

/**
 * This script helps you set up uptime monitoring for your backend
 * to prevent it from sleeping on Render's free tier.
 * 
 * It provides instructions for UptimeRobot, a free monitoring service.
 * Alternatively, you can use the ping-service.js script directly.
 */

const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const BACKEND_URL = process.env.BACKEND_URL || 'https://face-logbook-backend.onrender.com';
const PING_ENDPOINT = `${BACKEND_URL}/api/v1/health/ping`;

console.log(`
=====================================================
Face-Logbook Backend Uptime Setup Guide
=====================================================

To keep your backend awake on Render's free tier, you need to
set up a service that regularly pings your backend.

There are two options:

1. Use UptimeRobot (free, recommended)
2. Use the included ping-service.js script

Testing your backend ping endpoint now...
`);

// Test if the ping endpoint is available
https.get(`${PING_ENDPOINT}`, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ Ping endpoint is working! Response:');
            console.log(data);
            showUptimeRobotInstructions();
        } else {
            console.log(`❌ Ping endpoint returned status code ${res.statusCode}`);
            console.log('Response:', data);
            console.log('\nPlease ensure your backend is running and the ping endpoint is accessible.');
            askForContinue();
        }
    });
}).on('error', (err) => {
    console.error('❌ Failed to connect to ping endpoint:');
    console.error(err.message);
    console.log('\nPlease ensure your backend is running and the ping endpoint is accessible.');
    askForContinue();
});

function showUptimeRobotInstructions() {
    console.log(`
=====================================================
Option 1: UptimeRobot Setup Instructions
=====================================================

1. Go to https://uptimerobot.com/ and create a free account

2. Click "Add New Monitor"

3. Set the following values:
   - Monitor Type: HTTP(s)
   - Friendly Name: Face-Logbook Backend
   - URL (or IP): ${PING_ENDPOINT}
   - Monitoring Interval: 5 minutes (recommended)

4. Click "Create Monitor"

Your backend will now be pinged every 5 minutes to keep it awake!

=====================================================
Option 2: Use the ping-service.js script
=====================================================

If you prefer to run your own ping service:

1. Make sure you have Node.js installed

2. Run the ping service script:
   $ node ping-service.js

   Or with PM2 for background operation:
   $ npm install -g pm2
   $ pm2 start ping-service.js

This script will ping your backend every 5 minutes by default.
`);

    rl.close();
}

function askForContinue() {
    rl.question('\nDo you want to see the setup instructions anyway? (y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
            showUptimeRobotInstructions();
        } else {
            console.log('\nExiting. Please fix the backend connectivity issues and try again.');
            rl.close();
        }
    });
}