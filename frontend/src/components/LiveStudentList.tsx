import React from 'react';
import { Card } from '@/components/ui/card';
import { RecognizedStudent, UnrecognizedFace } from '@/api/attendance';
import { Badge } from '@/components/ui/badge';
import { Check, XCircle, UserX } from 'lucide-react';

interface LiveStudentListProps {
  recognizedStudents: RecognizedStudent[];
  unrecognizedCount: number;
  unrecognizedFaces: UnrecognizedFace[];
  totalFaces?: number;
  processingTime?: number;
  clearList?: () => void;
}

const LiveStudentList: React.FC<LiveStudentListProps> = ({
  recognizedStudents,
  unrecognizedCount,
  unrecognizedFaces,
  totalFaces,
  processingTime,
  clearList,
}) => {
  // Group students by ID to avoid duplicates, keeping the most recent
  const uniqueStudents = recognizedStudents.reduce<Record<string, RecognizedStudent>>(
    (acc, student) => {
      // Only update if this is a new student or has a newer timestamp
      if (!acc[student.student_id] || 
          (student.timestamp && acc[student.student_id].timestamp && 
           new Date(student.timestamp) > new Date(acc[student.student_id].timestamp))) {
        acc[student.student_id] = student;
      }
      return acc;
    }, 
    {}
  );

  const studentList = Object.values(uniqueStudents);

  return (
    <Card className="p-6 shadow-lg mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Live Attendance</h3>
        <div className="flex items-center gap-4">
          {totalFaces !== undefined && (
            <Badge variant="outline" className="px-3 py-1">
              {totalFaces} {totalFaces === 1 ? 'face' : 'faces'} detected
            </Badge>
          )}
          {unrecognizedCount > 0 && (
            <Badge variant="secondary" className="px-3 py-1">
              <UserX className="h-4 w-4 mr-1" />
              {unrecognizedCount} unregistered
            </Badge>
          )}
          {clearList && (
            <Badge 
              variant="outline" 
              className="cursor-pointer px-3 py-1 hover:bg-secondary"
              onClick={clearList}
            >
              Clear List
            </Badge>
          )}
        </div>
      </div>

      {studentList.length === 0 && unrecognizedCount === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No students detected yet
        </div>
      ) : (
        <div className="space-y-4">
          {studentList.map((student) => (
            <div 
              key={student.student_id}
              className="flex items-center justify-between p-3 rounded-lg bg-card border"
            >
              <div className="flex items-center">
                <div className="bg-primary text-primary-foreground rounded-full h-8 w-8 flex items-center justify-center mr-3">
                  {student.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{student.name}</p>
                  <p className="text-sm text-muted-foreground">{student.student_id}</p>
                </div>
              </div>
              <div className="flex items-center">
                {student.action === 'checkin' && (
                  <Badge variant="success" className="flex items-center gap-1">
                    <Check className="h-3 w-3" /> Checked In
                  </Badge>
                )}
                {student.action === 'checkout' && (
                  <Badge variant="warning" className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Checked Out
                  </Badge>
                )}
                <Badge variant="outline" className="ml-2">
                  {Math.round(student.score * 100)}% match
                </Badge>
              </div>
            </div>
          ))}

          {unrecognizedCount > 0 && (
            <div className="p-3 rounded-lg bg-secondary border border-dashed">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-secondary-foreground text-secondary rounded-full h-8 w-8 flex items-center justify-center mr-3">
                    <UserX className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">Unregistered Students</p>
                    <p className="text-sm text-muted-foreground">
                      {unrecognizedCount} {unrecognizedCount === 1 ? 'person' : 'people'} not in system
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {processingTime !== undefined && (
        <div className="mt-4 text-right text-xs text-muted-foreground">
          Processing time: {processingTime}ms
        </div>
      )}
    </Card>
  );
};

export default LiveStudentList;