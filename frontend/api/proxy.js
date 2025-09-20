// api/proxy.js - A serverless function to proxy requests to your backend API
import parseMultipartForm from './parseMultipartForm';

export const config = {
    api: {
        bodyParser: false, // Disable the built-in bodyParser for file uploads
    },
};

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

    try {
        // Prepare fetch options
        const fetchOptions = {
            method: req.method,
            headers: {
                'Authorization': req.headers.authorization,
                'X-ADMIN-TOKEN': req.headers['x-admin-token'],
            },
        };

        // Check if this is a multipart/form-data request (file upload)
        const requestContentType = req.headers['content-type'] || '';
        const isMultipart = requestContentType.includes('multipart/form-data');

        if (isMultipart) {
            console.log('Processing multipart form data');

            try {
                // Parse the multipart form data
                const formData = await parseMultipartForm(req);

                if (!formData.files || !formData.files.image) {
                    return res.status(400).json({
                        error: 'No image file provided',
                        message: 'Image file is required for this request'
                    });
                }

                // Create form data for fetch
                const form = new FormData();

                // Add the file
                const file = formData.files.image;
                const blob = new Blob([file.data], { type: file.mimetype });
                form.append('image', blob, file.name);

                // Add any other form fields
                Object.entries(formData.fields).forEach(([key, value]) => {
                    form.append(key, value);
                });

                // Set the form as the body
                fetchOptions.body = form;

                console.log(`Forwarding file: ${file.name}, size: ${file.size}, type: ${file.mimetype}`);
            } catch (formError) {
                console.error('Error parsing form data:', formError);
                return res.status(400).json({
                    error: 'Invalid form data',
                    message: formError.message
                });
            }
        } else if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            // For JSON requests
            fetchOptions.headers['Content-Type'] = 'application/json';

            // Parse body if not already parsed
            let body = req.body;
            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                } catch (e) {
                    // Not JSON, use as is
                    console.error('Error parsing JSON body:', e);
                }
            } else if (!body) {
                // Default to empty object if body is undefined or null
                body = {};
            }

            fetchOptions.body = JSON.stringify(body);
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
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}