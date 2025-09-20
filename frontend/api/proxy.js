// api/proxy.js - A serverless function to proxy requests to your backend API

export default async function handler(req, res) {
    const targetUrl = 'https://lmcvf9h0-5000.inc1.devtunnels.ms/api/v1';
    const path = req.query.path || '';
    const url = `${targetUrl}/${path}`;

    console.log(`Proxying request to: ${url}`);

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