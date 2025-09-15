import { useEffect } from 'react';
import { getAdminToken, checkAdminToken } from '../utils/authToken';

// This component ensures the admin token is set when the app loads
// It doesn't render anything visually
const AdminTokenSetter = () => {
  useEffect(() => {
    // Get or set the admin token
    const token = getAdminToken();
    console.log('AdminTokenSetter initialized with token:', token.substring(0, 5) + '...');
    
    // Check if the token is valid and fix it if needed
    checkAdminToken().then(isValid => {
      if (isValid) {
        console.log('Admin token is valid');
      } else {
        console.warn('Admin token is not valid, make sure to use "admin_secret_token"');
      }
    });
  }, []);

  return null;
};

export default AdminTokenSetter;