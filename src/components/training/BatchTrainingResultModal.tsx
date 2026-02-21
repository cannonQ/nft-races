import { CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { BatchTrainResponse, CreatureWithStats, TrainResponse, StatType } from '@/types/game';
import { cn } from '@/lib/utils';

const EXPLORER_TX_URL = 'https://ergexplorer.com/transactions#';

const statLabels: Record<StatType, string> = {
  speed: 'SPD',
  stamina: 'STA',
  accel: 'ACC',
  agility: 'AGI',
  heart: 'HRT',
  focus: 'FDC',
};

interface BatchTrainingResultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: BatchTrainResponse | null;
  creatures: CreatureWithStats[];
  txId?: string | null;
  feeTokenName?: string;
  feeTokenAmount?: number;
  feeErg?: number;
}

export function BatchTrainingResultModal({
  open,
  onOpenChange,
  result,
  creatures,
  txId,
  feeTokenName,
  feeTokenAmount,
  feeErg,
}: BatchTrainingResultModalProps) {
  if (!result) return null;

  const successCount = result.results?.length ?? 0;
  const errorCount = result.errors?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {errorCount === 0 ? (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Batch Training Complete
              </>
            ) : (
              <>
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Batch Training — {successCount} of {successCount + errorCount} Succeeded
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* TX confirmation */}
        {txId && (
          <div className="flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-emerald-300">
              Payment confirmed
              {feeTokenName && feeTokenAmount != null
                ? ` — ${feeTokenAmount} ${feeTokenName}`
                : feeErg
                  ? ` — ${feeErg} ERG`
                  : ''}
            </span>
            <a
              href={`${EXPLORER_TX_URL}${txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-primary hover:text-primary/80"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Success results */}
        {result.results && result.results.length > 0 && (
          <div className="space-y-2">
            {result.results.map(({ creatureId, result: trainResult }) => {
              const creature = creatures.find((c) => c.id === creatureId);
              const r = trainResult as TrainResponse;
              return (
                <div
                  key={creatureId}
                  className="cyber-card rounded-lg p-3 border border-emerald-500/20"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {creature?.name || creatureId.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {r.actionsRemaining} action{r.actionsRemaining !== 1 ? 's' : ''} left
                    </span>
                  </div>
                  {/* Stat changes */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                    {Object.entries(r.statChanges || {}).map(([stat, change]) => {
                      const val = change as number;
                      if (!val || val === 0) return null;
                      return (
                        <span key={stat} className="text-emerald-400">
                          {statLabels[stat as StatType] || stat} +{val.toFixed(2)}
                        </span>
                      );
                    })}
                  </div>
                  {/* Condition */}
                  <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                    <span>
                      Fatigue: <span className={cn(r.fatigue > 60 ? 'text-destructive' : 'text-foreground')}>{r.fatigue.toFixed(1)}%</span>
                    </span>
                    <span>
                      Sharp: <span className="text-primary">{r.sharpness.toFixed(1)}%</span>
                    </span>
                    {r.boostUsed && (
                      <span className="text-amber-400">
                        Boosted +{Math.round(r.totalBoostMultiplier * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Error results */}
        {result.errors && result.errors.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-destructive font-medium">Failed:</p>
            {result.errors.map(({ creatureId, error }) => {
              const creature = creatures.find((c) => c.id === creatureId);
              return (
                <div
                  key={creatureId}
                  className="cyber-card rounded-lg p-3 border border-destructive/20"
                >
                  <span className="text-sm font-medium text-foreground">
                    {creature?.name || creatureId.slice(0, 8)}
                  </span>
                  <p className="text-xs text-destructive mt-0.5">{error}</p>
                </div>
              );
            })}
          </div>
        )}

        <Button onClick={() => onOpenChange(false)} className="w-full mt-2">
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}
