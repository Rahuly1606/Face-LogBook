import { useState } from 'react';
import GroupForm from '../components/GroupForm';
import GroupTable from '../components/GroupTable';
import { useApp } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';

const ManageGroups = () => {
  const { isAuthenticated } = useApp();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: { pathname: '/admin/groups' } }} />;
  }

  const handleGroupActionSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Manage Groups</h1>
        <p className="text-muted-foreground mt-1">Create new groups or view existing ones.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Create New Group</CardTitle>
              <CardDescription>
                Add a new class group to the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GroupForm onSuccess={handleGroupActionSuccess} />
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Existing Groups</CardTitle>
                </CardHeader>
                <CardContent>
                    <GroupTable 
                        refreshTrigger={refreshTrigger} 
                        onDelete={handleGroupActionSuccess} 
                    />
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default ManageGroups;