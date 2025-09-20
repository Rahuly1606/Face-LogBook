// Vercel serverless function for proxying requests to the backend API
// This file will be deployed as /api/proxy

const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-ADMIN-TOKEN'
    );

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = 'https://lmcvf9h0-5000.inc1.devtunnels.ms/api/v1';
    const path = req.query.path || '';
    const url = `${targetUrl}/${path}`;

    console.log(`Proxying request to: ${url}`);
    console.log(`Method: ${req.method}`);
    console.log(`Headers: ${JSON.stringify(req.headers)}`);

    if (req.body) {
        console.log(`Body: ${JSON.stringify(req.body)}`);
    }

    try {
        // Forward the request to the API
        const fetchOptions = {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        // Add authorization headers if present
        if (req.headers.authorization) {
            fetchOptions.headers.Authorization = req.headers.authorization;
        }

        if (req.headers['x-admin-token']) {
            fetchOptions.headers['X-ADMIN-TOKEN'] = req.headers['x-admin-token'];
        }

        // Include body for methods that support it
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            fetchOptions.body = JSON.stringify(req.body);
        }

        const response = await fetch(url, fetchOptions);

        // Get response data
        const contentType = response.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        // Log response
        console.log(`Response status: ${response.status}`);
        console.log(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers))}`);
        console.log(`Response data: ${typeof data === 'object' ? JSON.stringify(data) : data}`);

        // Set status code
        res.status(response.status);

        // Send response data
        if (typeof data === 'object') {
            res.json(data);
        } else {
            res.send(data);
        }
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: error.message,
            stack: error.stack
        });
    }
};