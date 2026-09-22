import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, RefreshCw, BookOpen, Trash2, ShieldCheck, Save, Loader2, CheckCircle2, AlertTriangle, Lock, Ban } from 'lucide-react';
import { TimePicker } from '@/components/TimePicker';
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
        <Card className="p-6">
            <div className="flex items-center gap-2 mb-1.5">
                <BookOpen className="h-5 w-5 text-accent-foreground" />
                <h2 className="text-base font-semibold">Section / Group</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
                Select a section to view and configure its time window. Each section can have its own time slot.
            </p>

            <div className="flex flex-wrap items-center gap-3">
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

                <Button onClick={onSaveGroup} disabled={savingGroup} size="sm" variant="outline" title="Save as default section">
                    {savingGroup ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <><Save className="h-4 w-4" />Set as Default</>
                    )}
                </Button>
            </div>

            {effectiveGroupId && selectedGroup && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    Viewing settings for <strong className="text-foreground">{selectedGroup.name}</strong>
                    {hasCustomWindow ? (
                        <Badge variant="success">Custom time slot</Badge>
                    ) : (
                        <Badge variant="info">Using global window</Badge>
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
        card: 'border-success/30 bg-success/8',
        icon: 'text-success',
        text: 'text-success',
        Icon: CheckCircle2,
        label: 'Window Open — On Time',
    },
    late: {
        card: 'border-warning/30 bg-warning/10',
        icon: 'text-warning-foreground',
        text: 'text-warning-foreground',
        Icon: AlertTriangle,
        label: 'Late Window Active',
    },
    early: {
        card: 'border-info/30 bg-info/8',
        icon: 'text-info',
        text: 'text-info',
        Icon: Clock,
        label: 'Window Not Open Yet',
    },
    rejected: {
        card: 'border-destructive/30 bg-destructive/8',
        icon: 'text-destructive',
        text: 'text-destructive',
        Icon: Ban,
        label: 'Late Entries Rejected',
    },
    closed: {
        card: 'border-destructive/30 bg-destructive/8',
        icon: 'text-destructive',
        text: 'text-destructive',
        Icon: Lock,
        label: 'Window Closed',
    },
} as const;

export function WindowStatusCard({ windowStatus, groupName, onRefresh }: WindowStatusCardProps) {
    const status = windowStatus.status;
    const styles = STATUS_STYLES[status] || STATUS_STYLES.closed;
    const StatusIcon = styles.Icon;

    return (
        <Card className={`border p-4 ${styles.card}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <StatusIcon className={`h-5 w-5 shrink-0 ${styles.icon}`} />
                    <div>
                        <p className={`text-sm font-semibold ${styles.text}`}>
                            {styles.label}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
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
        <div className="rounded-lg bg-muted/50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline Preview</p>
            <div className="flex items-center gap-1 overflow-hidden rounded-md">
                <div className="flex h-8 flex-1 items-center justify-center bg-muted text-xs text-muted-foreground">
                    Before {form.window_start}
                </div>
                <div className="flex h-8 flex-1 items-center justify-center bg-success/20 text-xs font-medium text-success">
                    On Time
                </div>
                <div className="flex h-8 flex-1 items-center justify-center bg-warning/20 text-xs font-medium text-warning-foreground">
                    {form.late_policy === 'late' ? 'Late' : 'Rejected'}
                </div>
                <div className="flex h-8 flex-1 items-center justify-center bg-destructive/15 text-xs font-medium text-destructive">
                    Closed
                </div>
            </div>
            <div className="mt-1 flex items-center gap-1">
                <div className="flex-1 text-center text-[10px] text-muted-foreground">&nbsp;</div>
                <div className="tnum flex-1 text-center text-[10px] text-muted-foreground">{form.window_start}</div>
                <div className="tnum flex-1 text-center text-[10px] text-muted-foreground">{form.window_end}</div>
                <div className="tnum flex-1 text-center text-[10px] text-muted-foreground">{form.late_end}</div>
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
                <TimePicker
                    id="window_start"
                    label="Window Opens (On-time Start)"
                    value={form.window_start}
                    onChange={(value) => onFormChange({ ...form, window_start: value })}
                    description="Students arriving from this time are marked Present"
                />

                <TimePicker
                    id="window_end"
                    label="On-time Window Ends"
                    value={form.window_end}
                    onChange={(value) => onFormChange({ ...form, window_end: value })}
                    description="After this, policy below applies"
                />

                <TimePicker
                    id="late_end"
                    label="Late Cutoff Time"
                    value={form.late_end}
                    onChange={(value) => onFormChange({ ...form, late_end: value })}
                    description="After this time, no attendance is accepted"
                />

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
                <Button onClick={onSave} disabled={saving} variant="accent">
                    {saving ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                    ) : (
                        <><Save className="h-4 w-4" />{isCustomForGroup ? 'Save Custom Time Slot' : 'Save Settings'}</>
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
        <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-accent-foreground" />
                    <h2 className="text-base font-semibold">
                        {groupName ? `Time Window — ${groupName}` : 'Global Time Window'}
                    </h2>
                </div>
                {groupName && hasCustomWindow && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={onRemoveCustom}
                        disabled={saving}
                        title="Remove custom time slot and revert to global"
                    >
                        <Trash2 className="h-4 w-4" />
                        Remove Custom
                    </Button>
                )}
            </div>

            {showGlobalInheritanceBanner && (
                <div className="mb-5 flex items-start gap-2 rounded-lg border border-info/30 bg-info/8 p-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                    <p className="text-sm text-foreground">
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
