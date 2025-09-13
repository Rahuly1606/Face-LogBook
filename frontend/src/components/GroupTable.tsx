import { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Users, Calendar, ChevronRight, Trash2, School } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { getGroups, deleteGroup } from '../api/auth';
import { cn } from '../lib/utils';

interface Group {
  id: number;
  name: string;
  student_count: number;
  created_at: string;
}

interface GroupTableProps {
  onSelect?: (groupId: number, groupName: string) => void;
  onDelete?: (groupId: number) => void;
  refreshTrigger?: number;
}

const GroupTable = ({ onSelect, onDelete, refreshTrigger = 0 }: GroupTableProps) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch groups on component mount and when refreshTrigger changes
  useEffect(() => {
    const fetchGroups = async () => {
      setIsLoading(true);
      try {
        const response = await getGroups();
        setGroups(response.groups || []);
      } catch (error) {
        console.error('Error fetching groups:', error);
        toast({
          title: 'Error',
          description: 'Failed to load groups. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, [toast, refreshTrigger]);

  const handleDeleteGroup = async (groupId: number) => {
    if (!window.confirm('Are you sure you want to delete this group? This will not delete the students in the group.')) {
      return;
    }

    try {
      await deleteGroup(groupId);
      
      // Update local state
      setGroups(groups.filter(group => group.id !== groupId));
      
      toast({
        title: 'Group deleted',
        description: 'The group has been deleted successfully',
      });
      
      // Call callback if provided
      if (onDelete) {
        onDelete(groupId);
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete group. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex justify-center items-center p-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          <span className="ml-3 text-lg">Loading groups...</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center p-8 border rounded-xl bg-muted/50 flex flex-col items-center justify-center gap-4">
          <School className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-xl font-medium">No groups found</h3>
          <p className="text-muted-foreground max-w-md">
            Create a new group to organize your students and track attendance efficiently.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => {
            // Generate a deterministic color based on group name
            const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500', 'bg-indigo-500'];
            const colorIndex = group.id % colors.length;
            const bgColor = colors[colorIndex];
            
            return (
              <Card 
                key={group.id} 
                className="overflow-hidden transition-all duration-200 hover:shadow-lg border-2 hover:border-primary/20"
              >
                <div className={cn("h-2 w-full", bgColor)} />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-bold truncate" title={group.name}>
                      {group.name}
                    </CardTitle>
                    <Badge variant="outline" className="ml-2 text-xs px-2">
                      ID: {group.id}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pb-4">
                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                    <Users className="mr-2 h-4 w-4" />
                    <span>{group.student_count} student{group.student_count !== 1 ? 's' : ''}</span>
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>Created {formatDate(group.created_at)}</span>
                  </div>
                </CardContent>
                
                <CardFooter className="flex justify-between pt-2 border-t">
                  {onSelect && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelect(group.id, group.name)}
                      className="hover:bg-primary/10 flex items-center transition-colors"
                    >
                      Open Group
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteGroup(group.id)}
                    className="hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupTable;