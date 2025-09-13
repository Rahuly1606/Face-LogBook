import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, Users, School } from 'lucide-react';
import GroupTable from '../components/GroupTable';
import GroupForm from '../components/GroupForm';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const GroupsPage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleGroupCreated = () => {
    toast({
      title: 'Success',
      description: 'Group created successfully',
    });
    setShowGroupForm(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleGroupDeleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSelectGroup = (groupId: number, groupName: string) => {
    navigate(`/groups/${groupId}`, { state: { groupName } });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <School className="h-8 w-8 text-primary" />
            Class Groups
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your class groups and organize students for attendance tracking
          </p>
        </div>
        
        <Dialog open={showGroupForm} onOpenChange={setShowGroupForm}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Create New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Group</DialogTitle>
            </DialogHeader>
            <GroupForm onSuccess={handleGroupCreated} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl shadow-sm border p-6">
        <GroupTable 
          onSelect={handleSelectGroup} 
          onDelete={handleGroupDeleted}
          refreshTrigger={refreshTrigger} 
        />
      </div>
    </div>
  );
};

export default GroupsPage;