import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import WebcamCapture from '@/components/WebcamCapture';
import { useAppContext } from '@/context/AppContext';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const LiveAttendance: React.FC = () => {
  const navigate = useNavigate();
  const { captureInterval, setCaptureInterval } = useAppContext();

  const handleIntervalChange = (value: string) => {
    setCaptureInterval(parseInt(value));
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Live Attendance Capture</h1>
          <p className="text-muted-foreground">Use webcam to capture attendance in real-time</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Capture interval:</span>
            <Select 
              value={captureInterval.toString()} 
              onValueChange={handleIntervalChange}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1 second</SelectItem>
                <SelectItem value="2000">2 seconds</SelectItem>
                <SelectItem value="3000">3 seconds</SelectItem>
                <SelectItem value="5000">5 seconds</SelectItem>
                <SelectItem value="10000">10 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>
      
      <WebcamCapture />
    </div>
  );
};

export default LiveAttendance;