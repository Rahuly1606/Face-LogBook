import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BackendDiagnostic from '../components/BackendDiagnostic';
import WebcamDiagnostic from '@/components/WebcamDiagnostic';

const DiagnosticsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">System Diagnostics</h1>
      
      <div className="grid gap-6">
        <BackendDiagnostic />
        
        <Card>
          <CardHeader>
            <CardTitle>Server Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="font-semibold">Backend URL:</div>
              <div>{import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:5000/api/v1'}</div>
              
              <div className="font-semibold">Environment:</div>
              <div>{import.meta.env.MODE}</div>
            </div>
            
            <Button 
              variant="outline"
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }}
            >
              Clear Browser Storage & Reload
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Image Upload Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">
                Upload a test image to check if the file upload functionality is working correctly.
              </p>
              <TestImageUpload />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Webcam Diagnostic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">
                Test your webcam to ensure it's working properly for face recognition.
              </p>
              <WebcamDiagnostic />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const TestImageUpload: React.FC = () => {
  const [isUploading, setIsUploading] = React.useState(false);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setError(null);
    setResult(null);
    
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_ROOT || 'http://127.0.0.1:5000/api/v1'}/debug/test-image-processing`, {
        method: 'POST',
        body: formData,
        headers: {
          // Let the browser set the content type with boundary
          'X-ADMIN-TOKEN': localStorage.getItem('admin_token') || ''
        },
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.message || 'Error uploading image');
      }
    } catch (err) {
      setError('Network error - could not connect to server');
      console.error('Upload test error:', err);
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div>
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange}
        disabled={isUploading}
        className="block w-full text-sm text-gray-500
                 file:mr-4 file:py-2 file:px-4
                 file:rounded-md file:border-0
                 file:text-sm file:font-semibold
                 file:bg-blue-50 file:text-blue-700
                 hover:file:bg-blue-100"
      />
      
      {isUploading && <p className="mt-2 text-blue-600">Uploading...</p>}
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600">
          {error}
        </div>
      )}
      
      {result && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
          <h3 className="font-semibold text-green-700 mb-2">Upload Successful</h3>
          <div className="grid grid-cols-2 gap-1 text-sm">
            <div className="font-medium">Image dimensions:</div>
            <div>{result.image_info.width} x {result.image_info.height} pixels</div>
            
            <div className="font-medium">File size:</div>
            <div>{result.image_info.size_mb} MB ({result.image_info.size_bytes} bytes)</div>
            
            <div className="font-medium">Channels:</div>
            <div>{result.image_info.channels}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticsPage;