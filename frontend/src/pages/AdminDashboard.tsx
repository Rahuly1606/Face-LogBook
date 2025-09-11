import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Users, Camera, Upload, FileText, UserPlus, Settings } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const dashboardItems = [
    { title: 'Register Student', icon: UserPlus, link: '/admin/register', color: 'bg-primary' },
    { title: 'Manage Students', icon: Users, link: '/admin/students', color: 'bg-accent' },
    { title: 'Live Attendance', icon: Camera, link: '/attendance/live', color: 'bg-success' },
    { title: 'Upload Attendance', icon: Upload, link: '/attendance/upload', color: 'bg-warning' },
    { title: 'Attendance Logs', icon: FileText, link: '/attendance/logs', color: 'bg-secondary' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-foreground">Face Recognition Attendance</h1>
        <p className="text-muted-foreground">Select an option to manage attendance and students</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardItems.map((item) => (
          <Link key={item.link} to={item.link}>
            <Card className="p-6 hover:shadow-lg transition-all hover:scale-105 cursor-pointer h-full">
              <div className={`${item.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                <item.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground">{item.title}</h3>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;