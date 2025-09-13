import { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';

interface AuthCheckProps {
  children: React.ReactNode;
}

const AuthCheck: React.FC<AuthCheckProps> = ({ children }) => {
  const { isAuthenticated } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      // Redirect to login page with the intended destination
      navigate('/login', { state: { from: location } });
    }
  }, [isAuthenticated, navigate, location]);

  // If authenticated, render the children
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Return null while the redirect happens
  return null;
};

export default AuthCheck;