// api/auth/login.js - A specific proxy for the login endpoint

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
    console.log(`Body: ${JSON.stringify(req.body)}`);

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
            },
            body: JSON.stringify(req.body),
        });

        // Get response data
        const data = await response.json();
        console.log(`Login response status: ${response.status}`);
        console.log(`Login response data: ${JSON.stringify(data)}`);

        // Set status code
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