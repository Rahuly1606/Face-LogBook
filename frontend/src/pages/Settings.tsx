import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { settingsApi, attendanceApi, groupApi, type AttendanceWindowSettings, type WindowStatusResponse } from '@/services/api';
import { GroupSelector, WindowStatusCard, TimeWindowCard } from './Settings/components';
import { validateTimeWindow, getEffectiveGroupId } from './Settings/utils';

export default function Settings() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [windowStatus, setWindowStatus] = useState<WindowStatusResponse | null>(null);

    // Group/section state
    const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [savingGroup, setSavingGroup] = useState(false);

    // Whether the selected group has a custom time slot
    const [hasCustomWindow, setHasCustomWindow] = useState<boolean>(false);
    const [loadingWindow, setLoadingWindow] = useState(false);

    const [form, setForm] = useState<AttendanceWindowSettings>({
        window_start: '09:00',
        window_end: '09:10',
        late_end: '09:30',
        late_policy: 'late',
    });

    /** Effective group ID to pass to APIs (empty string / 'none' → undefined) */
    const effectiveGroupId = getEffectiveGroupId(selectedGroupId);

    const loadSettings = useCallback(async (groupId?: string) => {
        setLoadingWindow(true);
        try {
            const data = await settingsApi.getAttendanceWindow(groupId);
            setForm({
                window_start: data.window_start,
                window_end: data.window_end,
                late_end: data.late_end,
                late_policy: data.late_policy,
            });
            setHasCustomWindow(!!data.has_custom);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to load settings', variant: 'destructive' });
        } finally {
            setLoadingWindow(false);
            setLoading(false);
        }
    }, [toast]);

    const loadWindowStatus = useCallback(async (groupId?: string) => {
        try {
            const status = await attendanceApi.getWindowStatus(groupId);
            setWindowStatus(status);
        } catch (error) {
            console.error('Failed to fetch window status:', error);
        }
    }, []);

    const loadGroups = async () => {
        setLoadingGroups(true);
        try {
            const data = await groupApi.getAll();
            setGroups(data);
        } catch (error) {
            console.error('Failed to load groups:', error);
        } finally {
            setLoadingGroups(false);
        }
    };

    const loadDefaultGroup = async () => {
        try {
            const data = await settingsApi.getDefaultGroup();
            const gid = data.default_group_id || '';
            setSelectedGroupId(gid);
            return gid;
        } catch (error) {
            console.error('Failed to load default group:', error);
            return '';
        }
    };

    const handleSaveGroup = async () => {
        setSavingGroup(true);
        try {
            const groupIdToSave = selectedGroupId === 'none' ? '' : selectedGroupId;
            const result = await settingsApi.updateDefaultGroup(groupIdToSave);
            toast({ title: 'Default Section Saved', description: result.message || 'Default section updated successfully' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to save default section', variant: 'destructive' });
        } finally {
            setSavingGroup(false);
        }
    };

    /** Remove per-group overrides so the group falls back to global settings */
    const handleRemoveCustomWindow = async () => {
        if (!effectiveGroupId) return;
        setSaving(true);
        try {
            // Delete group-specific keys by setting them to empty, then remove from DB
            await settingsApi.removeGroupWindow(effectiveGroupId);
            toast({ title: 'Custom Slot Removed', description: 'This section will now use the global time window' });
            setHasCustomWindow(false);
            // Reload to show global defaults
            loadSettings(effectiveGroupId);
            loadWindowStatus(effectiveGroupId);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to remove custom time slot', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        const validationError = validateTimeWindow(form);
        if (validationError) {
            toast({
                title: validationError.title,
                description: validationError.description,
                variant: 'destructive'
            });
            return;
        }

        setSaving(true);
        try {
            const result = await settingsApi.updateAttendanceWindow(form, effectiveGroupId);
            toast({
                title: 'Settings Saved',
                description: result.message || 'Attendance window updated successfully'
            });
            if (effectiveGroupId) setHasCustomWindow(true);
            loadWindowStatus(effectiveGroupId);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to save settings',
                variant: 'destructive'
            });
        } finally {
            setSaving(false);
        }
    };

    // On group change → reload settings & window status for new group
    useEffect(() => {
        loadSettings(effectiveGroupId);
        loadWindowStatus(effectiveGroupId);
    }, [selectedGroupId, loadSettings, loadWindowStatus]);

    // Initial loads
    useEffect(() => {
        (async () => {
            await loadGroups();
            const savedGroup = await loadDefaultGroup();
            // loadSettings/loadWindowStatus will fire via the selectedGroupId effect
        })();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }

    const selectedGroup = groups.find(g => String(g.id) === effectiveGroupId);

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-muted-foreground mt-1">
                    Configure attendance time window and policies per section
                </p>
            </div>

            <GroupSelector
                selectedGroupId={selectedGroupId}
                groups={groups}
                loadingGroups={loadingGroups}
                savingGroup={savingGroup}
                onGroupChange={setSelectedGroupId}
                onSaveGroup={handleSaveGroup}
                hasCustomWindow={hasCustomWindow}
            />

            {windowStatus && (
                <WindowStatusCard
                    windowStatus={windowStatus}
                    groupName={selectedGroup?.name}
                    onRefresh={() => loadWindowStatus(effectiveGroupId)}
                />
            )}

            <TimeWindowCard
                groupName={selectedGroup?.name}
                hasCustomWindow={hasCustomWindow}
                showGlobalInheritanceBanner={!!effectiveGroupId && !hasCustomWindow}
                loadingWindow={loadingWindow}
                form={form}
                saving={saving}
                onFormChange={setForm}
                onSave={handleSave}
                onRemoveCustom={handleRemoveCustomWindow}
            />
        </div>
    );
}
