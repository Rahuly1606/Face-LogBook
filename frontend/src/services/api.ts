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
    timeout: 20000, // 20 seconds max timeout (reduced from 60s)
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

// Utility for handling retries
const retry = async (fn: () => Promise<any>, retries = 2, delay = 1000, backoff = 2) => {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) {
            throw error;
        }

        // If backend is likely sleeping, wait longer
        if (!(error as AxiosError).response) {
            console.log(`Backend might be waking up. Retrying in ${delay}ms...`);
        } else {
            console.log(`Request failed. Retrying in ${delay}ms...`);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        return retry(fn, retries - 1, delay * backoff);
    }
};

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
    async (error: AxiosError) => {
        const config = error.config as AxiosRequestConfig & { _retry?: boolean, _isRetryRequest?: boolean };

        // Automatically retry network errors (likely backend waking up)
        // But only retry GET requests or specific important endpoints like login
        const isIdempotent = !config.method || config.method.toLowerCase() === 'get';
        const isImportantEndpoint = config.url?.includes('/auth/login') || config.url?.includes('/auth/refresh');
        const shouldRetry = (isIdempotent || isImportantEndpoint) && !config._retry;

        if (!error.response && shouldRetry) {
            config._retry = true;
            console.log('Network error detected. Backend might be waking up - attempting retry...');

            // Display a message to the user that we're trying to wake up the backend
            const wakeupEvent = new CustomEvent('api:backend-waking', {
                detail: { message: 'Connecting to backend service, this might take a moment...' }
            });
            window.dispatchEvent(wakeupEvent);

            try {
                // Try to wake up backend with a lightweight ping first
                await fetch(`${API_BASE}/api/v1/health/ping`, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                });

                // Now retry the original request
                return await retry(() => apiClient(config), 2, 1500, 1.5);
            } catch (retryError) {
                console.error('Retry failed after multiple attempts', retryError);
            }
        }

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
                `Cannot reach backend at ${API_BASE}. The server may be waking up - try again in a minute or check server status.`
            );
            (networkError as any).isNetworkError = true;
            (networkError as any).isBackendSleeping = true;

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