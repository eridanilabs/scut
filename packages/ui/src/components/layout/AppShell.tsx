import { Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

function ConditionalHeader({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { pathname } = useLocation();
  if (pathname.startsWith('/messages')) return null;
  return <Header onOpenMobileNav={onOpenMobileNav} />;
}

function ConditionalMain({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isMessages = pathname.startsWith('/messages');
  return (
    <main className={isMessages
      ? 'flex min-h-0 flex-1 overflow-hidden'
      : 'flex min-h-0 flex-1 flex-col overflow-auto w-full'
    }>
      {children}
    </main>
  );
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-muted/20">
        <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ConditionalHeader onOpenMobileNav={() => setMobileNavOpen(true)} />
          <ConditionalMain>
            <Outlet />
          </ConditionalMain>
        </div>
      </div>
    </TooltipProvider>
  );
}
