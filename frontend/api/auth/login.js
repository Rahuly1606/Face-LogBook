// api/auth/login.js - A specific proxy for the login endpoint
// Updated with better error handling and response processing

export const config = {
    api: {
        bodyParser: true, // Enable built-in body parser for JSON requests
    },
};

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-ADMIN-TOKEN'
    );

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = 'https://lmcvf9h0-5000.inc1.devtunnels.ms/api/v1/auth/login';

    console.log(`Proxying login request to: ${targetUrl}`);
    console.log(`Method: ${req.method}`);
    console.log(`Body: ${JSON.stringify(req.body || {})}`);

    // Only allow POST requests for login
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Forward the request to the API
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(req.body || {}),
        });

        // Check if response is ok
        if (!response.ok) {
            console.error(`Login request failed with status ${response.status}`);

            // Try to get error message
            let errorData = {};
            try {
                errorData = await response.json();
            } catch (e) {
                console.error('Could not parse error response:', e);
                errorData = { message: 'Unknown error occurred' };
            }

            return res.status(response.status).json(errorData);
        }

        // Get response data
        let data;
        try {
            data = await response.json();
            console.log(`Login response status: ${response.status}`);
            console.log(`Login response data: ${JSON.stringify(data)}`);
        } catch (e) {
            console.error('Failed to parse JSON response:', e);
            return res.status(500).json({
                error: 'Invalid JSON response',
                details: e.message
            });
        }
        res.status(response.status);

        // Send response data
        res.json(data);
    } catch (error) {
        console.error('Login proxy error:', error);
        res.status(500).json({
            error: 'Login proxy error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}