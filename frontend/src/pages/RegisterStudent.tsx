import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, User, Upload as UploadIcon, RotateCcw } from 'lucide-react';
import { studentApi, groupApi, Group } from '@/services/api';
import { PageHeader } from '@/components/layout/PageHeader';
import BulkImport from '@/components/BulkImport';
import PoseCaptureFlow, { PoseCaptureResult, Pose } from '@/components/PoseCaptureFlow';

export default function RegisterStudent() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    const [capturedPoses, setCapturedPoses] = useState<PoseCaptureResult | null>(null);
    const [poseErrors, setPoseErrors] = useState<Partial<Record<Pose, string>>>({});
    const [flowKey, setFlowKey] = useState(0);
    const [formData, setFormData] = useState({
        student_id: '',
        name: '',
        group_id: 'none',
        drive_link: '',
    });

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            const data = await groupApi.getAll();
            setGroups(data);
        } catch (error) {
            console.error('Error loading groups:', error);
            toast({
                title: 'Error',
                description: 'Failed to load groups',
                variant: 'destructive',
            });
        }
    };

    const handlePosesComplete = (images: PoseCaptureResult) => {
        setCapturedPoses(images);
        setPoseErrors({});
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.student_id || !formData.name) {
            toast({
                title: 'Validation Error',
                description: 'Student ID and Name are required',
                variant: 'destructive',
            });
            return;
        }

        if (!capturedPoses && !formData.drive_link) {
            toast({
                title: 'Validation Error',
                description: 'Please capture all 3 pose photos or provide a Google Drive link',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            await studentApi.register({
                student_id: formData.student_id,
                name: formData.name,
                drive_link: formData.drive_link || undefined,
                group_id: formData.group_id && formData.group_id !== 'none' ? parseInt(formData.group_id) : undefined,
                ...(capturedPoses ? {
                    front_image: capturedPoses.front,
                    left_image: capturedPoses.left,
                    right_image: capturedPoses.right,
                } : {}),
            });

            toast({
                title: 'Success',
                description: 'Student registered successfully',
            });

            // Reset form
            setFormData({
                student_id: '',
                name: '',
                group_id: 'none',
                drive_link: '',
            });
            setCapturedPoses(null);
            setPoseErrors({});
            setFlowKey(k => k + 1);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to register student',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <PageHeader
                title="Register Student"
                description="Add students individually or import in bulk"
                icon={UserPlus}
            />

            <Tabs defaultValue="single" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="single" className="gap-1.5">
                        <User className="h-4 w-4" />
                        Single Student
                    </TabsTrigger>
                    <TabsTrigger value="bulk" className="gap-1.5">
                        <UploadIcon className="h-4 w-4" />
                        Bulk Import
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="single">
                    <Card className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Left Column */}
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="student_id">Student ID *</Label>
                                        <Input
                                            id="student_id"
                                            placeholder="e.g., STU001"
                                            value={formData.student_id}
                                            onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="name">Full Name *</Label>
                                        <Input
                                            id="name"
                                            placeholder="e.g., John Doe"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="group">Group (Optional)</Label>
                                        <Select value={formData.group_id} onValueChange={(value) => setFormData({ ...formData, group_id: value })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a group" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No Group</SelectItem>
                                                {groups.map((group) => (
                                                    <SelectItem key={group.id} value={group.id.toString()}>
                                                        {group.name} ({group.id})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="drive_link">Google Drive Link (Optional)</Label>
                                        <Input
                                            id="drive_link"
                                            type="url"
                                            placeholder="https://drive.google.com/..."
                                            value={formData.drive_link}
                                            onChange={(e) => setFormData({ ...formData, drive_link: e.target.value })}
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Provide a Google Drive link to a folder containing multiple photos
                                        </p>
                                    </div>
                                </div>

                                {/* Right Column - 3-Pose Photo Capture */}
                                <div>
                                    <Label className="mb-2 block">Student Photos (3 Poses) *</Label>
                                    <PoseCaptureFlow
                                        key={flowKey}
                                        onComplete={handlePosesComplete}
                                        disabled={loading}
                                        poseErrors={poseErrors}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 border-t border-border pt-6">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setFormData({
                                            student_id: '',
                                            name: '',
                                            group_id: 'none',
                                            drive_link: '',
                                        });
                                        setCapturedPoses(null);
                                        setPoseErrors({});
                                        setFlowKey(k => k + 1);
                                    }}
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Reset
                                </Button>
                                <Button type="submit" disabled={loading} variant="accent">
                                    {loading ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" />Registering…</>
                                    ) : (
                                        <><UserPlus className="h-4 w-4" />Register Student</>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </TabsContent>

                <TabsContent value="bulk">
                    <BulkImport onSuccess={loadGroups} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
