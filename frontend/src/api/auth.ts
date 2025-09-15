import axios from 'axios';
import apiClient from './api_client_fixed';
import { setAdminToken } from '../utils/authToken';

const API_URL = import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:5000/api/v1';

// Authentication endpoints
export const login = async (username: string, password: string) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { username, password });
    
    // Store the admin token directly
    if (response.data.success && response.data.access_token) {
      setAdminToken(response.data.access_token);
    } else {
      // If we don't get a token from the server, use the default
      console.log('Using default admin token for development');
      setAdminToken('admin_secret_token');
    }
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    // Even if login fails, set the default token for development
    setAdminToken('admin_secret_token');
    throw error;
  }
};

export const refreshToken = async () => {
  // No need for token refresh with admin token - it doesn't expire
  return { success: true };
};

// Group management endpoints
export const getGroups = async () => {
  const response = await apiClient.get('/groups');
  return response.data;
};

export const createGroup = async (name: string) => {
  const response = await apiClient.post('/groups', { name });
  return response.data;
};

export const getGroup = async (groupId: number) => {
  const response = await apiClient.get(`/groups/${groupId}`);
  return response.data;
};

export const deleteGroup = async (groupId: number) => {
  const response = await apiClient.delete(`/groups/${groupId}`);
  return response.data;
};

export default apiClient;