import { LayoutDashboard, Bot, Layers, MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUiStore } from '@/stores/ui';

const primaryNav = [
  { label: 'Projects', href: '/', icon: LayoutDashboard },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Replicants', href: '/bobs', icon: Bot },
] as const;

function isPathActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CollapsedSidebarContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <div className="w-[60px] h-screen bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3 gap-1 shrink-0">
      {/* Logo icon */}
      <Link
        to="/"
        className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground mb-1"
        aria-label="Home"
      >
        <Layers className="size-4" />
      </Link>

      <Separator className="w-8" />

      {/* Nav icons */}
      <div className="flex flex-col items-center gap-1 flex-1 pt-1">
        {primaryNav.map(({ icon: Icon, label, href }) => {
          const active = isPathActive(location.pathname, href);
          return (
            <Tooltip key={href}>
              <TooltipTrigger
                className={cn(
                  'size-11 rounded-lg flex items-center justify-center transition-colors',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
                aria-label={label}
                onClick={() => navigate(href)}
              >
                <Icon className="size-4 shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Expand button */}
      <Tooltip>
        <TooltipTrigger
          className="size-11 rounded-lg flex items-center justify-center transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Expand sidebar"
          onClick={toggleSidebar}
        >
          <PanelLeftOpen className="size-4 shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="right">Expand sidebar</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ExpandedSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <div className="w-52 h-full bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 text-sidebar-foreground">
      {/* Logo row */}
      <div className="px-3 py-3 flex items-center gap-2">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 font-semibold tracking-tight min-w-0 flex-1"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Layers className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Workspace</p>
            <p className="truncate text-base">Scut</p>
          </div>
        </Link>
        {/* Collapse button */}
        <button
          type="button"
          aria-label="Collapse sidebar"
          onClick={toggleSidebar}
          className="shrink-0 flex size-8 items-center justify-center rounded-lg transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <PanelLeftClose className="size-4 shrink-0" />
        </button>
      </div>

      <Separator />

      <ScrollArea className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-0.5 px-2 py-3">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={cn(
                'flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                isPathActive(location.pathname, item.href)
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <item.icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  return (
    <>
      <aside className="hidden md:flex">
        {collapsed ? <CollapsedSidebarContent /> : <ExpandedSidebarContent />}
      </aside>
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose()}>
        <SheetContent className="w-80 p-0" side="left" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation menu</SheetTitle>
            <SheetDescription>Browse projects and replicants.</SheetDescription>
          </SheetHeader>
          <ExpandedSidebarContent onNavigate={onMobileClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
