// api/proxy.js - A serverless function to proxy requests to your backend API

export default async function handler(req, res) {
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

    // Extract headers we want to forward
    const headers = {};
    const headersToForward = [
        'content-type',
        'authorization',
        'x-admin-token',
    ];

    for (const header of headersToForward) {
        if (req.headers[header]) {
            headers[header] = req.headers[header];
        }
    }

    try {
        // Forward the request to the API
        const fetchOptions = {
            method: req.method,
            headers: headers,
        };

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

        // Set response headers
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });

        // Send response data
        res.send(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({
            error: 'Proxy error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}