import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StudentStatus, getAllStudentsStatus } from '@/api/attendance';
import { Badge } from '@/components/ui/badge';
import { Check, X, User, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';

interface AllStudentsListProps {
  onRefresh?: () => void;
}

const AllStudentsList: React.FC<AllStudentsListProps> = ({ onRefresh }) => {
  const [students, setStudents] = useState<StudentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fetchStudentsStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAllStudentsStatus();
      setStudents(response.students);
      setDate(response.date);
    } catch (err) {
      setError('Failed to load student data. Please try again.');
      console.error('Error fetching student status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudentsStatus();
  }, [fetchStudentsStatus]);

  const handleRefresh = () => {
    fetchStudentsStatus();
    onRefresh?.();
  };

  const presentCount = students.filter(s => s.status === 'present').length;
  const absentCount = students.length - presentCount;

  const renderSkeleton = () => (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );

  return (
    <Card className="shadow-lg rounded-xl">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <CardTitle>Today's Roster</CardTitle>
          <CardDescription>
            {date ? `Attendance status for ${new Date(date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : 'Live attendance overview'}
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={loading}
          className="gap-1.5 self-start md:self-center"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </CardHeader>
      
      <CardContent>
        {/* Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg"><Check className="h-5 w-5 text-green-600" /></div>
            <div>
              <div className="text-sm text-muted-foreground">Present</div>
              <div className="text-2xl font-bold">{presentCount}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg"><X className="h-5 w-5 text-red-600" /></div>
            <div>
              <div className="text-sm text-muted-foreground">Absent</div>
              <div className="text-2xl font-bold">{absentCount}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg"><User className="h-5 w-5 text-blue-600" /></div>
            <div>
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="text-2xl font-bold">{students.length}</div>
            </div>
          </div>
        </div>
        
        {/* Student List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {loading ? renderSkeleton() : 
           error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="font-medium">No students registered in the system.</p>
            </div>
          ) : (
            students.map((student) => (
              <div 
                key={student.student_id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={cn('rounded-full h-10 w-10 flex items-center justify-center font-bold text-lg',
                    student.status === 'present' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{student.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">{student.student_id}</p>
                  </div>
                </div>
                <Badge variant={student.status === 'present' ? 'success' : 'destructive'} className="capitalize">
                  {student.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AllStudentsList;