import { ReactNode } from 'react';
import { Navigation } from './Navigation';
import { WalletConnect } from './WalletConnect';
import { SeasonBanner } from './SeasonBanner';
import { useIsMobile } from '@/hooks/use-mobile';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Main content area */}
      <div className={isMobile ? 'pb-24' : 'pl-20'}>
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            <div className="flex-1">
              <SeasonBanner />
            </div>
            <div className="ml-4">
              <WalletConnect />
            </div>
          </div>
        </header>
        
        {/* Page content */}
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
