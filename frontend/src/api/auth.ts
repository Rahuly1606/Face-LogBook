import apiClient from './apiClient';
import { setAdminToken } from '../utils/authToken';

// Authentication endpoints
export const login = async (username: string, password: string) => {
  try {
    const response = await apiClient.post('/auth/login', { username, password });

    if (response.data.success && response.data.access_token) {
      const token: string = response.data.access_token;
      // Store JWT for Authorization header usage
      const user = { username, token };
      localStorage.setItem('user', JSON.stringify(user));
      // Also set legacy admin token header to the same JWT for backend fallback
      setAdminToken(token);
    }

    return response.data;
  } catch (error) {
    // Do not set any default tokens on failure
    throw error;
  }
};

export const refreshToken = async () => {
  // No refresh flow implemented
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