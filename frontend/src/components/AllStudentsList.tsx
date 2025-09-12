import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { StudentStatus, getAllStudentsStatus } from '@/api/attendance';
import { Badge } from '@/components/ui/badge';
import { Check, X, UserPlus, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface AllStudentsListProps {
  onRefresh?: () => void;
}

const AllStudentsList: React.FC<AllStudentsListProps> = ({ onRefresh }) => {
  const [students, setStudents] = useState<StudentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fetchStudentsStatus = async () => {
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
  };

  // Initial fetch
  useEffect(() => {
    fetchStudentsStatus();
  }, []);

  const handleRefresh = () => {
    fetchStudentsStatus();
    if (onRefresh) onRefresh();
  };

  // Count statistics
  const presentCount = students.filter(s => s.status === 'present').length;
  const absentCount = students.filter(s => s.status === 'absent').length;
  const totalCount = students.length;

  return (
    <Card className="p-6 shadow-lg mt-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold">All Students</h3>
          <p className="text-sm text-muted-foreground">
            {date ? `Attendance for ${new Date(date).toLocaleDateString()}` : 'Current attendance'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <Badge variant="success" className="px-3 py-1">
              <Check className="h-3 w-3 mr-1" />
              {presentCount} Present
            </Badge>
            <Badge variant="destructive" className="px-3 py-1">
              <X className="h-3 w-3 mr-1" />
              {absentCount} Absent
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <UserPlus className="h-3 w-3 mr-1" />
              {totalCount} Total
            </Badge>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md">
          {error}
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No students found in the system
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {students.map((student) => (
            <div 
              key={student.student_id}
              className="flex items-center justify-between p-3 rounded-lg bg-card border"
            >
              <div className="flex items-center">
                <div className={`rounded-full h-8 w-8 flex items-center justify-center mr-3 ${
                  student.status === 'present' 
                    ? 'bg-success text-success-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{student.name}</p>
                  <p className="text-sm text-muted-foreground">{student.student_id}</p>
                </div>
              </div>
              <div>
                {student.status === 'present' ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <Check className="h-3 w-3" /> Present
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <X className="h-3 w-3" /> Absent
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default AllStudentsList;