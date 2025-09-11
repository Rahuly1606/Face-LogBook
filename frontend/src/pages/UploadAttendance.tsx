import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Upload } from 'lucide-react';
import UploadPhoto from '@/components/UploadPhoto';
import { uploadGroupAttendance, RecognizedStudent } from '@/api/attendance';
import { useToast } from '@/hooks/use-toast';

const UploadAttendance: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [results, setResults] = useState<{ recognized: RecognizedStudent[]; unrecognized_count: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!selectedImage) return;

    setUploading(true);
    try {
      const response = await uploadGroupAttendance(selectedImage);
      setResults(response);
      toast({
        title: "Success",
        description: `Processed ${response.recognized.length} students`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Upload Group Photo for Attendance</h1>
      
      <Card className="p-6 mb-6">
        <UploadPhoto
          onImageSelect={setSelectedImage}
          label="Select Group Photo"
        />
        <Button 
          onClick={handleUpload} 
          disabled={!selectedImage || uploading}
          className="mt-4 w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? 'Processing...' : 'Process Attendance'}
        </Button>
      </Card>

      {results && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Recognized: {results.recognized.length} students
            </p>
            <p className="text-sm text-muted-foreground">
              Unrecognized: {results.unrecognized_count} faces
            </p>
            {results.recognized.map((student) => (
              <div key={student.student_id} className="flex justify-between p-2 bg-secondary rounded">
                <span>{student.name}</span>
                <span className="text-sm text-muted-foreground">Score: {student.score.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default UploadAttendance;