// api/auth/login.js - A specific proxy for the login endpoint

export default async function handler(req, res) {
    const targetUrl = 'https://lmcvf9h0-5000.inc1.devtunnels.ms/api/v1/auth/login';

    console.log(`Proxying login request to: ${targetUrl}`);

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

        // Set status code
        res.status(response.status);

        // Send response data
        res.json(data);
    } catch (error) {
        console.error('Login proxy error:', error);
        res.status(500).json({
            error: 'Login proxy error',
            message: error.message
        });
    }
}