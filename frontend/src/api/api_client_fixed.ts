import axios from 'axios';
import { getAdminToken } from '../utils/authToken';

// Base API configuration
const API_ROOT = "/api/v1";

// Create axios instance
const apiClient = axios.create({
  baseURL: API_ROOT,
  timeout: 60000, // Increased to 60 seconds for face processing
  withCredentials: true, // This is important for CORS with credentials
});

// Request interceptor to add authorization token
apiClient.interceptors.request.use(
  (config) => {
    // Add JWT token from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        if (userData.token) {
          config.headers['Authorization'] = `Bearer ${userData.token}`;
        }
      } catch (error) {
        console.error('Error parsing user data from localStorage', error);
      }
    }

    // Add admin token for all routes that need authentication
    const adminToken = getAdminToken();
    if (adminToken) {
      config.headers['X-ADMIN-TOKEN'] = adminToken;
      console.log('Added admin token to request:', adminToken.substring(0, 5) + '...');
    } else {
      console.warn('No admin token found in localStorage');
    }

    // Log request info (in development only)
    if (import.meta.env.DEV) {
      console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`, {
        baseURL: config.baseURL,
        headers: config.headers,
        data: config.data
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`Response: ${response.status} ${response.config.url}`, {
        data: response.data,
        headers: response.headers
      });
    }
    return response;
  },
  (error) => {
    // Comprehensive error logging and handling
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
        config: error.config
      });

      // Extract error message from response
      const message = error.response.data?.message ||
        error.response.data?.detail ||
        error.response.data?.error ||
        'An error occurred';

      // Enhance error with more details
      const apiError = new Error(message);
      (apiError as any).status = error.response.status;
      (apiError as any).data = error.response.data;

      return Promise.reject(apiError);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('Network Error:', error.request);

      // Check if this is a timeout error
      if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
        console.error('Request timeout:', error.config?.url);

        const timeoutError = new Error(
          'Request timed out - server may be processing too many faces'
        );
        (timeoutError as any).isNetworkError = true;
        (timeoutError as any).isTimeout = true;

        return Promise.reject(timeoutError);
      }

      // Create network error with helpful message
      const networkError = new Error(
        'Cannot reach backend — check server and CORS. See console for details.'
      );
      (networkError as any).isNetworkError = true;

      return Promise.reject(networkError);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request Error:', error.message);
      return Promise.reject(error);
    }
  }
);

export default apiClient;
export { API_ROOT };