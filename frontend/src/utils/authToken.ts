// Simple utility to set admin token in localStorage
export const setAdminToken = (token: string) => {
  if (!token) return;
  localStorage.setItem('adminToken', token);
  return token;
};

// Get admin token from localStorage (no defaulting)
export const getAdminToken = (): string => {
  return localStorage.getItem('adminToken') || '';
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
};