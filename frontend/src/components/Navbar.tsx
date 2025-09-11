import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
  Menu, 
  X, 
  Users, 
  Camera, 
  Upload, 
  FileText, 
  UserPlus, 
  Home,
  Fingerprint
} from 'lucide-react';
import { cn } from '@/lib/utils';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { title: 'Dashboard', href: '/', icon: Home },
    { title: 'Register', href: '/admin/register', icon: UserPlus },
    { title: 'Students', href: '/admin/students', icon: Users },
    { title: 'Live Capture', href: '/attendance/live', icon: Camera },
    { title: 'Upload', href: '/attendance/upload', icon: Upload },
    { title: 'Logs', href: '/attendance/logs', icon: FileText },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className={cn(
      "sticky top-0 z-50 w-full transition-all duration-300",
      isScrolled 
        ? "bg-background/95 backdrop-blur-md shadow-lg border-b" 
        : "bg-background border-b"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 group">
            <div className="p-2 rounded-lg bg-gradient-primary group-hover:scale-110 transition-transform">
              <Fingerprint className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-xl text-foreground hidden sm:block">
              FaceAttend
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    active 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </div>

          {/* Admin Badge */}
          <div className="hidden md:flex items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
              Admin Mode
            </div>
          </div>

          {/* Mobile Menu Button */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button 
                variant="ghost" 
                size="icon"
                className="relative"
              >
                <span className="sr-only">Open menu</span>
                <div className="relative w-6 h-6">
                  <Menu 
                    className={cn(
                      "h-6 w-6 absolute transition-all",
                      isOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100"
                    )} 
                  />
                  <X 
                    className={cn(
                      "h-6 w-6 absolute transition-all",
                      isOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
                    )} 
                  />
                </div>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col h-full">
                {/* Mobile Header */}
                <div className="flex items-center gap-2 pb-6 border-b">
                  <div className="p-2 rounded-lg bg-gradient-primary">
                    <Fingerprint className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">FaceAttend</h2>
                    <p className="text-xs text-muted-foreground">Attendance System</p>
                  </div>
                </div>

                {/* Mobile Navigation */}
                <nav className="flex-1 py-6">
                  <div className="space-y-1">
                    {navItems.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                            active 
                              ? "bg-primary text-primary-foreground shadow-md" 
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-medium">{item.title}</span>
                          {active && (
                            <div className="ml-auto w-1 h-6 bg-primary-foreground rounded-full" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </nav>

                {/* Mobile Footer */}
                <div className="pt-6 border-t">
                  <div className="px-4 py-2 rounded-lg bg-success/10 text-success text-sm font-medium text-center">
                    Admin Mode Active
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;