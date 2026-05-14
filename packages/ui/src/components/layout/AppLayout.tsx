import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-muted/20">
        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Header onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="flex min-h-0 flex-1 flex-col overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
