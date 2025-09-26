import axios from 'axios';
import { setAdminToken } from '../utils/authToken';
import api, { API_URL } from '../services/api';

// Authentication endpoints
export const login = async (username: string, password: string) => {
  try {
    // First try to wake up the backend with a ping if needed
    try {
      console.log('Checking if backend is awake before login...');
      await fetch(`${API_URL.replace('/api/v1', '')}/api/v1/health/ping`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        // Shorter timeout just for the ping
        signal: AbortSignal.timeout(5000)
      });
      console.log('Backend is responsive');
    } catch (pingError) {
      console.log('Backend ping failed, might be waking up', pingError);
      // We'll continue with login anyway, the retry logic will handle it
    }

    const response = await api.post('/auth/login', { username, password });

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
    // Handle backend sleeping case with a more specific error
    if ((error as any).isBackendSleeping) {
      throw new Error('The server appears to be waking up. Please wait a moment and try again.');
    }
    // Do not set any default tokens on failure
    throw error;
  }
};

export const refreshToken = async () => {
  try {
    // Try to refresh token using the refresh endpoint
    // Note: Your backend needs to implement this endpoint
    const response = await api.post('/auth/refresh', {});

    if (response.data.success && response.data.access_token) {
      const token = response.data.access_token;

      // Update stored user with new token
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.token = token;
          localStorage.setItem('user', JSON.stringify(user));
        }
      } catch (e) {
        console.error('Error updating user token in localStorage', e);
      }

      // Also update admin token
      setAdminToken(token);

      return { success: true, token };
    }

    return { success: false, message: 'Could not refresh token' };
  } catch (error) {
    console.error('Token refresh failed:', error);
    return {
      success: false,
      message: 'Token refresh failed, please log in again',
      error
    };
  }
};

// Group management endpoints
export const getGroups = async () => {
  const response = await api.get('/groups');
  return response.data;
};

export const createGroup = async (name: string) => {
  const response = await api.post('/groups', { name });
  return response.data;
};

export const getGroup = async (groupId: number) => {
  const response = await api.get(`/groups/${groupId}`);
  return response.data;
};

export const deleteGroup = async (groupId: number) => {
  const response = await api.delete(`/groups/${groupId}`);
  return response.data;
};

export default api;