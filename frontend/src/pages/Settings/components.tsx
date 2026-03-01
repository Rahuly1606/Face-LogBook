import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, RefreshCw, BookOpen, Trash2, ShieldCheck, Save, Loader2 } from 'lucide-react';
import type { AttendanceWindowSettings, WindowStatusResponse } from '@/services/api';

interface GroupSelectorProps {
    selectedGroupId: string;
    groups: Array<{ id: number; name: string }>;
    loadingGroups: boolean;
    savingGroup: boolean;
    onGroupChange: (value: string) => void;
    onSaveGroup: () => void;
    hasCustomWindow: boolean;
}

export function GroupSelector({
    selectedGroupId,
    groups,
    loadingGroups,
    savingGroup,
    onGroupChange,
    onSaveGroup,
    hasCustomWindow
}: GroupSelectorProps) {
    const effectiveGroupId = selectedGroupId && selectedGroupId !== 'none' ? selectedGroupId : undefined;
    const selectedGroup = groups.find(g => String(g.id) === effectiveGroupId);

    return (
        <Card className="p-6 bg-card-light border-0">
            <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold">Section / Group</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
                Select a section to view and configure its time window. Each section can have its own time slot.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
                <Select value={selectedGroupId || 'none'} onValueChange={onGroupChange} disabled={loadingGroups}>
                    <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder={loadingGroups ? 'Loading sections...' : 'Choose a section/group'} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">— Global (All Sections) —</SelectItem>
                        {groups.map((group) => (
                            <SelectItem key={group.id} value={String(group.id)}>
                                {group.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    onClick={onSaveGroup}
                    disabled={savingGroup}
                    size="sm"
                    variant="outline"
                    title="Save as default section"
                >
                    {savingGroup ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            <Save className="mr-1.5 h-4 w-4" />
                            Set as Default
                        </>
                    )}
                </Button>
            </div>

            {effectiveGroupId && selectedGroup && (
                <p className="text-xs text-muted-foreground mt-2">
                    Viewing settings for: <strong>{selectedGroup.name}</strong>
                    {hasCustomWindow ? (
                        <span className="ml-2 text-green-600 dark:text-green-400">• Has custom time slot</span>
                    ) : (
                        <span className="ml-2 text-yellow-600 dark:text-yellow-400">• Using global time window</span>
                    )}
                </p>
            )}
        </Card>
    );
}

interface WindowStatusCardProps {
    windowStatus: WindowStatusResponse;
    groupName?: string;
    onRefresh: () => void;
}

const STATUS_STYLES = {
    on_time: {
        card: 'bg-green-50 dark:bg-green-950/30 border-l-4 !border-l-green-500',
        icon: 'text-green-600',
        text: 'text-green-700 dark:text-green-400',
        label: '✅ Window Open — On Time'
    },
    late: {
        card: 'bg-yellow-50 dark:bg-yellow-950/30 border-l-4 !border-l-yellow-500',
        icon: 'text-yellow-600',
        text: 'text-yellow-700 dark:text-yellow-400',
        label: '⚠️ Late Window Active'
    },
    early: {
        card: 'bg-blue-50 dark:bg-blue-950/30 border-l-4 !border-l-blue-500',
        icon: 'text-blue-600',
        text: 'text-blue-700 dark:text-blue-400',
        label: '🕐 Window Not Open Yet'
    },
    rejected: {
        card: 'bg-red-50 dark:bg-red-950/30 border-l-4 !border-l-red-500',
        icon: 'text-red-600',
        text: 'text-red-700 dark:text-red-400',
        label: '🚫 Late Entries Rejected'
    },
    closed: {
        card: 'bg-red-50 dark:bg-red-950/30 border-l-4 !border-l-red-500',
        icon: 'text-red-600',
        text: 'text-red-700 dark:text-red-400',
        label: '🔒 Window Closed'
    }
} as const;

export function WindowStatusCard({ windowStatus, groupName, onRefresh }: WindowStatusCardProps) {
    const status = windowStatus.status;
    const styles = STATUS_STYLES[status] || STATUS_STYLES.closed;

    return (
        <Card className={`p-4 border-0 ${styles.card}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                    <Clock className={`h-5 w-5 ${styles.icon}`} />
                    <div>
                        <p className={`font-semibold text-sm ${styles.text}`}>
                            {styles.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Current IST time: {windowStatus.window.current_time}
                            {groupName && <span> · {groupName}</span>}
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4" />
                </Button>
            </div>
        </Card>
    );
}

interface TimelinePreviewProps {
    form: AttendanceWindowSettings;
}

export function TimelinePreview({ form }: TimelinePreviewProps) {
    return (
        <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-xs font-medium text-muted-foreground mb-3">TIMELINE PREVIEW</p>
            <div className="flex items-center gap-1">
                <div className="flex-1 h-8 bg-muted rounded-l-md flex items-center justify-center text-xs text-muted-foreground">
                    Before {form.window_start}
                </div>
                <div className="flex-1 h-8 bg-green-200 dark:bg-green-800 flex items-center justify-center text-xs font-medium text-green-800 dark:text-green-200">
                    ✅ On Time
                </div>
                <div className="flex-1 h-8 bg-yellow-200 dark:bg-yellow-800 flex items-center justify-center text-xs font-medium text-yellow-800 dark:text-yellow-200">
                    {form.late_policy === 'late' ? '⏰ Late' : '🚫 Rejected'}
                </div>
                <div className="flex-1 h-8 bg-red-200 dark:bg-red-800 rounded-r-md flex items-center justify-center text-xs font-medium text-red-800 dark:text-red-200">
                    🔒 Closed
                </div>
            </div>
            <div className="flex items-center gap-1 mt-1">
                <div className="flex-1 text-center text-[10px] text-muted-foreground">&nbsp;</div>
                <div className="flex-1 text-center text-[10px] text-muted-foreground">{form.window_start}</div>
                <div className="flex-1 text-center text-[10px] text-muted-foreground">{form.window_end}</div>
                <div className="flex-1 text-center text-[10px] text-muted-foreground">{form.late_end}</div>
            </div>
        </div>
    );
}

interface TimeWindowFormProps {
    form: AttendanceWindowSettings;
    saving: boolean;
    isCustomForGroup: boolean;
    onFormChange: (form: AttendanceWindowSettings) => void;
    onSave: () => void;
}

export function TimeWindowForm({ form, saving, isCustomForGroup, onFormChange, onSave }: TimeWindowFormProps) {
    return (
        <div className="space-y-6">
            <TimelinePreview form={form} />

            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <Label htmlFor="window_start" className="text-foreground font-medium">
                        Window Opens (On-time Start)
                    </Label>
                    <Input
                        id="window_start"
                        type="time"
                        value={form.window_start}
                        onChange={(e) => onFormChange({ ...form, window_start: e.target.value })}
                        className="text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        Students arriving from this time are marked <strong>Present</strong>
                    </p>
                </div>

                <div>
                    <Label htmlFor="window_end" className="text-foreground font-medium">
                        On-time Window Ends
                    </Label>
                    <Input
                        id="window_end"
                        type="time"
                        value={form.window_end}
                        onChange={(e) => onFormChange({ ...form, window_end: e.target.value })}
                        className="text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">After this, policy below applies</p>
                </div>

                <div>
                    <Label htmlFor="late_end" className="text-foreground font-medium">
                        Late Cutoff Time
                    </Label>
                    <Input
                        id="late_end"
                        type="time"
                        value={form.late_end}
                        onChange={(e) => onFormChange({ ...form, late_end: e.target.value })}
                        className="text-foreground mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        After this time, <strong>no</strong> attendance is accepted
                    </p>
                </div>

                <div>
                    <Label htmlFor="late_policy" className="text-foreground font-medium">
                        Late Policy
                    </Label>
                    <Select
                        value={form.late_policy}
                        onValueChange={(val) => onFormChange({ ...form, late_policy: val })}
                    >
                        <SelectTrigger className="mt-1">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="late">Allow but mark as Late</SelectItem>
                            <SelectItem value="rejected">Reject entirely</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                        {form.late_policy === 'late'
                            ? 'Students arriving after on-time window will be marked as "Late"'
                            : 'Students arriving after on-time window will be rejected (no attendance recorded)'}
                    </p>
                </div>
            </div>

            <div className="flex justify-end pt-2">
                <Button
                    onClick={onSave}
                    disabled={saving}
                    className="bg-accent hover:bg-accent/90 text-black font-semibold"
                >
                    {saving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            {isCustomForGroup ? 'Save Custom Time Slot' : 'Save Settings'}
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

interface TimeWindowCardProps {
    groupName?: string;
    hasCustomWindow: boolean;
    showGlobalInheritanceBanner: boolean;
    loadingWindow: boolean;
    form: AttendanceWindowSettings;
    saving: boolean;
    onFormChange: (form: AttendanceWindowSettings) => void;
    onSave: () => void;
    onRemoveCustom: () => void;
}

export function TimeWindowCard({
    groupName,
    hasCustomWindow,
    showGlobalInheritanceBanner,
    loadingWindow,
    form,
    saving,
    onFormChange,
    onSave,
    onRemoveCustom
}: TimeWindowCardProps) {
    if (loadingWindow) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
        );
    }

    return (
        <Card className="p-6 bg-card-light border-0">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-accent" />
                    <h2 className="text-lg font-semibold">
                        {groupName ? `Time Window — ${groupName}` : 'Global Time Window'}
                    </h2>
                </div>
                {groupName && hasCustomWindow && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={onRemoveCustom}
                        disabled={saving}
                        title="Remove custom time slot and revert to global"
                    >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Remove Custom
                    </Button>
                )}
            </div>

            {showGlobalInheritanceBanner && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-5 flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                        This section currently uses the <strong>global</strong> time window. Edit the times below and save to create a <strong>custom time slot</strong> for this group.
                    </p>
                </div>
            )}

            <TimeWindowForm
                form={form}
                saving={saving}
                isCustomForGroup={showGlobalInheritanceBanner}
                onFormChange={onFormChange}
                onSave={onSave}
            />
        </Card>
    );
}
