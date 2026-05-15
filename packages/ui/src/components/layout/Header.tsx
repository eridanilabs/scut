import { Menu, Monitor, Moon, Sun } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { type ThemeMode, useThemeStore } from '@/stores/theme';

interface HeaderProps {
  onOpenMobileNav: () => void;
}

const themeModeOrder: ThemeMode[] = ['light', 'dark', 'system'];
const themeLabelMap: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };
const themeIconMap = { light: Sun, dark: Moon, system: Monitor } satisfies Record<ThemeMode, typeof Sun>;

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Projects';
  if (pathname === '/replicants') return 'Replicants';
  if (pathname.startsWith('/projects/')) return 'Moot';
  if (pathname.startsWith('/threads/')) return 'Thread';
  return 'Scut';
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const { pathname } = useLocation();
  const mode = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const currentIndex = themeModeOrder.indexOf(mode);
  const nextMode = themeModeOrder[(currentIndex + 1) % themeModeOrder.length] ?? 'system';
  const ThemeIcon = themeIconMap[mode];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:h-16 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          className="size-11 md:hidden"
          onClick={onOpenMobileNav}
          type="button"
          variant="ghost"
        >
          <Menu className="size-5" />
          <span className="sr-only">Open navigation menu</span>
        </Button>
        <Separator className="hidden h-6 md:block" orientation="vertical" />
        <p className="truncate text-base font-semibold sm:text-lg">
          {getPageTitle(pathname)}
        </p>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Tooltip>
          <TooltipTrigger
            className="inline-flex size-11 items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => setTheme(nextMode)}
            type="button"
          >
            <ThemeIcon className="size-4" />
            <span className="sr-only">{`Theme: ${themeLabelMap[mode]}. Switch to ${themeLabelMap[nextMode]}.`}</span>
          </TooltipTrigger>
          <TooltipContent>{`Switch to ${themeLabelMap[nextMode]}`}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
