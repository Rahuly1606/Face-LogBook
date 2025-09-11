import axios from 'axios';

// Base API configuration
const API_ROOT = import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:5000/api/v1';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_ROOT,
  timeout: 20000,
});

// Request interceptor to add admin token
apiClient.interceptors.request.use(
  (config) => {
    // Add admin token for admin routes
    if (config.url?.includes('/students') || config.url?.includes('/attendance')) {
      const runtimeToken = (typeof window !== 'undefined' && localStorage.getItem('adminToken')) || '';
      if (runtimeToken) {
        config.headers['X-ADMIN-TOKEN'] = runtimeToken;
      }
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