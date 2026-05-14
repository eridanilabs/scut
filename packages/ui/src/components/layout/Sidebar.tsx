import { LayoutDashboard, Bot, Layers } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const primaryNav = [
  { label: 'Projects', href: '/', icon: LayoutDashboard },
  { label: 'Replicants', href: '/bobs', icon: Bot },
] as const;

function isPathActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={href}
      onClick={onNavigate}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors',
        active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-4 py-5">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-3 font-semibold tracking-tight"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Layers className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Workspace</p>
            <p className="truncate text-base">Scut</p>
          </div>
        </Link>
      </div>

      <Separator />

      <ScrollArea className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-1 px-3 py-4">
          {primaryNav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isPathActive(location.pathname, item.href)}
              onNavigate={onNavigate}
            />
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
  return (
    <>
      <aside className="hidden h-screen w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarContent />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose()}>
        <SheetContent className="w-80 p-0" side="left" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation menu</SheetTitle>
            <SheetDescription>Browse projects and replicants.</SheetDescription>
          </SheetHeader>
          <SidebarContent onNavigate={onMobileClose} />
        </SheetContent>
      </Sheet>
    </>
  );
}
