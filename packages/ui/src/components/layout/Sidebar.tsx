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

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <div
      className={cn(
        'h-full bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 text-sidebar-foreground overflow-hidden',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-[60px] items-center' : 'w-52',
      )}
    >
      {/* Logo row */}
      <div className={cn('flex items-center py-3 gap-2', collapsed ? 'justify-center px-0' : 'px-3')}>
        <Link
          to="/"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2.5 font-semibold tracking-tight min-w-0',
            collapsed ? 'flex-none' : 'flex-1',
          )}
          aria-label="Home"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Layers className="size-4" />
          </div>
          <div
            className={cn(
              'min-w-0 transition-[opacity,width] duration-200',
              collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100',
            )}
          >
            <p className="text-sm text-muted-foreground whitespace-nowrap">Workspace</p>
            <p className="truncate text-base">Scut</p>
          </div>
        </Link>
        {!collapsed && (
          <button
            type="button"
            aria-label="Collapse sidebar"
            onClick={toggleSidebar}
            className="shrink-0 flex size-8 items-center justify-center rounded-lg transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <PanelLeftClose className="size-4 shrink-0" />
          </button>
        )}
      </div>

      <Separator className={collapsed ? 'w-8' : 'w-full'} />

      {/* Nav items */}
      <ScrollArea className="flex min-h-0 flex-1 flex-col w-full">
        <div className={cn('py-3 flex flex-col', collapsed ? 'items-center gap-1 px-0' : 'space-y-0.5 px-2')}>
          {primaryNav.map(({ icon: Icon, label, href }) => {
            const active = isPathActive(location.pathname, href);
            const itemClass = cn(
              'flex items-center rounded-lg transition-colors',
              active
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              collapsed ? 'size-11 justify-center' : 'min-h-10 gap-2.5 px-2.5 py-2 w-full',
            );

            if (collapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger className={itemClass} aria-label={label} onClick={() => navigate(href)}>
                    <Icon className="size-4 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Link key={href} to={href} onClick={onNavigate} className={itemClass}>
                <Icon className="size-4 shrink-0" />
                <span className="text-sm">{label}</span>
              </Link>
            );
          })}
        </div>
      </ScrollArea>

      {/* Expand button (collapsed mode only) */}
      {collapsed && (
        <Tooltip>
          <TooltipTrigger
            className="size-11 mb-2 rounded-lg flex items-center justify-center transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            aria-label="Expand sidebar"
            onClick={toggleSidebar}
          >
            <PanelLeftOpen className="size-4 shrink-0" />
          </TooltipTrigger>
          <TooltipContent side="right">Expand sidebar</TooltipContent>
        </Tooltip>
      )}
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
      <aside className="hidden md:flex h-screen">
        <SidebarContent collapsed={collapsed} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose()}>
        <SheetContent className="w-80 p-0" side="left" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation menu</SheetTitle>
            <SheetDescription>Browse projects and replicants.</SheetDescription>
          </SheetHeader>
          <SidebarContent collapsed={false} onNavigate={onMobileClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
