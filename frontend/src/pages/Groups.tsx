import { useState, useEffect } from 'react';
import { Plus, Users, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { groupApi, Group } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Groups() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await groupApi.getAll();
      setGroups(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load groups',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a group name',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      await groupApi.create(newGroup);
      toast({
        title: 'Success',
        description: 'Group created successfully',
      });
      setShowCreateDialog(false);
      setNewGroup({ name: '' });
      loadGroups();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create group',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete group "${name}"?`)) {
      return;
    }

    try {
      await groupApi.delete(id);
      toast({
        title: 'Success',
        description: 'Group deleted successfully',
      });
      loadGroups();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete group',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Groups</h1>
          <p className="text-muted-foreground mt-1">Manage student groups and classes</p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          className="bg-accent hover:bg-accent/90 text-black font-semibold"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Group
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center bg-card-light border-0">
          <p className="text-muted-foreground">No groups created yet</p>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="mt-4 bg-accent hover:bg-accent/90 text-black"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create First Group
          </Button>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="p-6 bg-card-dark text-card-foreground border-0 shadow-md hover:shadow-xl transition-all duration-300"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-xl text-foreground mb-2">{group.name}</h3>
                    <Badge variant="secondary" className="bg-accent/20 text-black font-semibold text-sm px-3 py-1">
                      ID: {group.id}
                    </Badge>
                  </div>
                  <div className="p-2 rounded-lg bg-accent/20">
                    <Users className="h-5 w-5 text-black" />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Students</p>
                    <p className="font-mono text-base text-foreground font-semibold mt-1">{group.student_count || 0}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteGroup(group.id, group.name)}
                    className="hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Add a new group to organize students
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                placeholder="e.g., Computer Science Year 1"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={creating}
              className="bg-accent hover:bg-accent/90 text-black"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Group'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
