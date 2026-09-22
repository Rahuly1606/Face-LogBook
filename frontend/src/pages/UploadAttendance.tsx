import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, CheckCircle2, Users, Image as ImageIcon, BookOpen, Clock, AlertTriangle } from 'lucide-react';
import { attendanceApi, groupApi, settingsApi, type WindowStatusResponse } from '@/services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import { WindowStatusBanner } from '@/components/WindowStatusBanner';

export default function UploadAttendance() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Group/Section selection state
    const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [loadingGroups, setLoadingGroups] = useState(false);

    // Attendance window status
    const [windowStatus, setWindowStatus] = useState<WindowStatusResponse | null>(null);

    const fetchWindowStatus = async (groupId?: string) => {
        try {
            const status = await attendanceApi.getWindowStatus(groupId || selectedGroupId || undefined);
            setWindowStatus(status);
        } catch (error) {
            console.error('Failed to fetch window status:', error);
        }
    };

    const [results, setResults] = useState<{
        success: boolean;
        message: string;
        detected_count: number;
        students: Array<{
            student_id: string;
            name: string;
            confidence: number;
        }>;
        wrong_section_students?: Array<{
            student_id: string;
            name: string;
            confidence: number;
            group_name?: string;
            message?: string;
        }>;
        unrecognized_count?: number;
    } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            setResults(null);
        }
    };

    const loadGroups = async () => {
        setLoadingGroups(true);
        try {
            const groups = await groupApi.getAll();
            setGroups(groups || []);
            // Pre-select the default group from settings
            if (!selectedGroupId) {
                try {
                    const def = await settingsApi.getDefaultGroup();
                    if (def.default_group_id && groups.some(g => String(g.id) === def.default_group_id)) {
                        setSelectedGroupId(def.default_group_id);
                    }
                } catch { /* ignore – default group is optional */ }
            }
        } catch (error: any) {
            console.error('Failed to load groups:', error);
            toast({
                title: 'Error',
                description: 'Failed to load sections/groups',
                variant: 'destructive',
            });
        } finally {
            setLoadingGroups(false);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast({
                title: 'No Image Selected',
                description: 'Please select an image to upload',
                variant: 'destructive',
            });
            return;
        }

        if (!selectedGroupId) {
            toast({
                title: 'Section Required',
                description: 'Please select a section/group',
                variant: 'destructive',
            });
            return;
        }

        // Validate attendance window is open
        if (windowStatus && windowStatus.status !== 'on_time' && windowStatus.status !== 'late') {
            toast({
                title: '🕐 Attendance Window',
                description: windowStatus.status === 'early'
                    ? `Window opens at ${windowStatus.window?.window_start || 'the scheduled time'}. Please wait.`
                    : 'Attendance window is closed. No entries allowed.',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            const result = await attendanceApi.uploadPhoto(selectedFile, selectedGroupId);
            setResults(result);

            const wrongCount = result.wrong_section_students?.length || 0;
            const correctCount = result.detected_count || 0;

            if (wrongCount > 0) {
                toast({
                    title: 'Section Mismatch',
                    description: `${correctCount} from selected section, ${wrongCount} from other sections`,
                });
            } else {
                toast({
                    title: 'Success',
                    description: `Detected ${correctCount} student(s)`,
                });
            }
        } catch (error: any) {
            // Refresh window status on error (might be window-closed)
            fetchWindowStatus();
            toast({
                title: error.message?.includes('window') || error.message?.includes('Window') || error.message?.includes('IST')
                    ? '🕐 Attendance Window'
                    : 'Error',
                description: error.message || 'Failed to process image',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setImagePreview('');
        setResults(null);
    };

    useEffect(() => {
        loadGroups();
        fetchWindowStatus();
        const interval = setInterval(() => fetchWindowStatus(), 30000);
        return () => clearInterval(interval);
    }, []);

    // Re-fetch window status when group changes
    useEffect(() => {
        if (selectedGroupId) {
            fetchWindowStatus(selectedGroupId);
        }
    }, [selectedGroupId]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Upload Attendance"
                description="Upload a group photo to mark attendance in bulk"
                icon={Upload}
            />

            {/* Section/Group Selection */}
            <Card className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex flex-shrink-0 items-center gap-2">
                        <BookOpen className="h-5 w-5 text-accent-foreground" />
                        <label className="text-sm font-medium">Select Section</label>
                    </div>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={loadingGroups}>
                        <SelectTrigger className="w-full sm:max-w-xs">
                            <SelectValue placeholder={loadingGroups ? "Loading sections..." : "Choose a section/group"} />
                        </SelectTrigger>
                        <SelectContent>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={String(group.id)}>
                                    {group.name} ({group.id})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            {/* Attendance Window Status Banner */}
            {windowStatus && <WindowStatusBanner windowStatus={windowStatus} />}

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Upload Section */}
                <div className="lg:col-span-2">
                    <Card className="p-6">
                        <div className="space-y-6">
                            {/* Image Upload */}
                            <div>
                                <label
                                    htmlFor="attendance-image"
                                    className="flex flex-col items-center justify-center w-full h-96 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent transition-colors bg-background"
                                >
                                    {imagePreview ? (
                                        <div className="relative w-full h-full">
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="h-full w-full object-contain rounded-lg"
                                            />
                                            {results && (
                                                <div className="absolute top-4 right-4 bg-success text-white px-3 py-1 rounded-full text-sm font-medium">
                                                    <CheckCircle2 className="inline w-4 h-4 mr-1" />
                                                    Processed
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <Upload className="w-16 h-16 mb-4 text-muted-foreground" />
                                            <p className="mb-2 text-lg font-semibold">Click to upload attendance photo</p>
                                            <p className="text-sm text-muted-foreground">or drag and drop</p>
                                            <p className="text-xs text-muted-foreground mt-2">PNG, JPG (MAX. 10MB)</p>
                                        </div>
                                    )}
                                    <input
                                        id="attendance-image"
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </label>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4">
                                {selectedFile && (
                                    <>
                                        <Button
                                            onClick={handleUpload}
                                            disabled={loading || !selectedGroupId || (windowStatus != null && windowStatus.status !== 'on_time' && windowStatus.status !== 'late')}
                                            variant="accent"
                                            className="flex-1"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Processing...
                                                </>
                                            ) : !selectedGroupId ? (
                                                <>
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Select Section First
                                                </>
                                            ) : windowStatus && windowStatus.status === 'early' ? (
                                                <>
                                                    <Clock className="mr-2 h-4 w-4" />
                                                    Window Not Open Yet
                                                </>
                                            ) : windowStatus && (windowStatus.status === 'closed' || windowStatus.status === 'rejected') ? (
                                                <>
                                                    <Clock className="mr-2 h-4 w-4" />
                                                    Window Closed
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="mr-2 h-4 w-4" />
                                                    Upload & Process
                                                </>
                                            )}
                                        </Button>
                                        <Button onClick={handleReset} variant="outline">
                                            Reset
                                        </Button>
                                    </>
                                )}
                            </div>

                            {/* Instructions */}
                            {!selectedFile && (
                                <div className="rounded-xl border border-border bg-muted/40 p-4">
                                    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                                        <ImageIcon className="h-4 w-4 text-accent-foreground" />
                                        Tips for best results
                                    </h3>
                                    <ul className="space-y-1.5 text-sm text-muted-foreground">
                                        <li className="flex gap-2"><span className="text-accent-foreground">•</span> Ensure faces are clearly visible and well-lit</li>
                                        <li className="flex gap-2"><span className="text-accent-foreground">•</span> Avoid blurry or low-quality images</li>
                                        <li className="flex gap-2"><span className="text-accent-foreground">•</span> Include multiple students in a single frame</li>
                                        <li className="flex gap-2"><span className="text-accent-foreground">•</span> Face the camera directly for better recognition</li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Results Section */}
                <div>
                    <Card className="p-5">
                        <div className="mb-4 flex items-center gap-2">
                            <Users className="h-5 w-5 text-accent-foreground" />
                            <h2 className="text-base font-semibold">Detection Results</h2>
                        </div>

                        {!results ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                    <Users className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <p className="font-medium text-foreground">No results yet</p>
                                <p className="mt-1 text-sm text-muted-foreground">Upload an image to see detected students</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-success/20 bg-success/8 p-4 text-center">
                                    <div className="text-3xl font-bold tnum text-success">{results.detected_count || 0}</div>
                                    <div className="text-sm text-muted-foreground">Students Detected</div>
                                </div>

                                <div className="max-h-96 space-y-2 overflow-y-auto">
                                    {results.students && results.students.length > 0 ? (
                                        results.students.map((student, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center justify-between rounded-lg border border-success/20 bg-success/5 p-3"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                                                    <h3 className="text-sm font-medium text-foreground">{student.name}</h3>
                                                </div>
                                                <Badge variant="success">In-Time</Badge>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="py-8 text-center text-sm text-muted-foreground">
                                            No students detected in this image
                                        </p>
                                    )}
                                </div>

                                {/* Wrong Section Students Warning */}
                                {results.wrong_section_students && results.wrong_section_students.length > 0 && (
                                    <div className="rounded-xl border border-warning/25 bg-warning/8 p-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-warning-foreground">
                                                <AlertTriangle className="h-4 w-4" />
                                                Wrong Section
                                            </h3>
                                            <Badge variant="warning">{results.wrong_section_students.length}</Badge>
                                        </div>
                                        <div className="max-h-48 space-y-1.5 overflow-y-auto">
                                            {results.wrong_section_students.map((student, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2"
                                                >
                                                    <h4 className="text-sm font-medium text-foreground">{student.name}</h4>
                                                    {student.group_name && (
                                                        <span className="shrink-0 text-xs text-muted-foreground">→ {student.group_name}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-center text-xs text-warning-foreground/80">
                                            Not marked — different section
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
