import { useState, useEffect } from 'react';
import { Plus, Users, Loader2, Trash2, Link2, Check, Share2, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/layout/PageHeader';
import { groupApi, Group, registrationLinkApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Groups() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '' });
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Per-group link copy/share state
  const [loadingLinkGroupId, setLoadingLinkGroupId] = useState<number | null>(null);
  const [copiedLinkGroupId, setCopiedLinkGroupId] = useState<number | null>(null);

  const frontendBase = window.location.origin;

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await groupApi.getAll();
      setGroups(data);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to load groups', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) {
      toast({ title: 'Validation Error', description: 'Please provide a group name', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      await groupApi.create({ name: newGroup.name.trim() });
      toast({ title: 'Success', description: 'Group created successfully' });
      setShowCreateDialog(false);
      setNewGroup({ name: '' });
      loadGroups();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create group', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await groupApi.delete(deleteTarget.id);
      toast({ title: 'Success', description: 'Group deleted successfully' });
      setDeleteTarget(null);
      loadGroups();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete group', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  // One-click: reuse existing active link or create new, then copy / share
  const handleCopyGroupLink = async (group: Group) => {
    setLoadingLinkGroupId(group.id);
    try {
      let url: string | null = null;
      try {
        const { links } = await registrationLinkApi.list(group.id);
        const active = links.find((l) => l.is_active && !l.is_expired);
        if (active?.token) url = `${frontendBase}/register/${active.token}`;
      } catch { /* ignore, will create fresh */ }

      if (!url) {
        const resp = await registrationLinkApi.create(group.id, { expiry_days: 7 });
        url = `${frontendBase}/register/${resp.link.token}`;
      }

      if (navigator.share) {
        await navigator.share({ title: `Register for ${group.name}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopiedLinkGroupId(group.id);
        setTimeout(() => setCopiedLinkGroupId(null), 2000);
        toast({ title: 'Link copied', description: url });
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError')
        toast({ title: 'Error', description: error.message || 'Failed to get link', variant: 'destructive' });
    } finally {
      setLoadingLinkGroupId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups"
        description="Organize students into sections and classes"
        icon={FolderKanban}
        actions={
          <Button variant="accent" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            Create Group
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FolderKanban className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No groups yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first group to start organizing students into sections.
          </p>
          <Button variant="accent" className="mt-5" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            Create First Group
          </Button>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="group flex flex-col p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent-foreground transition-transform duration-300 group-hover:scale-105">
                  <Users className="h-5 w-5" />
                </div>
                <Badge variant="muted" className="font-mono">ID {group.id}</Badge>
              </div>

              <h3 className="mt-4 truncate text-lg font-semibold text-foreground">{group.name}</h3>

              <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Students</p>
                  <p className="mt-0.5 text-2xl font-bold tnum text-foreground">{group.student_count || 0}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopyGroupLink(group)}
                    disabled={loadingLinkGroupId === group.id}
                    title={navigator.share ? 'Share registration link' : 'Copy registration link'}
                  >
                    {loadingLinkGroupId === group.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : copiedLinkGroupId === group.id ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : navigator.share ? (
                      <Share2 className="h-4 w-4" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteTarget(group)}
                    title="Delete group"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
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
            <DialogDescription>Add a new section to organize students.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              placeholder="e.g., Computer Science Year 1"
              value={newGroup.name}
              onChange={(e) => setNewGroup({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={creating} variant="accent">
              {creating ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the group. Students in it are not deleted, but they will be
              unassigned from this group. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteGroup();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" />Deleting…</> : 'Delete Group'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
