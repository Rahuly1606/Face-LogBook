/**
 * This script generates self-signed certificates for local HTTPS development
 * Run this with: node generate-certs.js
 * 
 * Prerequisites:
 * - Install mkcert (https://github.com/FiloSottile/mkcert)
 * - Run mkcert -install once to set up the local CA
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create certificates directory if it doesn't exist
const certDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
}

// Generate certificates using mkcert
try {
    console.log('Generating development certificates using mkcert...');
    execSync(`mkcert -key-file ${path.join(certDir, 'key.pem')} -cert-file ${path.join(certDir, 'cert.pem')} "localhost" "127.0.0.1" "::1" ${getLocalIPAddresses()}`);
    console.log('Certificates generated successfully!');
    console.log(`Certificates saved to ${certDir}`);
    console.log('\nYou can now run the development server with HTTPS enabled.');
    console.log('Use the vite dev server and access the app via https://localhost:8080');
    console.log('On LAN devices, use https://<your-ip>:8080');
} catch (error) {
    console.error('Failed to generate certificates:', error.message);
    console.log('\nPossible solutions:');
    console.log('1. Install mkcert: https://github.com/FiloSottile/mkcert#installation');
    console.log('2. Run mkcert -install once to set up the local CA');
    console.log('3. Make sure mkcert is in your PATH');

    // Alternative manual instructions
    console.log('\nAlternatively, you can manually create certificates:');
    console.log(`1. Create directory: ${certDir}`);
    console.log('2. Generate a self-signed certificate and place files as:');
    console.log(`   - ${path.join(certDir, 'key.pem')}`);
    console.log(`   - ${path.join(certDir, 'cert.pem')}`);
}

// Helper function to get local IP addresses for certificate
function getLocalIPAddresses() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const ipAddresses = [];

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Skip internal and non-IPv4 addresses
            if (!net.internal && net.family === 'IPv4') {
                ipAddresses.push(net.address);
            }
        }
    }

    return ipAddresses.join(' ');
}