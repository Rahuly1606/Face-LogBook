import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { RecognizedStudent } from '@/api/attendance';
import { Badge } from '@/components/ui/badge';
import { UserCheck, UserX, Users, Sigma, Clock } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

import { UnrecognizedFace } from '@/api/attendance';

interface LiveStudentListProps {
  recognizedStudents: RecognizedStudent[];
  unrecognizedCount: number;
  unrecognizedFaces?: UnrecognizedFace[];
  totalFaces?: number;
  processingTime?: number;
}

const LiveStudentList: React.FC<LiveStudentListProps> = ({
  recognizedStudents,
  unrecognizedCount,
  unrecognizedFaces,
  totalFaces,
  processingTime,
}) => {
  const uniqueStudents = Array.from(
    new Map(recognizedStudents.map(s => [s.student_id, s])).values()
  ).sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

  return (
    <Card className="shadow-lg rounded-xl">
      <CardHeader>
        <CardTitle>Live Recognition Feed</CardTitle>
        <CardDescription>Students recognized in real-time from the camera feed.</CardDescription>
        <div className="flex flex-wrap items-center gap-3 pt-4">
          <StatBadge icon={Users} value={totalFaces} label="Faces" />
          <StatBadge icon={UserCheck} value={uniqueStudents.length} label="Recognized" variant="success" />
          <StatBadge icon={UserX} value={unrecognizedCount} label="Unrecognized" variant="destructive" />
          {processingTime && <StatBadge icon={Clock} value={`${processingTime}ms`} label="Latency" />}
          {/* Optionally display unrecognizedFaces.length if needed */}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {uniqueStudents.length === 0 && unrecognizedCount === 0 ? (
            <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
              <UserCheck className="h-12 w-12 mb-4" />
              <p className="font-semibold">Awaiting Detection</p>
              <p className="text-sm">Recognized students will appear here.</p>
            </div>
          ) : (
            <AnimatePresence>
              {uniqueStudents.map((student) => (
                <motion.div
                  key={student.student_id}
                  layout
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10 border-2 border-primary/50">
                      <AvatarFallback className="bg-primary/20 font-bold">
                        {student.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold">{student.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">{student.student_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-semibold">{Math.round(student.score * 100)}%</Badge>
                    <Badge variant={student.action === 'checkin' ? 'success' : 'warning'} className="capitalize">
                      {student.action}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface StatBadgeProps {
  icon: React.ElementType;
  value: number | string | undefined;
  label: string;
  variant?: "success" | "destructive" | "default";
}

const StatBadge: React.FC<StatBadgeProps> = ({ icon: Icon, value, label, variant = "default" }) => {
  if (value === undefined || value === null) return null;
  const colors = {
    success: 'bg-green-100 text-green-800',
    destructive: 'bg-red-100 text-red-800',
    default: 'bg-muted text-muted-foreground',
  };
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full text-sm", colors[variant])}>
      <Icon className="h-4 w-4" />
      <span className="font-bold">{value}</span>
      <span className="font-medium text-xs">{label}</span>
    </div>
  );
};

export default LiveStudentList;