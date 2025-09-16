import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { School, Loader2, PlusCircle } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { createGroup } from '../api/auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

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
      toast({ title: 'Invalid Name', description: 'Group name cannot be empty.', variant: 'destructive' });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await createGroup(groupName);
      toast({ title: 'Success!', description: `Group "${groupName}" created successfully.` });
      setGroupName('');
      onSuccess?.(response.id, response.name);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create group. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-lg rounded-xl">
        <form onSubmit={handleSubmit}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                    <School className="h-6 w-6 text-primary" />
                    Create New Group
                </CardTitle>
                <CardDescription>
                    Organize students into groups like classes or teams for easier management.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label htmlFor="groupName" className="font-semibold">Group Name</Label>
                    <Input
                    id="groupName"
                    placeholder="e.g., Computer Science - Section A"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    disabled={isLoading}
                    className="transition-colors focus:ring-2 focus:ring-primary/50"
                    />
                </div>
            </CardContent>
            <CardFooter className="flex justify-end bg-muted/30 p-4 border-t rounded-b-xl">
                <Button type="submit" disabled={isLoading || !groupName.trim()} className="gap-2">
                    {isLoading ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Creating...
                        </>
                    ) : (
                        <>
                            <PlusCircle className="h-4 w-4" />
                            Create Group
                        </>
                    )}
                </Button>
            </CardFooter>
        </form>
    </Card>
  );
};

export default GroupForm;