import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon, RefreshCw, Users, UserCheck, UserX } from 'lucide-react';
import { validateImageFile, resizeImage } from '@/utils/imageHelpers';
import { useToast } from '@/hooks/use-toast';
import { uploadGroupAttendance, RecognizedStudent } from '@/api/attendance';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface GroupUploadPhotoProps {
  groupId: number;
}

const GroupUploadPhoto: React.FC<GroupUploadPhotoProps> = ({ groupId }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [results, setResults] = useState<{ recognized: RecognizedStudent[], unrecognized: number, total: number } | null>(null);
  const { toast } = useToast();

  const resetState = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setIsUploading(false);
    setResults(null);
    setUploadProgress(0);
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    resetState();
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({ title: "Invalid File", description: validation.error, variant: "destructive" });
      return;
    }
    try {
      const resizedBlob = await resizeImage(file, 2048);
      const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });
      
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(resizedFile);
      setSelectedFile(resizedFile);
    } catch (error) {
      toast({ title: "Error Processing Image", description: "Failed to process image.", variant: "destructive" });
    }
  }, [toast, resetState]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    // Simulate progress
    const timer = setInterval(() => setUploadProgress(prev => Math.min(prev + 1, 95)), 300);

    try {
      const response = await uploadGroupAttendance(selectedFile);
      clearInterval(timer);
      setUploadProgress(100);
      
      setResults({
          recognized: response.recognized || [],
          unrecognized: response.unrecognized_count || 0,
          total: response.total_faces || 0,
      });
      
      toast({
        title: "Processing Complete",
        description: `${response.recognized?.length || 0} of ${response.total_faces || 0} faces were recognized.`,
      });
    } catch (error: any) {
        clearInterval(timer);
        setUploadProgress(0);
        toast({ title: "Upload Error", description: error.message || "An unknown error occurred.", variant: "destructive" });
    } finally {
      setTimeout(() => setIsUploading(false), 500); // give time for progress bar to finish
    }
  }, [selectedFile, toast]);

  return (
    <Card className="shadow-lg rounded-xl">
        <CardHeader>
            <CardTitle className="text-2xl">Group Photo Attendance</CardTitle>
            <CardDescription>Upload a single photo of a group to mark attendance for multiple students.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div
                className={cn(
                    "relative border-2 border-dashed rounded-xl p-6 text-center transition-all",
                    isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files[0]); }}
            >
                {preview ? (
                    <div className="relative group">
                        <img src={preview} alt="Group" className="rounded-md w-full max-h-96 object-contain mx-auto" />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="destructive" size="icon" className="rounded-full h-9 w-9" onClick={resetState}><X className="h-5 w-5" /></Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                        <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="font-semibold text-lg">Drag & Drop Group Photo</p>
                        <p className="text-muted-foreground">or</p>
                        <Button variant="outline" className="mt-2" onClick={() => document.getElementById('group-photo-upload')?.click()}>Browse Files</Button>
                        <input type="file" id="group-photo-upload" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e.target.files?.[0])} />
                    </div>
                )}
            </div>

            {selectedFile && !results && (
                <div className="flex flex-col items-center gap-4">
                    {isUploading && <Progress value={uploadProgress} className="w-full" />}
                    <Button size="lg" onClick={handleUpload} disabled={isUploading} className="gap-2 w-full sm:w-auto">
                        {isUploading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                        {isUploading ? `Processing... (${uploadProgress}%)` : 'Process Attendance'}
                    </Button>
                    {isUploading && <p className="text-sm text-muted-foreground">This may take up to 90 seconds depending on the image size.</p>}
                </div>
            )}

            {results && (
                <div className="animate-in fade-in-50 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard icon={Users} value={results.total} label="Total Faces Detected" color="bg-blue-100 text-blue-600" />
                        <StatCard icon={UserCheck} value={results.recognized.length} label="Students Recognized" color="bg-green-100 text-green-600" />
                        <StatCard icon={UserX} value={results.unrecognized} label="Unrecognized Faces" color="bg-red-100 text-red-600" />
                    </div>
                    
                    {results.recognized.length > 0 && (
                        <div>
                            <h4 className="font-semibold text-lg mb-2">Attendance Marked For:</h4>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Student ID</TableHead><TableHead>Name</TableHead><TableHead>Action</TableHead><TableHead className="text-right">Confidence</TableHead></TableRow></TableHeader>
                                    <TableBody>{results.recognized.map(s => (
                                        <TableRow key={s.student_id}>
                                            <TableCell className="font-mono text-muted-foreground">{s.student_id}</TableCell>
                                            <TableCell className="font-medium">{s.name}</TableCell>
                                            <TableCell><span className={cn("font-semibold", s.action === 'checkin' ? 'text-green-600' : 'text-orange-600')}>{s.action}</span></TableCell>
                                            <TableCell className="text-right font-medium">{Math.round(s.score * 100)}%</TableCell>
                                        </TableRow>
                                    ))}</TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                    <div className="text-center">
                        <Button variant="outline" onClick={resetState}>Upload Another Photo</Button>
                    </div>
                </div>
            )}
        </CardContent>
    </Card>
  );
};

const StatCard: React.FC<{ icon: React.ElementType, value: number, label: string, color: string }> = ({ icon: Icon, value, label, color }) => (
    <Card>
        <CardContent className="flex items-center gap-4 p-4">
            <div className={cn("p-3 rounded-full", color)}><Icon className="h-6 w-6" /></div>
            <div>
                <p className="text-3xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
            </div>
        </CardContent>
    </Card>
);

export default GroupUploadPhoto;