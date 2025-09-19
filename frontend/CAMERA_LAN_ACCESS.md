# Camera Access over LAN

This document provides instructions for accessing the Face Logbook application from other devices on your local network.

## Why HTTPS is Required

Modern browsers restrict access to device cameras and microphones (via `getUserMedia()`) to secure contexts:
- HTTPS-enabled sites
- `localhost` (for local development)

When accessing your application from another device using an IP address (like `http://192.168.1.100:8080`), the browser considers this an insecure context and will block camera access.

## Setup Instructions

### Option 1: Set up HTTPS for Development (Recommended)

1. Install [mkcert](https://github.com/FiloSottile/mkcert#installation)

   - **Windows (using Chocolatey)**: `choco install mkcert`
   - **macOS (using Homebrew)**: `brew install mkcert`
   - **Linux**: See [mkcert installation instructions](https://github.com/FiloSottile/mkcert#installation)

2. Set up the local Certificate Authority:

   ```bash
   mkcert -install
   ```

3. Generate certificates for your development server:

   ```bash
   npm run generate-certs
   ```

   This will create a `certs` folder with the required certificates.

4. Start the development server:

   ```bash
   npm run dev:host
   ```

5. Access your application using HTTPS:
   - On your machine: `https://localhost:8080`
   - From other devices: `https://YOUR_IP_ADDRESS:8080`

### Option 2: Use a Tunnel Service (Temporary Testing)

For quick testing without certificate setup, you can use a tunnel service:

1. Install ngrok:
   - Download from: https://ngrok.com/download
   - Sign up for a free account if needed

2. Start your development server:
   ```bash
   npm run dev
   ```

3. In a separate terminal, start ngrok:
   ```bash
   ngrok http 8080
   ```

4. Use the HTTPS URL provided by ngrok (e.g., `https://abc123.ngrok.io`)

### Option 3: For Chrome Users Only (Not Recommended)

Chrome allows you to bypass security restrictions for testing:

1. Launch Chrome with special flags:
   ```
   chrome.exe --unsafely-treat-insecure-origin-as-secure="http://YOUR_IP_ADDRESS:8080"
   ```

2. You'll need to close all Chrome instances before this works.

## Troubleshooting

1. **Certificate Trust Issues**: If you see certificate warnings, make sure you've run `mkcert -install` on your device.

2. **"Camera not found" or "Not allowed" errors**:
   - Check browser permissions (look for the camera icon in the address bar)
   - Make sure the camera isn't being used by another application
   - Try a different browser

3. **Cannot access server from other devices**:
   - Ensure your firewall allows connections to port 8080
   - Verify you're using the correct IP address
   - Make sure devices are on the same network

4. **"getUserMedia is not implemented" error**:
   - You're likely accessing via HTTP instead of HTTPS
   - Switch to HTTPS or use one of the methods above

## Production Deployment

For production, always use proper HTTPS with a valid SSL certificate. Options include:
- Let's Encrypt for free certificates
- SSL certificates from your hosting provider
- Setting up a reverse proxy with SSL termination (e.g., Nginx, Cloudflare)