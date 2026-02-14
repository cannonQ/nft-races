import { cn } from '@/lib/utils';
import { Collection } from '@/types/game';

interface CollectionFilterProps {
  collections: Collection[];
  active: Set<string>;
  onToggle: (collectionId: string) => void;
  className?: string;
}

export function CollectionFilter({ collections, active, onToggle, className }: CollectionFilterProps) {
  // Don't render if only one collection
  if (collections.length <= 1) return null;

  const allActive = active.size === 0;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mr-1">Filter:</span>
      <button
        onClick={() => {
          // If "All" is already active (active set is empty), do nothing
          // If filters are set, clear them to show all
          if (!allActive) {
            // Clear all filters by toggling each active one off
            active.forEach(id => onToggle(id));
          }
        }}
        className={cn(
          'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 border',
          allActive
            ? 'bg-primary/20 text-primary border-primary/50'
            : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/30'
        )}
      >
        All
      </button>
      {collections.map((col) => {
        const isActive = active.has(col.id);
        return (
          <button
            key={col.id}
            onClick={() => onToggle(col.id)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 border',
              isActive
                ? 'bg-primary/20 text-primary border-primary/50'
                : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/30'
            )}
          >
            {col.name}
          </button>
        );
      })}
    </div>
  );
}
