// This file checks if the server is running
// and determines which API endpoint to use

// Get the current host
const currentHost = window.location.host;

// Function to check if a URL is reachable
async function isUrlReachable(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
            method: 'OPTIONS',
            signal: controller.signal,
            mode: 'no-cors', // This prevents CORS errors during the check
        });

        clearTimeout(timeoutId);
        return true;
    } catch (error) {
        console.error(`Error checking ${url}:`, error);
        return false;
    }
}

// Determine the best API endpoint to use
export async function determineApiEndpoint() {
    console.log('Determining API endpoint...');

    // If we're on localhost, try direct connection first
    if (currentHost.includes('localhost') || currentHost.includes('127.0.0.1')) {
        console.log('Running on localhost, checking local backend...');
        if (await isUrlReachable('http://localhost:5000/api/v1')) {
            console.log('Using direct local backend connection');
            return 'http://localhost:5000/api/v1';
        }
    }

    // For Vercel deployment
    if (currentHost.includes('vercel.app')) {
        console.log('Running on Vercel, using proxy endpoint');
        return '/api';
    }

    // Default to local proxy for any other situation
    console.log('Using local API proxy');
    return '/api';
}

// Export a function to get the API root with timeout
export async function getApiRoot() {
    try {
        const apiRoot = await Promise.race([
            determineApiEndpoint(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Endpoint detection timed out')), 3000)
            )
        ]);
        return apiRoot;
    } catch (error) {
        console.warn('API endpoint detection failed:', error);
        return '/api'; // Default to proxy
    }
}