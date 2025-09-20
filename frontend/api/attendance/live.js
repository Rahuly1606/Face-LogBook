// api/attendance/live.js - A serverless function to handle live attendance requests

import parseMultipartForm from '../parseMultipartForm';

export const config = {
    api: {
        bodyParser: false, // Disable the built-in bodyParser for file uploads
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

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const targetUrl = 'https://lmcvf9h0-5000.inc1.devtunnels.ms/api/v1/attendance/live';
    console.log(`Proxying live attendance request to: ${targetUrl}`);

    try {
        // Parse the multipart form data
        console.log('Parsing multipart form data for live attendance');
        const formData = await parseMultipartForm(req);

        if (!formData.files || !formData.files.image) {
            return res.status(400).json({
                error: 'No image file provided',
                message: 'Image file is required for live attendance'
            });
        }

        // Create form data for fetch
        const form = new FormData();

        // Add the file
        const file = formData.files.image;
        const blob = new Blob([file.data], { type: file.mimetype });
        form.append('image', blob, file.name);

        // Add any other form fields
        Object.entries(formData.fields || {}).forEach(([key, value]) => {
            form.append(key, value);
        });

        console.log(`Forwarding file: ${file.name}, size: ${file.size}, type: ${file.mimetype}`);

        // Forward the request to the API
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': req.headers.authorization,
                'X-ADMIN-TOKEN': req.headers['x-admin-token'],
            },
            body: form,
        });

        // Get response data
        const responseContentType = response.headers.get('content-type');
        let data;

        if (responseContentType && responseContentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        // Log response
        console.log(`Live attendance response status: ${response.status}`);

        // Set status code
        res.status(response.status);

        // Set response headers
        response.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });

        // Send response data
        if (typeof data === 'object') {
            res.json(data);
        } else {
            res.send(data);
        }
    } catch (error) {
        console.error('Live attendance proxy error:', error);
        res.status(500).json({
            error: 'Live attendance proxy error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}