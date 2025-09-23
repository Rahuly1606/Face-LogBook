import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// Check if certificate files exist
const certPath = path.resolve(__dirname, './certs');
const hasCertificates = fs.existsSync(path.join(certPath, 'cert.pem')) &&
  fs.existsSync(path.join(certPath, 'key.pem'));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Enable HTTPS if certificates are available
    ...(hasCertificates && {
      https: {
        key: fs.readFileSync(path.join(certPath, 'key.pem')),
        cert: fs.readFileSync(path.join(certPath, 'cert.pem')),
      }
    }),
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE || "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        ws: true
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
