import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { useCreaturesByWallet, useCollections } from '@/api';
import { useWallet } from '@/context/WalletContext';
import { useCollectionFilter } from '@/hooks/useCollectionFilter';
import { CreatureCard } from '@/components/creatures/CreatureCard';
import { InvestmentSummary } from '@/components/dashboard/InvestmentSummary';
import { SeasonEarnings } from '@/components/dashboard/SeasonEarnings';
import { CollectionFilter } from '@/components/ui/CollectionFilter';
import { MainLayout } from '@/components/layout/MainLayout';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { address } = useWallet();
  const { data: creatures, loading } = useCreaturesByWallet(address);
  const { data: collections } = useCollections();
  const { active: activeCollections, toggle: toggleCollection, matches: matchesCollection } = useCollectionFilter();

  const filteredCreatures = useMemo(
    () => (creatures || []).filter(c => matchesCollection(c.collectionId)),
    [creatures, matchesCollection]
  );

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

        <CollectionFilter
          collections={collections || []}
          active={activeCollections}
          onToggle={toggleCollection}
          className="mb-4"
        />

        <InvestmentSummary />
        <SeasonEarnings />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : !creatures || creatures.length === 0 ? (
          <div className="cyber-card rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-primary" />
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">
              No NFTs Found
            </h2>
            <p className="text-muted-foreground max-w-md">
              Supported NFTs in your wallet are detected automatically.
              Make sure your wallet contains NFTs from a supported collection.
            </p>
          </div>
        ) : filteredCreatures.length === 0 ? (
          <div className="cyber-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground">
              No creatures match the selected filter. Try selecting a different collection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCreatures.map((creature, index) => (
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
