import { Bell, User, LogOut, ChevronRight } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';

/** Human-readable titles keyed by route path. */
const ROUTE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/students': 'Students',
  '/register': 'Register Student',
  '/groups': 'Groups',
  '/attendance/live': 'Live Attendance',
  '/attendance/upload': 'Upload Photo',
  '/attendance/logs': 'Attendance Logs',
  '/camera-events': 'Camera Events',
  '/recognition-metrics': 'Recognition Metrics',
  '/system-health': 'System Health',
  '/settings': 'Settings',
};

const SECTION_FOR_PATH: Record<string, string> = {
  '/attendance/live': 'Attendance',
  '/attendance/upload': 'Attendance',
  '/attendance/logs': 'Attendance',
  '/camera-events': 'Insights',
  '/recognition-metrics': 'Insights',
  '/system-health': 'Insights',
};

export function AppHeader() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const title = ROUTE_TITLES[pathname] ?? 'FaceLogBook';
  const section = SECTION_FOR_PATH[pathname];

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        {/* Breadcrumb / page context */}
        <nav className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex" aria-label="Breadcrumb">
          <Link to="/" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
            Home
          </Link>
          {section && (
            <>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              <span className="shrink-0 text-muted-foreground">{section}</span>
            </>
          )}
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <span className="truncate font-medium text-foreground">{title}</span>
        </nav>
        <span className="truncate text-sm font-semibold text-foreground sm:hidden">{title}</span>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
        </Button>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-2 hover:bg-secondary">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                  {user?.username?.[0]?.toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground md:inline">
                {user?.username || 'Admin'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="font-medium">{user?.username}</span>
                {user?.email && <span className="text-xs font-normal text-muted-foreground">{user.email}</span>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
