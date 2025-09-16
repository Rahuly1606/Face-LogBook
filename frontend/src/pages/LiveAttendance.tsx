import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import WebcamCapture from '@/components/WebcamCapture';
import AllStudentsList from '@/components/AllStudentsList';
import { useAppContext } from '@/context/AppContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from "@/components/ui/label";

const LiveAttendance: React.FC = () => {
  const navigate = useNavigate();
  const { captureInterval, setCaptureInterval } = useAppContext();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleIntervalChange = (value: string) => {
    setCaptureInterval(parseInt(value));
  };

  const refreshStudentList = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Live Attendance Capture</h1>
          <p className="text-muted-foreground mt-1">Point the camera at students to mark attendance in real-time.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <div className="flex items-center gap-2">
            <Label htmlFor="capture-interval" className="text-sm text-muted-foreground whitespace-nowrap">Interval:</Label>
            <Select 
              value={captureInterval.toString()} 
              onValueChange={handleIntervalChange}
            >
              <SelectTrigger id="capture-interval" className="w-full sm:w-[140px]">
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
          
          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <WebcamCapture groupId={0} onFaceRecognized={refreshStudentList} />
        </div>
        
        <div className="lg:col-span-1">
           <Card>
             <CardHeader>
               <CardTitle>Attendance Status</CardTitle>
               <CardDescription>Live status of all registered students.</CardDescription>
             </CardHeader>
             <CardContent>
                <AllStudentsList key={refreshTrigger} />
             </CardContent>
           </Card>
        </div>
      </main>
    </div>
  );
};

export default LiveAttendance;