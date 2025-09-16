import React, { useState } from 'react';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, School } from 'lucide-react';
import GroupTable from '../components/GroupTable';
import GroupForm from '../components/GroupForm';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const GroupsPage: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleGroupActionSuccess = (message: string) => {
    toast({
      title: 'Success',
      description: message,
    });
    setRefreshTrigger(prev => prev + 1);
    setIsFormOpen(false);
  };

  const handleSelectGroup = (groupId: number, groupName: string) => {
    navigate(`/groups/${groupId}`, { state: { groupName } });
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <School className="h-8 w-8 text-primary" />
            Class Groups
          </h1>
          <p className="text-muted-foreground mt-2">
            Organize students into groups for streamlined attendance tracking.
          </p>
        </div>
        
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2 w-full md:w-auto">
              <Plus className="h-5 w-5" />
              Create New Group
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create a New Group</DialogTitle>
              <DialogDescription>
                Enter a name for your new group. You can add students later.
              </DialogDescription>
            </DialogHeader>
            <GroupForm onSuccess={() => handleGroupActionSuccess('Group created successfully.')} />
          </DialogContent>
        </Dialog>
      </header>

      <main className="bg-card rounded-xl shadow-sm border p-4 sm:p-6">
        <GroupTable 
          onSelect={handleSelectGroup} 
          onDelete={() => handleGroupActionSuccess('Group deleted successfully.')}
          refreshTrigger={refreshTrigger} 
        />
      </main>
    </div>
  );
};

export default GroupsPage;