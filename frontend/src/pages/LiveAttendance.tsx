import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import WebcamCapture from '@/components/WebcamCapture';

const LiveAttendance: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Live Attendance Capture</h1>
        <p className="text-muted-foreground">Use webcam to capture attendance in real-time</p>
      </div>
      
      <WebcamCapture />
    </div>
  );
};

export default LiveAttendance;