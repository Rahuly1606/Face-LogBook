import { LayoutDashboard, Users, UserPlus, FolderKanban, Video, Upload, History } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const mainItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Students', url: '/students', icon: Users },
  { title: 'Register Student', url: '/register', icon: UserPlus },
  { title: 'Groups', url: '/groups', icon: FolderKanban },
];

const attendanceItems = [
  { title: 'Live Attendance', url: '/attendance/live', icon: Video },
  { title: 'Upload Photo', url: '/attendance/upload', icon: Upload },
  { title: 'Attendance Logs', url: '/attendance/logs', icon: History },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-sidebar-accent border-l-2 border-sidebar-primary font-medium'
      : 'hover:bg-sidebar-accent/50';

  return (
    <Sidebar className={isCollapsed ? 'w-14' : 'w-64'}>
      <SidebarContent>
        {/* Logo */}
        <div className="px-4 py-6 border-b border-sidebar-border">
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <span className="text-sidebar-primary-foreground font-bold text-sm">FA</span>
              </div>
              <span className="text-lg font-bold text-sidebar-foreground">FaceAttend</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center mx-auto">
              <span className="text-sidebar-primary-foreground font-bold text-sm">FA</span>
            </div>
          )}
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel>Main</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClass}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Attendance */}
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel>Attendance</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {attendanceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
