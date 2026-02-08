import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, Flag, Trophy } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/train', label: 'Train', icon: Dumbbell },
  { path: '/races', label: 'Races', icon: Flag },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
];

export function Navigation() {
  const isMobile = useIsMobile();
  const location = useLocation();

  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              location.pathname.startsWith(item.path + '/');
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all duration-200',
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn(
                  'relative p-2 rounded-lg transition-all duration-200',
                  isActive && 'bg-primary/10'
                )}>
                  <item.icon className={cn(
                    'w-5 h-5 transition-all duration-200',
                    isActive && 'drop-shadow-[0_0_8px_hsl(var(--primary))]'
                  )} />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    );
  }

  // Desktop side nav
  return (
    <nav className="fixed left-0 top-0 bottom-0 w-20 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-6 z-50">
      <div className="mb-8">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <span className="font-display text-primary text-lg font-bold">NR</span>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            location.pathname.startsWith(item.path + '/');
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'group relative flex flex-col items-center gap-1 px-3 py-3 rounded-lg transition-all duration-200',
                isActive 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <item.icon className={cn(
                'w-5 h-5 transition-all duration-200',
                isActive && 'drop-shadow-[0_0_8px_hsl(var(--primary))]'
              )} />
              <span className="text-[10px] font-medium">{item.label}</span>
              
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 rounded-r-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
              )}
              
              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 rounded bg-popover text-popover-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                {item.label}
              </div>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
