# API Environment Configuration Guide

The Face-LogBook application now uses environment variables to configure the API backend URL, providing flexibility across different environments.

## Environment Variables

The frontend uses the following environment variable:

- `VITE_API_BASE`: Contains the full backend base URL (e.g., `http://localhost:5000`)

## Configuration Files

Three environment configuration files are provided:

1. `.env`: Default environment variables used when no specific environment is specified
2. `.env.development`: Variables used in development mode
3. `.env.production`: Variables used in production build

## Running the Development Server

To run the development server with the environment variables:

1. Ensure the `.env` or `.env.development` file is present in the frontend root directory
2. Start the development server:

```bash
# From the frontend directory
npm run dev
```

## Building for Production

When building for production:

```bash
# From the frontend directory
npm run build
```

This will use variables from `.env.production` for the build.

## Customizing the Backend URL

To change the backend URL:

1. Edit the appropriate `.env` file:
   - For local development: Edit `.env.development`
   - For production: Edit `.env.production`

2. Set the `VITE_API_BASE` variable to your backend URL, for example:
   ```
   VITE_API_BASE=http://api.face-logbook.com
   ```

3. Restart the development server or rebuild the application

## Verifying Configuration

To verify that the application is using the correct backend URL:

1. Open your browser's developer tools (F12)
2. Go to the Network tab
3. Interact with the application to trigger API calls
4. Check that the requests are going to the expected URL

All API requests should use the URL specified in the `VITE_API_BASE` environment variable.