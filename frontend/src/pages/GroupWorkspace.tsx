import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useToast } from '../hooks/use-toast';
import { getGroup } from '../api/auth';
import StudentForm from '../components/StudentForm';
import StudentTable from '../components/StudentTable';
import WebcamCapture from '../components/WebcamCapture';
import GroupUploadPhoto from '../components/GroupUploadPhoto';
import GroupAttendanceTable from '../components/GroupAttendanceTable';
import { ChevronRight } from 'lucide-react';

interface GroupDetailsState {
  groupName?: string;
}

const GroupWorkspace: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const location = useLocation();
  const state = location.state as GroupDetailsState;
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('register');
  const [groupName, setGroupName] = useState(state?.groupName || 'Loading Group...');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const numericGroupId = groupId ? parseInt(groupId) : NaN;
    if (isNaN(numericGroupId)) {
      navigate('/groups');
      return;
    }

    if (!state?.groupName) {
      const fetchGroupDetails = async () => {
        try {
          const response = await getGroup(numericGroupId);
          setGroupName(response.group?.name || 'Unknown Group');
        } catch (error) {
          console.error('Error fetching group details:', error);
          toast({
            title: 'Error',
            description: 'Could not fetch group details.',
            variant: 'destructive',
          });
          navigate('/groups');
        }
      };
      fetchGroupDetails();
    }
  }, [groupId, navigate, state, toast]);
  
  const handleSuccess = (description: string, targetTab?: string) => {
    toast({ title: 'Success', description });
    setRefreshTrigger(prev => prev + 1);
    if (targetTab) {
      setActiveTab(targetTab);
    }
  };

  const numericGroupId = parseInt(groupId || '0');

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <header>
        <div className="flex items-center text-sm text-muted-foreground">
          <Link to="/groups" className="hover:text-primary">Groups</Link>
          <ChevronRight className="h-4 w-4 mx-1" />
          <span className="font-medium text-foreground">{groupName}</span>
        </div>
        <h1 className="text-3xl font-bold mt-2">{groupName} Workspace</h1>
        <p className="text-sm text-muted-foreground">Group ID: {groupId}</p>
      </header>

      <Tabs defaultValue="register" value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-2">
          <TabsList className="flex w-full sm:w-auto">
            <TabsTrigger value="register" className="flex-1">Register Student</TabsTrigger>
            <TabsTrigger value="manage" className="flex-1">Manage Students</TabsTrigger>
            <TabsTrigger value="live" className="flex-1">Live Attendance</TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">Upload Photo</TabsTrigger>
            <TabsTrigger value="logs" className="flex-1">Attendance Logs</TabsTrigger>
          </TabsList>
        </div>
        
        <main className="mt-6">
          <TabsContent value="register">
            <StudentForm 
              groupId={numericGroupId} 
              onSuccess={() => handleSuccess('Student registered successfully.', 'manage')} 
            />
          </TabsContent>
          
          <TabsContent value="manage">
            <StudentTable 
              groupId={numericGroupId}
              onUpdate={() => handleSuccess('Student updated successfully.')}
              onDelete={() => handleSuccess('Student deleted successfully.')}
              refreshTrigger={refreshTrigger}
            />
          </TabsContent>
          
          <TabsContent value="live">
            <WebcamCapture groupId={numericGroupId} />
          </TabsContent>
          
          <TabsContent value="upload">
            <Card>
              <CardHeader>
                <CardTitle>Upload Group Photo for Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <GroupUploadPhoto groupId={numericGroupId} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="logs">
            <GroupAttendanceTable groupId={numericGroupId} />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
};

export default GroupWorkspace;