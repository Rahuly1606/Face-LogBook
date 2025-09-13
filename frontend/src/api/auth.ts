import axios from 'axios';
import apiClient from './apiClient';

const API_URL = import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:5000/api/v1';

// Authentication endpoints
export const login = async (username: string, password: string) => {
  const response = await axios.post(`${API_URL}/auth/login`, { username, password });
  
  // Store the admin token directly
  if (response.data.success && response.data.access_token) {
    localStorage.setItem('adminToken', response.data.access_token);
  }
  
  return response.data;
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