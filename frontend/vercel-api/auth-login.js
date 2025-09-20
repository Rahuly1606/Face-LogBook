// Vercel serverless function for handling auth login
// This file will be deployed as /api/auth-login

const fetch = require('node-fetch');

module.exports = async (req, res) => {
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

    // Only allow POST requests for login
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const targetUrl = 'https://lmcvf9h0-5000.inc1.devtunnels.ms/api/v1/auth/login';

    console.log(`Proxying login request to: ${targetUrl}`);

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
};