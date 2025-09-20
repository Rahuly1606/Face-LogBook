// api/auth/[...path].js - A specific proxy for auth endpoints

export default async function handler(req, res) {
    const targetUrl = 'https://lmcvf9h0-5000.inc1.devtunnels.ms/api/v1/auth';
    const path = req.query.path ? req.query.path.join('/') : '';
    const url = `${targetUrl}/${path}`;

    console.log(`Proxying auth request to: ${url}`);

    // Extract headers we want to forward
    const headers = {
        'Content-Type': 'application/json',
    };

    const headersToForward = [
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

        // Send response data
        res.json(data);
    } catch (error) {
        console.error('Auth proxy error:', error);
        res.status(500).json({
            error: 'Auth proxy error',
            message: error.message
        });
    }
}