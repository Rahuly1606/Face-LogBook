import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { validateImageFile, resizeImage } from '@/utils/imageHelpers';
import { useToast } from '@/hooks/use-toast';
import { uploadGroupAttendance, RecognizedStudent } from '@/api/attendance';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UploadPhotoProps {
  groupId: number;
}

const GroupUploadPhoto: React.FC<UploadPhotoProps> = ({ groupId }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recognizedStudents, setRecognizedStudents] = useState<RecognizedStudent[]>([]);
  const [unrecognizedCount, setUnrecognizedCount] = useState(0);
  const [processingComplete, setProcessingComplete] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = useCallback(async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    try {
      // Resize image before upload
      const resizedBlob = await resizeImage(file, 2048);
      const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(resizedFile);
      
      setSelectedFile(resizedFile);
      // Reset previous results
      setRecognizedStudents([]);
      setUnrecognizedCount(0);
      setProcessingComplete(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process image",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const clearImage = useCallback(() => {
    setPreview(null);
    setSelectedFile(null);
    setRecognizedStudents([]);
    setUnrecognizedCount(0);
    setProcessingComplete(false);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a group photo to upload.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadGroupAttendance(selectedFile);
      
      setRecognizedStudents(response.recognized || []);
      setUnrecognizedCount(response.unrecognized_count || 0);
      setProcessingComplete(true);
      
      toast({
        title: "Attendance Processed",
        description: `${response.recognized?.length || 0} students recognized out of ${response.total_faces || 0} faces.`,
      });
    } catch (error) {
      console.error('Error uploading attendance:', error);
      toast({
        title: "Upload Error",
        description: "Failed to process attendance. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, toast]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Upload Group Photo for Attendance</h2>
        <p className="text-muted-foreground mb-4">
          Upload a group photo to automatically mark attendance for recognized students.
        </p>
      </div>
      
      <Card
        className={`relative border-2 border-dashed p-6 transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="rounded-md w-full max-h-96 object-contain mx-auto"
            />
            <Button
              variant="outline"
              size="icon"
              className="absolute top-2 right-2 rounded-full bg-background"
              onClick={clearImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop a group photo, or click to browse
            </p>
            <div className="mt-4">
              <input
                type="file"
                id="file-upload"
                accept="image/*"
                className="hidden"
                onChange={handleFileInput}
              />
              <label htmlFor="file-upload">
                <Button variant="outline" className="gap-2" asChild>
                  <span>
                    <Upload className="h-4 w-4" />
                    Select Photo
                  </span>
                </Button>
              </label>
            </div>
          </div>
        )}
      </Card>

      {selectedFile && (
        <div className="flex justify-end">
          <Button 
            onClick={handleUpload} 
            disabled={isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Process Attendance
              </>
            )}
          </Button>
        </div>
      )}

      {processingComplete && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold">Recognition Results:</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-5xl font-bold text-primary">
                    {recognizedStudents.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Students Recognized</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-5xl font-bold text-destructive">
                    {unrecognizedCount}
                  </p>
                  <p className="text-sm text-muted-foreground">Unrecognized Faces</p>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {recognizedStudents.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Attendance Marked:</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recognizedStudents.map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell>{student.student_id}</TableCell>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>
                        <span className={student.action === 'checkin' ? 'text-green-600' : 'text-orange-600'}>
                          {student.action === 'checkin' ? 'Check In' : 'Check Out'}
                        </span>
                      </TableCell>
                      <TableCell>{Math.round(student.score * 100)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {unrecognizedCount > 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              {unrecognizedCount} faces were detected but could not be recognized.
              Make sure all students are registered with clear photos.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupUploadPhoto;