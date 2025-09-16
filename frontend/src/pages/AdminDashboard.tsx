import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Users, Camera, Upload, FileText, UserPlus, School } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const dashboardItems = [
    { title: 'Manage Groups', icon: School, link: '/groups', description: 'Create and organize class groups' },
    { title: 'Register Student', icon: UserPlus, link: '/admin/register', description: 'Add a new student to the system' },
    { title: 'Manage Students', icon: Users, link: '/admin/students', description: 'View, edit, and remove students' },
    { title: 'Live Attendance', icon: Camera, link: '/attendance/live', description: 'Take attendance with a live camera' },
    { title: 'Upload Attendance', icon: Upload, link: '/attendance/upload', description: 'Mark attendance from a group photo' },
    { title: 'Attendance Logs', icon: FileText, link: '/attendance/logs', description: 'View and export attendance records' },
  ];

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
          Welcome to FaceAttend. Select an option below to get started.
        </p>
      </header>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardItems.map((item) => (
          <Link key={item.link} to={item.link} className="group">
            <Card className="h-full transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1 border-border/60">
              <CardHeader className="flex flex-row items-center gap-4 pb-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg font-semibold">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;