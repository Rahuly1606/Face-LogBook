import { useState } from 'react';
import GroupForm from '../components/GroupForm';
import GroupTable from '../components/GroupTable';
import { useApp } from '../context/AppContext';
import { Navigate } from 'react-router-dom';

const ManageGroups = () => {
  const { isAuthenticated } = useApp();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleGroupCreated = () => {
    // Trigger a refresh of the group table
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="container mx-auto py-6 space-y-8">
      <h1 className="text-3xl font-bold">Manage Groups</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <GroupForm onSuccess={handleGroupCreated} />
        </div>
        
        <div className="md:col-span-2">
          <GroupTable refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </div>
  );
};

export default ManageGroups;