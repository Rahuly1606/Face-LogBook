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
      // Redirect to login page, preserving the intended destination.
      // This allows users to be redirected back after a successful login.
      navigate('/login', { state: { from: location }, replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // If authenticated, render the children components.
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Render nothing while the redirect is in effect.
  // This prevents a flash of the protected content.
  return null;
};

export default AuthCheck;