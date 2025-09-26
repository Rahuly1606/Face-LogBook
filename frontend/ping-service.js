// Simple script to ping the backend health endpoint
// This can be deployed as a separate service or used with a monitoring tool

const BACKEND_URL = process.env.BACKEND_URL || 'https://face-logbook-backend.onrender.com';
const PING_INTERVAL = process.env.PING_INTERVAL || 5 * 60 * 1000; // 5 minutes default

async function pingBackend() {
    try {
        const startTime = Date.now();
        console.log(`[${new Date().toISOString()}] Pinging ${BACKEND_URL}/api/v1/health/ping...`);

        const response = await fetch(`${BACKEND_URL}/api/v1/health/ping`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'FaceLogbook-PingService/1.0'
            },
        });

        const responseTime = Date.now() - startTime;

        if (response.ok) {
            const data = await response.json();
            console.log(`[${new Date().toISOString()}] Backend is alive! Response time: ${responseTime}ms`);
            console.log(`Status: ${data.status}, Message: ${data.message}`);
        } else {
            console.error(`[${new Date().toISOString()}] Error: Backend returned ${response.status}`);
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Failed to ping backend:`, error.message);
    }

    // Schedule next ping
    setTimeout(pingBackend, PING_INTERVAL);
}

// Start pinging
console.log(`Starting ping service to keep backend alive. Interval: ${PING_INTERVAL / 1000} seconds`);
pingBackend();