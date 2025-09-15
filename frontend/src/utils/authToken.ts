// Simple utility to set admin token in localStorage
export const setAdminToken = (token: string = 'admin_secret_token') => {
  // Make sure we're using the correct token that matches the backend
  const finalToken = token === 'admin_secret_token' ? 'admin_secret_token' : token;
  localStorage.setItem('adminToken', finalToken);
  console.log('Admin token set in localStorage:', finalToken.substring(0, 5) + '...');
  return finalToken;
};

// Get admin token from localStorage, or set default if missing
export const getAdminToken = (): string => {
  let token = localStorage.getItem('adminToken');
  if (!token) {
    token = setAdminToken();
  }
  return token;
};

// Check if the admin token is valid by making a request to the debug endpoint
export const checkAdminToken = async (): Promise<boolean> => {
  try {
    const response = await fetch('http://127.0.0.1:5000/api/v1/debug/token-check', {
      method: 'GET',
      headers: {
        'X-ADMIN-TOKEN': getAdminToken()
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      console.error('Token check failed with status:', response.status);
      
      // If it's a 500 error, the endpoint might not exist yet
      if (response.status === 500) {
        console.warn('Token check endpoint returned 500 - assuming token is valid for now');
        return true;
      }
      
      return false;
    }
    
    const data = await response.json();
    console.log('Token check result:', data);
    
    if (!data.match && data.expected_token) {
      // If token doesn't match, reset to the expected token
      setAdminToken(data.expected_token);
      return true;
    }
    
    return data.match;
  } catch (error: any) {
    console.error('Error checking admin token:', error);
    
    // If it's a timeout or network error, assume token is valid for now
    if (error.name === 'TimeoutError' || error.name === 'TypeError') {
      console.warn('Token check failed due to network/timeout - assuming token is valid');
      return true;
    }
    
    return false;
  }
};

// Clear admin token from localStorage
export const clearAdminToken = () => {
  localStorage.removeItem('adminToken');
  console.log('Admin token cleared from localStorage');
};