import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import UploadPhoto from '@/components/UploadPhoto';
import { uploadGroupAttendance, RecognizedStudent } from '@/api/attendance';
import { useToast } from '@/hooks/use-toast';

const UploadAttendance: React.FC = () => {
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [results, setResults] = useState<{ recognized: RecognizedStudent[]; unrecognized_count: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    setResults(null);
    try {
      const response = await uploadGroupAttendance(selectedImage);
      setResults(response);
      toast({
        title: "Upload Successful",
        description: `Found ${response.recognized.length} recognized and ${response.unrecognized_count} unrecognized faces.`,
      });
    } catch (error: any) {
      toast({
        title: "Upload Error",
        description: error.message || "Failed to process the image.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-4xl">
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold">Upload for Attendance</h1>
        <p className="text-muted-foreground mt-1">Select a group photo to mark attendance for multiple students at once.</p>
      </header>
      
      <Card>
        <CardHeader>
            <CardTitle>1. Select Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadPhoto onImageSelect={setSelectedImage} />
          <Button 
            onClick={handleUpload} 
            disabled={!selectedImage || isUploading}
            className="mt-4 w-full"
            size="lg"
          >
            {isUploading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Upload className="h-5 w-5 mr-2" />}
            {isUploading ? 'Processing...' : 'Process Attendance'}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>2. Results</CardTitle>
                <CardDescription>
                    <span className="text-green-600 font-semibold">{results.recognized.length} students</span> were recognized and marked as present. <span className="text-red-600 font-semibold">{results.unrecognized_count} faces</span> were not recognized.
                </CardDescription>
            </CardHeader>
          <CardContent>
            {results.recognized.length > 0 ? (
                <ul className="space-y-2">
                    {results.recognized.map((student) => (
                    <li key={student.student_id} className="flex justify-between items-center p-3 bg-secondary rounded-md">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                            <span className="font-medium">{student.name}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">Confidence: {(student.score * 100).toFixed(0)}%</span>
                    </li>
                    ))}
                </ul>
            ) : (
                <div className="text-center py-6 text-muted-foreground">
                    <XCircle className="h-8 w-8 mx-auto mb-2"/>
                    <p>No students were recognized in the uploaded photo.</p>
                </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UploadAttendance;