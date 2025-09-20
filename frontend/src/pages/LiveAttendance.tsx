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
    <div className="container mx-auto py-4 px-3 sm:py-8 sm:px-6 lg:px-8 space-y-4 sm:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold">Live Attendance Capture</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Point the camera at students to mark attendance in real-time.</p>
        </div>

        <div className="flex flex-row gap-2 sm:gap-4 items-center justify-center sm:justify-end flex-wrap">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
            <Label htmlFor="capture-interval" className="text-sm text-muted-foreground whitespace-nowrap">Interval:</Label>
            <Select
              value={captureInterval.toString()}
              onValueChange={handleIntervalChange}
            >
              <SelectTrigger id="capture-interval" className="w-[140px] h-9 text-sm">
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

          <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 h-9 px-3 text-sm sm:text-base w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        <div className="md:col-span-1 lg:col-span-2 order-1">
          <WebcamCapture groupId={0} onFaceRecognized={refreshStudentList} />
        </div>

        <div className="md:col-span-1 lg:col-span-1 order-2">
          <Card className="shadow-sm">
            <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
              <CardTitle className="text-lg sm:text-xl">Attendance Status</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Live status of all registered students.</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6">
              <AllStudentsList key={refreshTrigger} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default LiveAttendance;