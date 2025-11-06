import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Upload, UserPlus, Loader2, Camera, X, RefreshCw } from 'lucide-react';
import { studentApi, groupApi, Group } from '@/services/api';
import BulkImport from '@/components/BulkImport';

export default function RegisterStudent() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [showCamera, setShowCamera] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [formData, setFormData] = useState({
        student_id: '',
        name: '',
        group_id: 'none',
        image: null as File | null,
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

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFormData({ ...formData, image: file });
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
        try {
            // Stop existing stream if any
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: mode }
            });
            setStream(mediaStream);
            setShowCamera(true);
            setFacingMode(mode);

            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            }, 100);
        } catch (error: any) {
            toast({
                title: 'Camera Error',
                description: 'Could not access camera. Please check permissions.',
                variant: 'destructive',
            });
        }
    };

    const rotateCamera = async () => {
        const newMode = facingMode === 'user' ? 'environment' : 'user';
        await startCamera(newMode);
        toast({
            title: 'Camera Rotated',
            description: `Switched to ${newMode === 'user' ? 'front' : 'back'} camera`,
        });
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
        setShowCamera(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });
                        setFormData({ ...formData, image: file });
                        setImagePreview(canvas.toDataURL('image/jpeg'));
                        stopCamera();
                        toast({
                            title: 'Photo Captured',
                            description: 'Photo captured successfully',
                        });
                    }
                }, 'image/jpeg', 0.95);
            }
        }
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

        if (!formData.image && !formData.drive_link) {
            toast({
                title: 'Validation Error',
                description: 'Please provide either an image or a Google Drive link',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            await studentApi.register({
                student_id: formData.student_id,
                name: formData.name,
                image: formData.image || undefined,
                drive_link: formData.drive_link || undefined,
                group_id: formData.group_id && formData.group_id !== 'none' ? parseInt(formData.group_id) : undefined,
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
                image: null,
                drive_link: '',
            });
            setImagePreview('');
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
            <div>
                <h1 className="text-3xl font-bold">Register Student</h1>
                <p className="text-muted-foreground mt-1">Add students individually or in bulk</p>
            </div>

            <Tabs defaultValue="single" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="single">Single Student</TabsTrigger>
                    <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
                </TabsList>

                <TabsContent value="single">
                    <Card className="p-6 bg-card-light border-0">
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

                                {/* Right Column - Image Upload */}
                                <div>
                                    <Label>Student Photo *</Label>
                                    <div className="mt-2 space-y-3">
                                        {!showCamera ? (
                                            <>
                                                <label
                                                    htmlFor="image"
                                                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent transition-colors bg-background"
                                                >
                                                    {imagePreview ? (
                                                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover rounded-lg" />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                            <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                                                            <p className="mb-2 text-sm text-muted-foreground">
                                                                <span className="font-semibold">Click to upload</span> or drag and drop
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">PNG, JPG (MAX. 5MB)</p>
                                                        </div>
                                                    )}
                                                    <input
                                                        id="image"
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*"
                                                        onChange={handleImageChange}
                                                    />
                                                </label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full text-black border-black hover:bg-black/10"
                                                    onClick={() => startCamera()}
                                                >
                                                    <Camera className="mr-2 h-4 w-4" />
                                                    Capture from Camera
                                                </Button>
                                            </>
                                        ) : (
                                            <div className="relative">
                                                <video
                                                    ref={videoRef}
                                                    autoPlay
                                                    playsInline
                                                    muted
                                                    className="w-full h-64 object-cover rounded-lg bg-black"
                                                />
                                                <canvas ref={canvasRef} className="hidden" />
                                                <div className="flex gap-2 mt-3">
                                                    <Button
                                                        type="button"
                                                        onClick={capturePhoto}
                                                        className="flex-1 bg-accent hover:bg-accent/90 text-black"
                                                    >
                                                        <Camera className="mr-2 h-4 w-4" />
                                                        Capture Photo
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={rotateCamera}
                                                        className="text-black border-black hover:bg-black/10"
                                                        title="Rotate Camera"
                                                    >
                                                        <RefreshCw className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={stopCamera}
                                                        className="text-black border-black hover:bg-black/10"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800"
                                    onClick={() => {
                                        setFormData({
                                            student_id: '',
                                            name: '',
                                            group_id: 'none',
                                            image: null,
                                            drive_link: '',
                                        });
                                        setImagePreview('');
                                        stopCamera();
                                    }}
                                >
                                    Reset
                                </Button>
                                <Button type="submit" disabled={loading} className="bg-accent hover:bg-accent/90 text-black">
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Registering...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="mr-2 h-4 w-4" />
                                            Register Student
                                        </>
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
