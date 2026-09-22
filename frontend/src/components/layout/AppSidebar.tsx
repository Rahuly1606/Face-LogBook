import {
  LayoutDashboard,
  Users,
  UserPlus,
  FolderKanban,
  Video,
  Upload,
  History,
  Settings,
  ScanFace,
  Cctv,
  Gauge,
  Activity,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  soon?: boolean;
};

const mainItems: NavItem[] = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, end: true },
  { title: 'Students', url: '/students', icon: Users },
  { title: 'Register Student', url: '/register', icon: UserPlus },
  { title: 'Groups', url: '/groups', icon: FolderKanban },
];

const attendanceItems: NavItem[] = [
  { title: 'Live Attendance', url: '/attendance/live', icon: Video },
  { title: 'Upload Photo', url: '/attendance/upload', icon: Upload },
  { title: 'Attendance Logs', url: '/attendance/logs', icon: History },
];

const insightsItems: NavItem[] = [
  { title: 'Camera Events', url: '/camera-events', icon: Cctv, soon: true },
  { title: 'Recognition Metrics', url: '/recognition-metrics', icon: Gauge, soon: true },
  { title: 'System Health', url: '/system-health', icon: Activity, soon: true },
];

const adminItems: NavItem[] = [
  { title: 'Settings', url: '/settings', icon: Settings },
];

function NavSection({ label, items }: { label: string; items: NavItem[] }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'relative w-full rounded-lg transition-colors',
      isActive
        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-sidebar-primary'
        : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
    );

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/45 text-[11px] font-semibold uppercase tracking-wider">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild tooltip={item.title}>
                <NavLink to={item.url} end={item.end} className={linkClass}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{item.title}</span>
                  {item.soon && (
                    <span className="ml-auto rounded-full bg-sidebar-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sidebar-primary group-data-[collapsible=icon]:hidden">
                      Soon
                    </span>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary shadow-glow">
          <ScanFace className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-sidebar-foreground">FaceLogBook</p>
            <p className="truncate text-[11px] leading-tight text-sidebar-foreground/45">Attendance Platform</p>
          </div>
        )}
      </div>

      <SidebarContent className="gap-0 px-2 py-2">
        <NavSection label="Main" items={mainItems} />
        <NavSection label="Attendance" items={attendanceItems} />
        <NavSection label="Insights" items={insightsItems} />
        <NavSection label="Admin" items={adminItems} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!isCollapsed ? (
          <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-[11px] font-medium text-sidebar-foreground/70">System operational</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
