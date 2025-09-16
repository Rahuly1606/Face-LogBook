import React from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Menu, Camera, Group, Home, LogIn, LogOut, User, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

const navItems = [
  { title: 'Dashboard', href: '/admin-dashboard', icon: Home },
  { title: 'Groups', href: '/groups', icon: Group },
];

const Navbar: React.FC = () => {
  const [isMobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useApp();

  React.useEffect(() => {
    // Close mobile menu on route change
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const NavLinks: React.FC<{ isMobile?: boolean }> = ({ isMobile = false }) => (
    <nav className={cn(
      "flex items-center gap-2",
      isMobile ? "flex-col items-stretch gap-3 w-full" : "gap-1"
    )}>
      {navItems.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          className={({ isActive }) => cn(
            "flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ease-in-out",
            isActive
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            isMobile && "w-full text-base py-3"
          )}
        >
          <item.icon className="h-5 w-5" />
          <span>{item.title}</span>
        </NavLink>
      ))}
    </nav>
  );
  
  const UserMenu: React.FC = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-11 w-11 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">
          <Avatar className="h-11 w-11 border-2 border-primary/60">
            <AvatarImage src="/avatar-placeholder.png" alt="Admin" />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              A
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Administrator</p>
            <p className="text-xs leading-none text-muted-foreground">
              admin@faceattend.com
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link to="/profile" className="flex items-center gap-2">
            <UserCog className="h-4 w-4 text-muted-foreground" />
            <span>Manage Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-500 focus:bg-red-500/10 focus:text-red-600 cursor-pointer flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">

          <Link to="/" className="flex items-center space-x-3 group">
            <div className="p-2.5 rounded-xl bg-primary shadow-md group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-primary/50 transition-transform duration-200">
              <Camera className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="font-bold text-2xl text-foreground tracking-tight hidden sm:block">
              FaceAttend
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <NavLinks />
          </div>

          <div className="hidden md:flex items-center gap-4">
             {isAuthenticated ? <UserMenu /> : (
              <Button onClick={() => navigate('/login')} className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                <span>Login</span>
              </Button>
            )}
          </div>
          
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open main menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] flex flex-col p-6">
                <div className="flex items-center gap-3 pb-6 border-b mb-6">
                  <div className="p-2 rounded-lg bg-primary">
                    <Camera className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h2 className="text-xl font-bold">FaceAttend</h2>
                </div>
                <div className="flex-1">
                  <NavLinks isMobile />
                </div>
                <div className="pt-6 border-t">
                  {isAuthenticated ? (
                     <Button variant="outline" className="w-full justify-center gap-2" onClick={handleLogout}>
                       <LogOut className="h-4 w-4" />
                       <span>Logout</span>
                     </Button>
                  ) : (
                    <Button className="w-full justify-center gap-2" onClick={() => navigate('/login')}>
                      <LogIn className="h-4 w-4" />
                      <span>Login</span>
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

        </div>
      </div>
    </header>
  );
};

export default Navbar;