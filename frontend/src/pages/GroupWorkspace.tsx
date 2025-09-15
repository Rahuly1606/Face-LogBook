import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useToast } from '../hooks/use-toast';
import { getGroup } from '../api/auth';
import StudentForm from '../components/StudentForm';
import StudentTable from '../components/StudentTable';
import WebcamCapture from '../components/WebcamCapture';
import GroupUploadPhoto from '../components/GroupUploadPhoto';
import GroupAttendanceTable from '../components/GroupAttendanceTable';

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
  const [groupName, setGroupName] = useState(state?.groupName || 'Group');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!groupId) {
      navigate('/groups');
      return;
    }

    // If we don't have the group name from state, fetch it
    if (!state?.groupName) {
      const fetchGroupDetails = async () => {
        try {
          const response = await getGroup(parseInt(groupId));
          if (response.group) {
            setGroupName(response.group.name);
          }
        } catch (error) {
          console.error('Error fetching group details:', error);
          toast({
            title: 'Error',
            description: 'Could not fetch group details. Please try again.',
            variant: 'destructive',
          });
        }
      };
      
      fetchGroupDetails();
    }
  }, [groupId, navigate, state, toast]);

  const handleStudentAdded = () => {
    toast({
      title: 'Success',
      description: 'Student registered successfully',
    });
    setRefreshTrigger(prev => prev + 1);
    // Switch to students tab to show the newly added student
    setActiveTab('students');
  };

  const handleStudentUpdated = () => {
    toast({
      title: 'Success',
      description: 'Student updated successfully',
    });
    setRefreshTrigger(prev => prev + 1);
  };

  const handleStudentDeleted = () => {
    toast({
      title: 'Success',
      description: 'Student deleted successfully',
    });
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate('/groups')} className="px-2 py-1 h-8">
              Groups
            </Button>
            <span>/</span>
            <h1 className="text-xl sm:text-2xl font-bold break-words max-w-full">{groupName}</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">Group ID: {groupId}</p>
        </div>
      </div>

      <Tabs defaultValue="register" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto flex sm:grid sm:grid-cols-5">
          <TabsTrigger value="register" className="flex-1 whitespace-nowrap">Register Student</TabsTrigger>
          <TabsTrigger value="manage" className="flex-1 whitespace-nowrap">Manage Students</TabsTrigger>
          <TabsTrigger value="live" className="flex-1 whitespace-nowrap">Live Attendance</TabsTrigger>
          <TabsTrigger value="upload" className="flex-1 whitespace-nowrap">Upload Attendance</TabsTrigger>
          <TabsTrigger value="logs" className="flex-1 whitespace-nowrap">Attendance Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="register" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <StudentForm 
                groupId={parseInt(groupId || '0')} 
                onSuccess={handleStudentAdded} 
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="manage" className="mt-6">
          <StudentTable 
            groupId={parseInt(groupId || '0')}
            onUpdate={handleStudentUpdated}
            onDelete={handleStudentDeleted}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>
        
        <TabsContent value="live" className="mt-6">
          <WebcamCapture 
            groupId={parseInt(groupId || '0')}
            standalone={true}
          />
        </TabsContent>
        
        <TabsContent value="upload" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <GroupUploadPhoto 
                groupId={parseInt(groupId || '0')}
              />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="logs" className="mt-6">
          <GroupAttendanceTable 
            groupId={parseInt(groupId || '0')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GroupWorkspace;