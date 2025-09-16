import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { Toaster } from '@/components/ui/toaster';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen bg-muted/20 antialiased">
      <Navbar />
      <main className="w-full">
        {/* Adds consistent padding and a max-width to all pages */}
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  );
};

export default Layout;