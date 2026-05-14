import { Outlet, useParams, useLocation, Link } from 'react-router-dom';
import { Layers, LayoutDashboard, MessageSquare, Bot } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ChatPanel } from '@/pages/messages/ChatPanel';

const navItems = [
  { icon: LayoutDashboard, label: 'Projects', href: '/' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
  { icon: Bot, label: 'Replicants', href: '/bobs' },
] as const;

function isNavActive(pathname: string, href: string): boolean {
  if (href === '/messages') return pathname.startsWith('/messages');
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MessagesLayout() {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const location = useLocation();

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Col 1: icon-only nav sidebar */}
        <aside className="w-[60px] h-screen bg-sidebar border-r border-sidebar-border flex flex-col items-center py-4 gap-2 shrink-0">
          {/* Logo */}
          <Link
            to="/"
            className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground mb-1"
            aria-label="Home"
          >
            <Layers className="size-4" />
          </Link>

          <Separator className="w-8" />

          {/* Nav icons */}
          {navItems.map(({ icon: Icon, label, href }) => {
            const active = isNavActive(location.pathname, href);
            return (
              <Tooltip key={href}>
                <TooltipTrigger
                  className={cn(
                    'size-11 rounded-lg flex items-center justify-center transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                  )}
                  aria-label={label}
                  onClick={() => window.location.href = href}
                >
                  <Icon className="size-5" />
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </aside>

        {/* Col 2: context panel (agent list or session list via Outlet) */}
        <div className="w-60 h-screen border-r border-sidebar-border bg-sidebar flex flex-col shrink-0">
          <Outlet />
        </div>

        {/* Col 3: chat panel or empty state */}
        <div className="flex-1 h-screen flex flex-col overflow-hidden bg-background">
          {sessionId ? (
            <ChatPanel />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Select a session to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
