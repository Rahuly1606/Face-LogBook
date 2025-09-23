import axios from 'axios';
import { getAdminToken } from '../utils/authToken';

// --- THIS IS THE CRITICAL FIX ---
// 1. Read the full backend URL from the environment variable.
const API_BASE_URL = import.meta.env.VITE_API_BASE;

// 2. Combine the base URL with the API path.
const API_ROOT = `${API_BASE_URL}/api/v1`;

// Log the final URL to the console to confirm it's correct.
console.log('API requests will be sent to:', API_ROOT);

// Create axios instance with the CORRECT, full baseURL
const apiClient = axios.create({
  baseURL: API_ROOT,
  timeout: 30000, // Increased timeout for potentially slow operations
  withCredentials: true,
});

// Request interceptor to add auth headers (no changes needed here)
apiClient.interceptors.request.use(
  (config) => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        const bearerToken = user?.token || user?.access_token;
        if (bearerToken) {
          config.headers['Authorization'] = `Bearer ${bearerToken}`;
        }
      }
    } catch (e) {
      // ignore parse errors
    }

    const adminToken = getAdminToken();
    if (adminToken) {
      config.headers['X-ADMIN-TOKEN'] = adminToken;
    }

    if (config.data && !(config.data instanceof FormData) && !config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling (no changes needed here)
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const message = error.response.data?.message ||
        error.response.data?.detail ||
        error.response.data?.error ||
        'An error occurred';
      const apiError = new Error(message);
      (apiError as any).status = error.response.status;
      (apiError as any).data = error.response.data;
      return Promise.reject(apiError);
    } else if (error.request) {
      const networkError = new Error(
        'Cannot reach backend — check server and CORS. See console for details.'
      );
      (networkError as any).isNetworkError = true;
      return Promise.reject(networkError);
    } else {
      return Promise.reject(error);
    }
  }
);

export default apiClient;


