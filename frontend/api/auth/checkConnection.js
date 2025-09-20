// api/auth/checkConnection.js - A simple endpoint to verify the connection to the backend

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-ADMIN-TOKEN'
    );

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const backendUrl = 'https://lmcvf9h0-5000.inc1.devtunnels.ms/api/v1/health';

    try {
        console.log(`Checking connection to backend at: ${backendUrl}`);

        // Try to connect to the backend
        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            timeout: 5000 // 5 second timeout
        });

        // Return the results
        if (response.ok) {
            let data;
            try {
                data = await response.json();
            } catch (e) {
                data = { message: 'Backend is reachable but returned non-JSON response' };
            }

            return res.status(200).json({
                success: true,
                backendStatus: response.status,
                backendResponse: data,
                message: 'Backend connection successful'
            });
        } else {
            return res.status(200).json({
                success: false,
                backendStatus: response.status,
                message: 'Backend is reachable but returned an error'
            });
        }
    } catch (error) {
        console.error('Connection check error:', error);
        return res.status(200).json({
            success: false,
            error: 'Connection check failed',
            message: error.message || 'Could not connect to backend',
            details: error.toString()
        });
    }
}