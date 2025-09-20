// api/test.js - A simple test endpoint

export default function handler(req, res) {
    res.status(200).json({
        message: 'API proxy is working correctly!',
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        headers: req.headers,
    });
}