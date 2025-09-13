import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AlertCircle, School } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { createGroup } from '../api/auth';

interface GroupFormProps {
  onSuccess?: (groupId: number, groupName: string) => void;
}

const GroupForm = ({ onSuccess }: GroupFormProps) => {
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!groupName.trim()) {
      toast({
        title: 'Invalid input',
        description: 'Please enter a group name',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await createGroup(groupName);
      toast({
        title: 'Group created',
        description: `Group "${groupName}" has been created successfully`,
      });
      
      // Reset form
      setGroupName('');
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess(response.id, response.name);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: 'Error',
        description: 'Failed to create group. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <School className="h-5 w-5 text-primary" />
        <p className="text-sm text-muted-foreground">
          Create a new class group to organize students and track attendance
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name</Label>
            <Input
              id="groupName"
              placeholder="Enter group name (e.g., Class 10A, Marketing Team)"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={isLoading}
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/30"
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setGroupName('')} disabled={isLoading || !groupName}>
              Clear
            </Button>
            <Button type="submit" disabled={isLoading || !groupName.trim()}>
              {isLoading ? 
                <span className="flex items-center">
                  <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  Creating...
                </span> : 
                'Create Group'
              }
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default GroupForm;