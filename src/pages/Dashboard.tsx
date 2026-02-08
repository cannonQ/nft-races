import { Plus } from 'lucide-react';
import { useCreaturesByWallet } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { CreatureCard } from '@/components/creatures/CreatureCard';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { address } = useWallet();
  const { data: creatures, loading } = useCreaturesByWallet(address);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Your Creatures
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {creatures?.length || 0} creature{(creatures?.length || 0) !== 1 ? 's' : ''} registered
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : !creatures || creatures.length === 0 ? (
          <div className="cyber-card rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Plus className="w-10 h-10 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">
              No Creatures Yet
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Register your NFT creature to start training and competing in races.
            </p>
            <Button className="glow-cyan">
              <Plus className="w-4 h-4 mr-2" />
              Register Your NFT
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {creatures.map((creature, index) => (
              <CreatureCard
                key={creature.id}
                creature={creature}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` } as React.CSSProperties}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
