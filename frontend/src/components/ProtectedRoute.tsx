import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const ProtectedRoute = () => {
  const { isAuthenticated } = useApp();
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login page but save the current location the user was trying to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;