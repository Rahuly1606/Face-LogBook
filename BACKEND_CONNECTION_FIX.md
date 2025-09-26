# Backend Connection Issue Solution

This document addresses the issue where login fails after a few hours and only works again after redeploying the frontend on Vercel.

## Root Cause

The primary issues were:

1. **Render Free Tier Sleeping**: Render's free tier puts services to sleep after periods of inactivity, causing long cold starts (30-60 seconds).

2. **Misconfigured API URL**: The production environment was pointing to `https://api.face-logbook.com` instead of the actual Render URL `https://face-logbook-backend.onrender.com`.

3. **Missing CORS Configuration**: The allowed origins didn't include the Vercel domain, potentially causing CORS issues.

4. **No Retry Logic**: The frontend had no retry mechanism when the backend was waking up.

5. **Long Timeout**: The 60-second timeout provided a poor user experience when the backend was waking up.

## Solutions Implemented

### 1. Backend Ping Service

Created a lightweight ping service (`ping-service.js`) that regularly pings the backend to keep it alive. This can be deployed as a separate service or run via a scheduled job.

To run the ping service:

```bash
# Install dependencies if needed
npm install node-fetch

# Run the ping service
node ping-service.js
```

Alternatively, you can use a service like UptimeRobot to ping the backend every 5 minutes.

### 2. Lightweight Health Endpoint

Added a new lightweight health endpoint `/api/v1/health/ping` that responds quickly without database or face service checks. This endpoint is ideal for monitoring services to ping.

### 3. Fixed API Configuration

Updated the production environment variable to point to the correct backend URL:

```bash
# .env.production
VITE_API_BASE=https://face-logbook-backend.onrender.com
```

### 4. Improved Error Handling and Retry Logic

- Reduced the request timeout from 60 seconds to 20 seconds
- Added automatic retry logic for network errors
- Implemented specific handling for backend wakeup scenarios
- Added user feedback during backend wakeup

### 5. Enhanced CORS Configuration

Added Vercel domains to the allowed origins list:

```python
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:8080,...,https://face-logbook.vercel.app,https://face-logbook-frontend.vercel.app')
```

## Additional Recommendations

1. **Upgrade to Render Paid Tier**: Consider upgrading to a paid Render tier to avoid the service sleeping.

2. **Use a Custom Domain**: Set up a custom domain for both frontend and backend to ensure consistent URLs across deployments.

3. **Session Storage**: Consider using localStorage with refresh tokens for more resilient authentication.

4. **Offline Support**: Implement basic offline functionality with service workers to handle connection issues.

5. **Monitoring**: Set up monitoring for the backend service to track uptime and performance.

## Testing the Solution

To verify the solution:

1. Deploy the updated frontend and backend code
2. Set up the ping service or UptimeRobot
3. Test login functionality after waiting several hours
4. Monitor console for any network errors or retry messages

If issues persist, check the Render logs for any startup errors and verify CORS headers in the network tab.