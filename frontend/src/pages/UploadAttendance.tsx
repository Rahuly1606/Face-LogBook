import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, CheckCircle2, Users, Image as ImageIcon, BookOpen } from 'lucide-react';
import { attendanceApi, groupApi } from '@/services/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function UploadAttendance() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Group/Section selection state
    const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [loadingGroups, setLoadingGroups] = useState(false);

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
            toast({
                title: 'Error',
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
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Upload Attendance</h1>
                <p className="text-muted-foreground mt-1">Upload a group photo to mark attendance</p>
            </div>

            {/* Section/Group Selection */}
            <Card className="p-4 bg-card-light border-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <BookOpen className="h-5 w-5 text-accent" />
                        <label className="font-medium">Select Section:</label>
                    </div>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={loadingGroups}>
                        <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder={loadingGroups ? "Loading sections..." : "Choose a section/group"} />
                        </SelectTrigger>
                        <SelectContent>
                            {groups.map((group) => (
                                <SelectItem key={group.id} value={String(group.id)}>
                                    {group.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedGroupId && (
                        <span className="text-sm text-muted-foreground">
                            Selected: {groups.find(g => String(g.id) === selectedGroupId)?.name}
                        </span>
                    )}
                </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Upload Section */}
                <div className="lg:col-span-2">
                    <Card className="p-6 bg-card-light border-0">
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
                                            disabled={loading || !selectedGroupId}
                                            className="flex-1 bg-accent hover:bg-accent/90 text-black disabled:opacity-50 disabled:cursor-not-allowed"
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
                                <Card className="p-4 bg-background border-border">
                                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4" />
                                        Tips for best results
                                    </h3>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li>• Ensure faces are clearly visible and well-lit</li>
                                        <li>• Avoid blurry or low-quality images</li>
                                        <li>• Include multiple students in a single frame</li>
                                        <li>• Face the camera directly for better recognition</li>
                                    </ul>
                                </Card>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Results Section */}
                <div>
                    <Card className="p-6 bg-card-dark border-0">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="h-5 w-5" />
                            <h2 className="text-lg font-semibold">Detection Results</h2>
                        </div>

                        {!results ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No results yet</p>
                                <p className="text-sm mt-1">Upload an image to see detected students</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-success">{results.detected_count || 0}</div>
                                        <div className="text-sm text-muted-foreground">Students Detected</div>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {results.students && results.students.length > 0 ? (
                                        results.students.map((student, index) => (
                                            <div
                                                key={index}
                                                className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold text-sm text-green-900 dark:text-green-100">
                                                            {student.name}
                                                        </h3>
                                                    </div>
                                                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-200 dark:bg-green-900 text-green-800 dark:text-green-200">
                                                        In-Time
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <p>No students detected in this image</p>
                                        </div>
                                    )}
                                </div>

                                {/* Wrong Section Students Warning - Compact */}
                                {results.wrong_section_students && results.wrong_section_students.length > 0 && (
                                    <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                Wrong Section
                                            </h3>
                                            <span className="text-xs text-yellow-600 dark:text-yellow-500">
                                                {results.wrong_section_students.length} student{results.wrong_section_students.length > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {results.wrong_section_students.map((student, index) => (
                                                <div
                                                    key={index}
                                                    className="p-2 rounded bg-white dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-800"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex-1">
                                                            <h4 className="font-medium text-sm text-yellow-900 dark:text-yellow-200">
                                                                {student.name}
                                                            </h4>
                                                            {student.group_name && (
                                                                <p className="text-xs text-yellow-600 dark:text-yellow-500">
                                                                    → {student.group_name}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 text-center">
                                            ⚠️ Not marked - Different section
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
