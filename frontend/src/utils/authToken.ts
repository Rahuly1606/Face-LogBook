// Simple utility to set admin token in localStorage
export const setAdminToken = (token: string) => {
  if (!token) return;
  // Write both variants for compatibility with older code paths
  localStorage.setItem('adminToken', token);
  localStorage.setItem('admin_token', token);
  return token;
};

// Get admin token from localStorage (no defaulting)
export const getAdminToken = (): string => {
  // Support multiple localStorage keys used across the codebase
  const token = localStorage.getItem('adminToken') || localStorage.getItem('admin_token');
  if (token) return token;

  // Fallback: check if a user object with JWT was stored (login flow)
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      return user?.token || user?.access_token || '';
    }
  } catch (e) {
    // ignore parse errors
  }

  return '';
};

// Check if the admin token is valid by making a request to the debug endpoint
export const checkAdminToken = async (): Promise<boolean> => {
  try {
    const token = getAdminToken();
    if (!token) return false;
    const response = await fetch('http://127.0.0.1:5000/api/v1/debug/token-check', {
      method: 'GET',
      headers: {
        'X-ADMIN-TOKEN': token
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return Boolean(data.match);
  } catch (error) {
    return false;
  }
};

// Clear admin token from localStorage
export const clearAdminToken = () => {
  localStorage.removeItem('adminToken');
  localStorage.removeItem('admin_token');
};