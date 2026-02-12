import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Plus, Trophy, RefreshCw, Pencil, X, Save, RotateCcw, Ban, Calendar, Sparkles, Power } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { API_BASE } from '@/api/config';

const RACE_TYPES = ['sprint', 'distance', 'technical', 'mixed', 'hazard'] as const;

export default function Admin() {
  const [secret, setSecret] = useState<string>('');
  const [authenticated, setAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const { toast } = useToast();

  // Data
  const [races, setRaces] = useState<any[]>([]);
  const [season, setSeason] = useState<any>(null);
  const [allSeasons, setAllSeasons] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Create Season form
  const [seasonCollectionId, setSeasonCollectionId] = useState('');
  const [seasonName, setSeasonName] = useState('');
  const [seasonDuration, setSeasonDuration] = useState(30);
  const [seasonPrizePool, setSeasonPrizePool] = useState(0);
  const [seasonModifierTheme, setSeasonModifierTheme] = useState('standard');
  const [seasonModifierDesc, setSeasonModifierDesc] = useState('Standard season');
  const [creatingSeason, setCreatingSeason] = useState(false);

  // Edit Season state
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null);
  const [editSeasonName, setEditSeasonName] = useState('');
  const [editSeasonEndDate, setEditSeasonEndDate] = useState('');
  const [editSeasonPrizePool, setEditSeasonPrizePool] = useState(0);
  const [editSeasonTheme, setEditSeasonTheme] = useState('');
  const [editSeasonDesc, setEditSeasonDesc] = useState('');
  const [savingSeason, setSavingSeason] = useState(false);

  // End Season state
  const [confirmEndSeasonId, setConfirmEndSeasonId] = useState<string | null>(null);
  const [endingSeason, setEndingSeason] = useState(false);

  // Create Race form
  const [raceName, setRaceName] = useState('');
  const [raceType, setRaceType] = useState<string>('sprint');
  const [deadlineMinutes, setDeadlineMinutes] = useState(60);
  const [maxEntries, setMaxEntries] = useState(8);
  const [autoResolve, setAutoResolve] = useState(true);
  const [creating, setCreating] = useState(false);

  // Resolving state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [confirmResolveId, setConfirmResolveId] = useState<string | null>(null);

  // Reopen state
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  // Edit Race state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editMaxEntries, setEditMaxEntries] = useState(8);
  const [editAutoResolve, setEditAutoResolve] = useState(true);
  const [saving, setSaving] = useState(false);

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
      throw new Error('Unauthorized');
    }
    return res;
  }, [secret]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [racesRes, seasonRes, collectionsRes] = await Promise.all([
        fetch(`${API_BASE}/races`),
        fetch(`${API_BASE}/seasons/current`),
        fetch(`${API_BASE}/collections`),
      ]);
      if (racesRes.ok) {
        const data = await racesRes.json();
        setRaces(Array.isArray(data) ? data : []);
      }
      if (seasonRes.ok) {
        setSeason(await seasonRes.json());
      } else {
        setSeason(null);
      }
      if (collectionsRes.ok) {
        const cols = await collectionsRes.json();
        setCollections(Array.isArray(cols) ? cols : []);
        if (cols.length > 0 && !seasonCollectionId) {
          setSeasonCollectionId(cols[0].id);
        }
      }
    } catch (_err) {
      // silently fail — toast will show if needed
    } finally {
      setLoading(false);
    }
  }, [seasonCollectionId]);

  // Load all seasons (admin-only endpoint)
  const loadSeasons = useCallback(async () => {
    if (!secret) return;
    try {
      const res = await adminFetch(`${API_BASE}/admin/seasons`);
      if (res.ok) {
        const data = await res.json();
        setAllSeasons(Array.isArray(data) ? data : []);
      }
    } catch (_err) {
      // admin fetch failed — handled by adminFetch
    }
  }, [secret, adminFetch]);

  useEffect(() => {
    if (authenticated) {
      loadData();
      loadSeasons();
    }
  }, [authenticated, loadData, loadSeasons]);

  const authenticate = () => {
    if (!secretInput.trim()) return;
    setSecret(secretInput);
    setAuthenticated(true);
    setAuthError(null);
  };

  // --- Season handlers ---

  const handleCreateSeason = async () => {
    if (!seasonCollectionId) return;
    setCreatingSeason(true);
    try {
      const res = await adminFetch(`${API_BASE}/admin/seasons/start`, {
        method: 'POST',
        body: JSON.stringify({
          collectionId: seasonCollectionId,
          name: seasonName.trim() || undefined,
          durationDays: seasonDuration,
          prizePoolNanoerg: Math.round(seasonPrizePool * 1_000_000_000),
          modifier: { theme: seasonModifierTheme, description: seasonModifierDesc },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start season');
      toast({ title: 'Season Started', description: `${data.season.name} — ${data.season.creaturesInitialized} creatures initialized` });
      setSeasonName('');
      setSeasonPrizePool(0);
      loadData();
      loadSeasons();
    } catch (err) {
      if ((err as Error).message !== 'Unauthorized') {
        toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
      }
    } finally {
      setCreatingSeason(false);
    }
  };

  const startEditingSeason = (s: any) => {
    setEditingSeasonId(s.id);
    setEditSeasonName(s.name);
    setEditSeasonPrizePool(s.prizePool);
    setEditSeasonTheme(s.modifier?.theme ?? 'standard');
    setEditSeasonDesc(s.modifier?.description ?? '');
    const dl = new Date(s.endDate);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditSeasonEndDate(
      `${dl.getFullYear()}-${pad(dl.getMonth() + 1)}-${pad(dl.getDate())}T${pad(dl.getHours())}:${pad(dl.getMinutes())}`
    );
  };

  const handleSaveSeason = async () => {
    if (!editingSeasonId) return;
    setSavingSeason(true);
    try {
      const res = await adminFetch(`${API_BASE}/admin/seasons/update`, {
        method: 'POST',
        body: JSON.stringify({
          seasonId: editingSeasonId,
          name: editSeasonName,
          endDate: new Date(editSeasonEndDate).toISOString(),
          prizePoolNanoerg: Math.round(editSeasonPrizePool * 1_000_000_000),
          modifier: { theme: editSeasonTheme, description: editSeasonDesc },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update season');
      toast({ title: 'Season Updated', description: data.season.name });
      setEditingSeasonId(null);
      loadData();
      loadSeasons();
    } catch (err) {
      if ((err as Error).message !== 'Unauthorized') {
        toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
      }
    } finally {
      setSavingSeason(false);
    }
  };

  const handleEndSeason = async (seasonId: string) => {
    setConfirmEndSeasonId(null);
    setEndingSeason(true);
    try {
      const res = await adminFetch(`${API_BASE}/admin/seasons/end`, {
        method: 'POST',
        body: JSON.stringify({ seasonId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to end season');
      const payoutCount = data.payouts?.length ?? 0;
      toast({ title: 'Season Ended', description: `${payoutCount} payouts computed` });
      loadData();
      loadSeasons();
    } catch (err) {
      if ((err as Error).message !== 'Unauthorized') {
        toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
      }
    } finally {
      setEndingSeason(false);
    }
  };

  // --- Race handlers ---

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
          autoResolve,
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
    setConfirmResolveId(null);
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

  const handleReopenRace = async (raceId: string) => {
    setReopeningId(raceId);
    try {
      // Set a new deadline 60 minutes from now
      const newDeadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const res = await adminFetch(`${API_BASE}/admin/races/reopen`, {
        method: 'POST',
        body: JSON.stringify({ raceId, entryDeadline: newDeadline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reopen race');
      toast({ title: 'Race Reopened', description: `${data.race.name} is open again (deadline: 60 min)` });
      loadData();
    } catch (err) {
      if ((err as Error).message !== 'Unauthorized') {
        toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
      }
    } finally {
      setReopeningId(null);
    }
  };

  const startEditing = (race: any) => {
    setEditingId(race.id);
    setEditName(race.name);
    setEditType(race.raceType);
    // Format deadline as local datetime-local input value
    const dl = new Date(race.entryDeadline);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEditDeadline(
      `${dl.getFullYear()}-${pad(dl.getMonth() + 1)}-${pad(dl.getDate())}T${pad(dl.getHours())}:${pad(dl.getMinutes())}`
    );
    setEditMaxEntries(race.maxEntries);
    setEditAutoResolve(race.autoResolve ?? true);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSaveRace = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await adminFetch(`${API_BASE}/admin/races/update`, {
        method: 'POST',
        body: JSON.stringify({
          raceId: editingId,
          name: editName,
          raceType: editType,
          entryDeadline: new Date(editDeadline).toISOString(),
          maxEntries: editMaxEntries,
          autoResolve: editAutoResolve,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update race');
      toast({ title: 'Race Updated', description: data.race.name });
      setEditingId(null);
      loadData();
    } catch (err) {
      if ((err as Error).message !== 'Unauthorized') {
        toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
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
  const cancelledRaces = races.filter(r => r.status === 'cancelled');

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

        {/* ═══════════ SEASON MANAGEMENT ═══════════ */}

        {/* Active Season — edit inline or end */}
        {season ? (
          <Card className="cyber-card border-primary/30">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Active Season
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingSeasonId === season.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Name</label>
                      <input
                        type="text"
                        value={editSeasonName}
                        onChange={e => setEditSeasonName(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                      <input
                        type="datetime-local"
                        value={editSeasonEndDate}
                        onChange={e => setEditSeasonEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Prize Pool (ERG)</label>
                      <input
                        type="number"
                        value={editSeasonPrizePool}
                        onChange={e => setEditSeasonPrizePool(Number(e.target.value))}
                        min={0}
                        step={0.1}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Modifier Theme</label>
                      <input
                        type="text"
                        value={editSeasonTheme}
                        onChange={e => setEditSeasonTheme(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs text-muted-foreground mb-1">Modifier Description</label>
                      <input
                        type="text"
                        value={editSeasonDesc}
                        onChange={e => setEditSeasonDesc(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveSeason} disabled={savingSeason} className="glow-cyan">
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      {savingSeason ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingSeasonId(null)}>
                      <X className="w-3.5 h-3.5 mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-foreground font-semibold text-lg">{season.name}</p>
                      <p className="text-muted-foreground text-sm">Season {season.seasonNumber}</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{season.collectionName}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(season.startDate).toLocaleDateString()} — {new Date(season.endDate).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Trophy className="w-3.5 h-3.5" />
                      {season.prizePool} ERG pool
                    </span>
                    {season.modifier?.theme && season.modifier.theme !== 'standard' && (
                      <span>Theme: {season.modifier.theme}</span>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="ghost" onClick={() => startEditingSeason(season)}>
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      Edit
                    </Button>
                    {confirmEndSeasonId === season.id ? (
                      <>
                        <span className="text-xs text-yellow-400 self-center">This will cancel open races and compute payouts. Sure?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleEndSeason(season.id)}
                          disabled={endingSeason}
                        >
                          <Power className="w-3.5 h-3.5 mr-1.5" />
                          {endingSeason ? 'Ending...' : 'Yes, End Season'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmEndSeasonId(null)}>No</Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmEndSeasonId(season.id)}
                        disabled={endingSeason}
                      >
                        <Power className="w-3.5 h-3.5 mr-1.5" />
                        End Season
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* No active season — show create form */
          <Card className="cyber-card">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Start New Season
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Collection</label>
                  <select
                    value={seasonCollectionId}
                    onChange={e => setSeasonCollectionId(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {collections.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Season Name (optional)</label>
                  <input
                    type="text"
                    value={seasonName}
                    onChange={e => setSeasonName(e.target.value)}
                    placeholder="Auto: Season N"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Duration (days)</label>
                  <input
                    type="number"
                    value={seasonDuration}
                    onChange={e => setSeasonDuration(Number(e.target.value))}
                    min={1}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Prize Pool (ERG)</label>
                  <input
                    type="number"
                    value={seasonPrizePool}
                    onChange={e => setSeasonPrizePool(Number(e.target.value))}
                    min={0}
                    step={0.1}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Modifier Theme</label>
                  <input
                    type="text"
                    value={seasonModifierTheme}
                    onChange={e => setSeasonModifierTheme(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Modifier Description</label>
                  <input
                    type="text"
                    value={seasonModifierDesc}
                    onChange={e => setSeasonModifierDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreateSeason}
                disabled={creatingSeason || !seasonCollectionId}
                className="glow-cyan"
              >
                {creatingSeason ? 'Starting...' : 'Start Season'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Past Seasons */}
        {allSeasons.filter(s => s.status === 'completed').length > 0 && (
          <Card className="cyber-card">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                Past Seasons ({allSeasons.filter(s => s.status === 'completed').length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {allSeasons.filter(s => s.status === 'completed').map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2 px-4 rounded-lg bg-muted/20"
                  >
                    <div>
                      <span className="text-foreground font-semibold">{s.name}</span>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        <span>{s.collectionName}</span>
                        <span>{new Date(s.startDate).toLocaleDateString()} — {new Date(s.endDate).toLocaleDateString()}</span>
                        <span>{s.prizePool} ERG</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground uppercase">completed</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════════ RACE MANAGEMENT ═══════════ */}

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
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoResolve}
                onChange={e => setAutoResolve(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-background accent-primary"
              />
              <span className="text-sm text-muted-foreground">Auto-resolve when deadline passes</span>
            </label>
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
              <div className="space-y-3">
                {openRaces.map(race => (
                  <div
                    key={race.id}
                    className="rounded-lg bg-muted/30 border border-border/50 overflow-hidden"
                  >
                    {editingId === race.id ? (
                      /* Edit Form */
                      <div className="p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Name</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Type</label>
                            <select
                              value={editType}
                              onChange={e => setEditType(e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                              {RACE_TYPES.map(t => (
                                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Deadline</label>
                            <input
                              type="datetime-local"
                              value={editDeadline}
                              onChange={e => setEditDeadline(e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Max Entries</label>
                            <input
                              type="number"
                              value={editMaxEntries}
                              onChange={e => setEditMaxEntries(Number(e.target.value))}
                              min={2}
                              max={20}
                              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editAutoResolve}
                            onChange={e => setEditAutoResolve(e.target.checked)}
                            className="w-4 h-4 rounded border-border bg-background accent-primary"
                          />
                          <span className="text-xs text-muted-foreground">Auto-resolve when deadline passes</span>
                        </label>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSaveRace} disabled={saving} className="glow-cyan">
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                            {saving ? 'Saving...' : 'Save'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEditing}>
                            <X className="w-3.5 h-3.5 mr-1.5" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Display Row */
                      <div className="flex items-center justify-between py-3 px-4">
                        <div>
                          <Link
                            to={`/races/${race.id}/results`}
                            className="text-foreground font-semibold hover:text-primary transition-colors"
                          >
                            {race.name}
                          </Link>
                          <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                            <span className="uppercase">{race.raceType}</span>
                            <span>{race.entryCount}/{race.maxEntries} entries</span>
                            <span>Deadline: {new Date(race.entryDeadline).toLocaleString()}</span>
                            {race.autoResolve !== false && (
                              <span className="text-primary/70">auto-resolve</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(race)}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1.5" />
                            Edit
                          </Button>
                          {confirmResolveId === race.id ? (
                            <>
                              <span className="text-xs text-yellow-400">Sure?</span>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleResolveRace(race.id)}
                                disabled={resolvingId === race.id}
                              >
                                {resolvingId === race.id ? 'Resolving...' : 'Yes, Resolve'}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirmResolveId(null)}
                              >
                                No
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmResolveId(race.id)}
                              disabled={resolvingId === race.id}
                            >
                              {resolvingId === race.id ? 'Resolving...' : 'Resolve'}
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cancelled Races */}
        {cancelledRaces.length > 0 && (
          <Card className="cyber-card">
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Ban className="w-5 h-5 text-destructive" />
                Cancelled Races ({cancelledRaces.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cancelledRaces.map(race => (
                  <div
                    key={race.id}
                    className="flex items-center justify-between py-2 px-4 rounded-lg bg-muted/20 border border-destructive/20"
                  >
                    <div>
                      <span className="text-foreground font-semibold">{race.name}</span>
                      <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                        <span className="uppercase">{race.raceType}</span>
                        <span>{race.entryCount} entries</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReopenRace(race.id)}
                      disabled={reopeningId === race.id}
                    >
                      <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${reopeningId === race.id ? 'animate-spin' : ''}`} />
                      {reopeningId === race.id ? 'Reopening...' : 'Reopen'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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
                    <Link
                      to={`/races/${race.id}/results`}
                      className="text-foreground hover:text-primary transition-colors"
                    >
                      {race.name}
                    </Link>
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
