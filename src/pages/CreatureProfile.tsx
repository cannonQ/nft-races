import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreatureHeader } from '@/components/creatures/CreatureHeader';
import { StatsRadarChart } from '@/components/creatures/StatsRadarChart';
import { ConditionGauges } from '@/components/creatures/ConditionGauges';
import { RaceHistory } from '@/components/creatures/RaceHistory';
import { TrainingLog } from '@/components/creatures/TrainingLog';
import { useCreature, useTrainingLog } from '@/api';
import { StatBlock, StatType } from '@/types/game';

export default function CreatureProfile() {
  const { creatureId } = useParams<{ creatureId: string }>();
  
  const { data: creature, loading: creatureLoading } = useCreature(creatureId || null);
  const { data: trainingLogs, loading: logsLoading } = useTrainingLog(creatureId || null);

  if (creatureLoading) {
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-40 rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!creature) {
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto">
          <div className="cyber-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground mb-4">Creature not found</p>
            <Button asChild variant="outline">
              <Link to="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Stable
              </Link>
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Mock race history for now
  const raceHistory = [
    { raceId: 'race_past_001', raceName: 'Neon Thunder Sprint', date: '2026-02-05', position: 3, payout: 400 },
    { raceId: 'race_past_002', raceName: 'Endurance Marathon', date: '2026-02-02', position: 5, payout: 0 },
  ];

  // Convert training logs for TrainingLog component
  const formattedLogs = (trainingLogs || []).map(log => ({
    id: log.id,
    activityName: log.activityName,
    activityIcon: log.activityIcon,
    primaryStat: log.primaryStat,
    gain: Object.values(log.statChanges)[0] || 0,
    date: log.createdAt,
  }));

  // Calculate total stats
  const totalStats: StatBlock = {
    speed: creature.baseStats.speed + creature.trainedStats.speed,
    stamina: creature.baseStats.stamina + creature.trainedStats.stamina,
    accel: creature.baseStats.accel + creature.trainedStats.accel,
    agility: creature.baseStats.agility + creature.trainedStats.agility,
    heart: creature.baseStats.heart + creature.trainedStats.heart,
    focus: creature.baseStats.focus + creature.trainedStats.focus,
  };

  const baseTotal = Object.values(creature.baseStats).reduce((a, b) => a + b, 0);
  const trainedTotal = Object.values(creature.trainedStats).reduce((a, b) => a + b, 0);

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <CreatureHeader creature={creature} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="cyber-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Stats Overview
              </h2>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-muted" />
                  <span className="text-muted-foreground font-mono">{baseTotal}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-primary/50" />
                  <span className="text-primary font-mono">+{trainedTotal}</span>
                </div>
              </div>
            </div>
            <StatsRadarChart 
              baseStats={creature.baseStats} 
              trainedStats={creature.trainedStats} 
            />
          </div>

          <div className="space-y-4">
            <ConditionGauges fatigue={creature.fatigue} sharpness={creature.sharpness} />
            
            <div className="cyber-card rounded-xl p-4">
              <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
                Stat Breakdown
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {(Object.keys(creature.baseStats) as Array<keyof StatBlock>).map((stat) => (
                  <div key={stat} className="text-center p-2 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      {stat.slice(0, 3)}
                    </p>
                    <p className="font-mono text-lg font-bold text-foreground">
                      {totalStats[stat]}
                    </p>
                    <p className="text-[10px] text-primary font-mono">
                      +{creature.trainedStats[stat]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">
              Race History
            </h2>
            <RaceHistory history={raceHistory} />
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-foreground mb-4">
              Training Log
            </h2>
            <TrainingLog logs={formattedLogs} />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
