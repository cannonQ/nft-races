import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Plus, Trophy, RefreshCw } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { API_BASE } from '@/api/config';

const RACE_TYPES = ['sprint', 'distance', 'technical', 'mixed', 'hazard'] as const;

export default function Admin() {
  const [secret, setSecret] = useState<string>(
    () => sessionStorage.getItem('admin-secret') || ''
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();

  // Data
  const [races, setRaces] = useState<any[]>([]);
  const [season, setSeason] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Create Race form
  const [raceName, setRaceName] = useState('');
  const [raceType, setRaceType] = useState<string>('sprint');
  const [deadlineMinutes, setDeadlineMinutes] = useState(60);
  const [maxEntries, setMaxEntries] = useState(8);
  const [creating, setCreating] = useState(false);

  // Resolving state
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const adminFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`,
        ...(options.headers || {}),
      },
    });
    if (res.status === 401) {
      setAuthError('Invalid admin secret');
      setAuthenticated(false);
      sessionStorage.removeItem('admin-secret');
      throw new Error('Unauthorized');
    }
    return res;
  }, [secret]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [racesRes, seasonRes] = await Promise.all([
        fetch(`${API_BASE}/races`),
        fetch(`${API_BASE}/seasons/current`),
      ]);
      if (racesRes.ok) {
        const data = await racesRes.json();
        setRaces(Array.isArray(data) ? data : []);
      }
      if (seasonRes.ok) {
        setSeason(await seasonRes.json());
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) loadData();
  }, [authenticated, loadData]);

  useEffect(() => {
    if (secret) setAuthenticated(true);
  }, []);

  const authenticate = () => {
    if (!secretInput.trim()) return;
    sessionStorage.setItem('admin-secret', secretInput);
    setSecret(secretInput);
    setAuthenticated(true);
    setAuthError(null);
  };

  const handleCreateRace = async () => {
    if (!raceName.trim()) return;
    setCreating(true);
    const deadline = new Date(Date.now() + deadlineMinutes * 60 * 1000).toISOString();

    try {
      const res = await adminFetch(`${API_BASE}/admin/races/create`, {
        method: 'POST',
        body: JSON.stringify({
          name: raceName,
          raceType,
          entryDeadline: deadline,
          maxEntries,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create race');
      toast({ title: 'Race Created', description: `${data.race.name}` });
      setRaceName('');
      loadData();
    } catch (err) {
      if ((err as Error).message !== 'Unauthorized') {
        toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
      }
    } finally {
      setCreating(false);
    }
  };

  const handleResolveRace = async (raceId: string) => {
    setResolvingId(raceId);
    try {
      const res = await adminFetch(`${API_BASE}/admin/races/resolve`, {
        method: 'POST',
        body: JSON.stringify({ raceId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve race');

      const resultCount = data.results?.length || 0;
      const cancelled = data.cancelled;
      toast({
        title: cancelled ? 'Race Cancelled' : 'Race Resolved',
        description: cancelled
          ? `Reason: ${data.reason}`
          : `${resultCount} entries scored`,
      });
      loadData();
    } catch (err) {
      if ((err as Error).message !== 'Unauthorized') {
        toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
      }
    } finally {
      setResolvingId(null);
    }
  };

  // Login screen
  if (!authenticated) {
    return (
      <MainLayout>
        <div className="max-w-md mx-auto mt-20">
          <Card className="cyber-card">
            <CardHeader>
              <CardTitle className="font-display text-xl">Admin Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {authError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  {authError}
                </div>
              )}
              <input
                type="password"
                placeholder="Enter admin secret"
                value={secretInput}
                onChange={e => setSecretInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && authenticate()}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <Button onClick={authenticate} className="w-full glow-cyan">
                Authenticate
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const openRaces = races.filter(r => r.status === 'open');
  const resolvedRaces = races.filter(r => r.status === 'resolved' || r.status === 'locked').slice(0, 10);

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Admin Dashboard
          </h1>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Season Info */}
        {season && (
          <Card className="cyber-card">
            <CardHeader>
              <CardTitle className="font-display text-lg">Active Season</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-foreground font-semibold">{season.name}</p>
                  <p className="text-muted-foreground text-sm">
                    Season {season.seasonNumber}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>{season.collectionName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Race */}
        <Card className="cyber-card">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Race
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Race Name</label>
                <input
                  type="text"
                  value={raceName}
                  onChange={e => setRaceName(e.target.value)}
                  placeholder="e.g. Sprint Showdown #1"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Race Type</label>
                <select
                  value={raceType}
                  onChange={e => setRaceType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {RACE_TYPES.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Deadline (minutes from now)</label>
                <input
                  type="number"
                  value={deadlineMinutes}
                  onChange={e => setDeadlineMinutes(Number(e.target.value))}
                  min={1}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Max Entries</label>
                <input
                  type="number"
                  value={maxEntries}
                  onChange={e => setMaxEntries(Number(e.target.value))}
                  min={2}
                  max={20}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <Button
              onClick={handleCreateRace}
              disabled={creating || !raceName.trim()}
              className="glow-cyan"
            >
              {creating ? 'Creating...' : 'Create Race'}
            </Button>
          </CardContent>
        </Card>

        {/* Open Races */}
        <Card className="cyber-card">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Open Races ({openRaces.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {openRaces.length === 0 ? (
              <p className="text-muted-foreground text-sm">No open races.</p>
            ) : (
              <div className="space-y-2">
                {openRaces.map(race => (
                  <div
                    key={race.id}
                    className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div>
                      <span className="text-foreground font-semibold">{race.name}</span>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        <span className="uppercase">{race.raceType}</span>
                        <span>{race.entryCount}/{race.maxEntries} entries</span>
                        <span>Deadline: {new Date(race.entryDeadline).toLocaleString()}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveRace(race.id)}
                      disabled={resolvingId === race.id}
                    >
                      {resolvingId === race.id ? 'Resolving...' : 'Resolve'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resolved Races */}
        {resolvedRaces.length > 0 && (
          <Card className="cyber-card">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-race-sprint" />
                Recent Results ({resolvedRaces.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {resolvedRaces.map(race => (
                  <div
                    key={race.id}
                    className="flex items-center justify-between py-2 px-4 rounded-lg bg-muted/20"
                  >
                    <span className="text-foreground">{race.name}</span>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="uppercase">{race.raceType}</span>
                      <span>{race.entryCount} entries</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
