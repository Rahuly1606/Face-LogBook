import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, CheckCircle2, Users, Image as ImageIcon } from 'lucide-react';
import { attendanceApi } from '@/services/api';

export default function UploadAttendance() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [results, setResults] = useState<{
        success: boolean;
        message: string;
        detected_count: number;
        students: Array<{
            student_id: string;
            name: string;
            confidence: number;
        }>;
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

    const handleUpload = async () => {
        if (!selectedFile) {
            toast({
                title: 'No Image Selected',
                description: 'Please select an image to upload',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        try {
            const result = await attendanceApi.uploadPhoto(selectedFile);
            setResults(result);

            toast({
                title: 'Success',
                description: `Detected ${result.detected_count} student(s)`,
            });
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Upload Attendance</h1>
                <p className="text-muted-foreground mt-1">Upload a group photo to mark attendance</p>
            </div>

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
                                            disabled={loading}
                                            className="flex-1 bg-accent hover:bg-accent/90 text-black"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Processing...
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
                                                className="p-3 rounded-lg bg-background border border-border"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold text-sm">{student.name}</h3>
                                                        <p className="text-xs text-muted-foreground">ID: {student.student_id}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-xs font-medium text-success">
                                                            {(student.confidence * 100).toFixed(1)}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <p>No students detected in this image</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}
