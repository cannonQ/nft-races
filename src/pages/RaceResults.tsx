import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RaceHeader } from '@/components/races/RaceHeader';
import { Podium } from '@/components/races/Podium';
import { ResultsTable } from '@/components/races/ResultsTable';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRaceResults } from '@/api';

export default function RaceResults() {
  const { raceId } = useParams<{ raceId: string }>();
  const { data: results, loading, error } = useRaceResults(raceId || null);

  if (loading) {
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (error || !results) {
    return (
      <MainLayout>
        <div className="max-w-6xl mx-auto">
          <div className="cyber-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground mb-4">Race not found</p>
            <Button asChild variant="outline">
              <Link to="/leaderboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Leaderboard
              </Link>
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Button */}
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Link to="/leaderboard">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leaderboard
          </Link>
        </Button>

        {/* Race Header */}
        <RaceHeader race={results.race} />

        {/* Podium */}
        <div className="cyber-card rounded-xl p-4">
          <Podium results={results.entries} />
        </div>

        {/* Full Results Table */}
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground mb-4">
            Full Results
          </h2>
          <ResultsTable results={results.entries} raceType={results.race.raceType} blockHash={results.race.blockHash} />
        </div>
      </div>
    </MainLayout>
  );
}
