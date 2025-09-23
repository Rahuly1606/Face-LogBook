import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { getAdminToken } from '../utils/authToken';

// Get the API base URL from environment variables
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
const API_VERSION = '/api/v1';
const API_URL = `${API_BASE}${API_VERSION}`;

console.log('API configured with:', {
    base: API_BASE,
    version: API_VERSION,
    fullUrl: API_URL
});

// Create axios instance with proper configuration
const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 60000, // 60 seconds for face processing
    withCredentials: true, // Important for CORS with credentials
});

// Request interceptor to add authorization headers
apiClient.interceptors.request.use(
    (config) => {
        // Add JWT Authorization header if available (from login flow)
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

        // Add legacy admin token header for compatibility
        const adminToken = getAdminToken();
        if (adminToken) {
            config.headers['X-ADMIN-TOKEN'] = adminToken;
            console.log('Added admin token to request:', adminToken.substring(0, 5) + '...');
        } else {
            console.warn('No admin token found in localStorage');
        }

        // Only add Content-Type: application/json for non-FormData payloads
        if (config.data && !(config.data instanceof FormData) && !config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json';
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
    (error: AxiosError) => {
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
            const message =
                (error.response.data as any)?.message ||
                (error.response.data as any)?.detail ||
                (error.response.data as any)?.error ||
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
                `Cannot reach backend at ${API_BASE} — check server and CORS. See console for details.`
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

// Convenience methods for API calls
const api = {
    // Basic CRUD operations
    get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
        apiClient.get<T>(url, config),

    post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
        apiClient.post<T>(url, data, config),

    put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
        apiClient.put<T>(url, data, config),

    delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> =>
        apiClient.delete<T>(url, config),

    // File upload helper
    uploadFile: <T = any>(url: string, file: File, additionalData?: Record<string, any>): Promise<AxiosResponse<T>> => {
        const formData = new FormData();
        formData.append('file', file);

        if (additionalData) {
            Object.entries(additionalData).forEach(([key, value]) => {
                formData.append(key, String(value));
            });
        }

        return apiClient.post<T>(url, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },

    // Raw axios instance for advanced usage
    client: apiClient,

    // Configuration information (useful for debugging)
    config: {
        baseUrl: API_BASE,
        apiUrl: API_URL,
        version: API_VERSION
    }
};

export default api;
export { API_URL, API_BASE, API_VERSION };