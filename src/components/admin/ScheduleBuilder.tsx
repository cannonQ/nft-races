import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Calendar } from 'lucide-react';
import { API_BASE } from '@/api/config';
import { RacePreviewTable, type PreviewRace } from './RacePreviewTable';
import { useToast } from '@/hooks/use-toast';

const RACE_TYPES = ['sprint', 'distance', 'technical', 'mixed', 'hazard'] as const;
const SPACING_OPTIONS = [
  { value: 180, label: '3h' },
  { value: 240, label: '4h' },
  { value: 360, label: '6h' },
  { value: 480, label: '8h' },
  { value: 720, label: '12h' },
] as const;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface Props {
  secret: string;
  collections: any[];
  activeSeasons: any[];
  onCreated: () => void;
}

export function ScheduleBuilder({ secret, collections, activeSeasons, onCreated }: Props) {
  const { toast } = useToast();

  // Template config state
  const [collectionId, setCollectionId] = useState('');
  const [racesPerDay, setRacesPerDay] = useState(4);
  const [spacing, setSpacing] = useState(360);
  const [dayStartHour, setDayStartHour] = useState(6);
  const [maxEntries, setMaxEntries] = useState(8);
  const [typeRotation, setTypeRotation] = useState<string[]>([...RACE_TYPES]);
  const [autoResolve, setAutoResolve] = useState(true);

  // Class race config
  const [rookiePerDay, setRookiePerDay] = useState(1);
  const [rookieMaxEntries, setRookieMaxEntries] = useState(8);
  const [contenderTotal, setContenderTotal] = useState(3);
  const [contenderMaxEntries, setContenderMaxEntries] = useState(8);
  const [championTotal, setChampionTotal] = useState(1);
  const [championMaxEntries, setChampionMaxEntries] = useState(8);

  // Naming
  const [nameTemplate, setNameTemplate] = useState('{type} Showdown #{n}');
  const [classNameTemplate, setClassNameTemplate] = useState('{class} {type} Cup #{n}');

  // Date range (default from active season)
  const selectedSeason = activeSeasons.find((s: any) => s.collectionId === collectionId);
  const defaultStart = selectedSeason?.startDate
    ? new Date(selectedSeason.startDate).toISOString().slice(0, 16)
    : new Date().toISOString().slice(0, 16);
  const defaultEnd = selectedSeason?.endDate
    ? new Date(selectedSeason.endDate).toISOString().slice(0, 16)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // Preview state
  const [previewRaces, setPreviewRaces] = useState<PreviewRace[] | null>(null);
  const [previewSummary, setPreviewSummary] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);

  const toggleType = (type: string) => {
    setTypeRotation(prev => {
      if (prev.includes(type)) {
        // Don't allow removing all types
        if (prev.length <= 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const handlePreview = useCallback(async () => {
    setPreviewing(true);
    setPreviewRaces(null);
    try {
      const template = {
        name: 'Custom',
        openRacesPerDay: racesPerDay,
        defaultMaxEntries: maxEntries,
        deadlineSpacingMinutes: spacing,
        dayStartHourUtc: dayStartHour,
        typeRotation,
        autoResolve,
        classRaces: {
          rookie: { perDay: rookiePerDay, maxEntries: rookieMaxEntries, typeRotation: [...typeRotation] },
          contender: { totalPerSeason: contenderTotal, maxEntries: contenderMaxEntries, typeRotation: [...typeRotation] },
          champion: { totalPerSeason: championTotal, maxEntries: championMaxEntries, typeRotation: [...typeRotation] },
        },
        naming: {
          mode: 'template' as const,
          template: nameTemplate,
          classTemplate: classNameTemplate,
        },
        fees: null,
      };

      const res = await fetch(`${API_BASE}/admin/races/generate-schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          collectionId: collectionId || undefined,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          template,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate schedule');

      setPreviewRaces(data.races);
      setPreviewSummary(data.summary);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setPreviewing(false);
    }
  }, [
    secret, collectionId, startDate, endDate, racesPerDay, maxEntries, spacing,
    dayStartHour, typeRotation, autoResolve, rookiePerDay, rookieMaxEntries,
    contenderTotal, contenderMaxEntries, championTotal, championMaxEntries,
    nameTemplate, classNameTemplate, toast,
  ]);

  const handleCreateAll = useCallback(async () => {
    if (!previewRaces || previewRaces.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/admin/races/batch-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          collectionId: collectionId || undefined,
          races: previewRaces,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.details?.join(', ') || 'Failed to create races');

      toast({ title: 'Races Created', description: `${data.created} races created successfully` });
      setPreviewRaces(null);
      onCreated();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }, [secret, collectionId, previewRaces, toast, onCreated]);

  // Update dates when collection changes
  const handleCollectionChange = (id: string) => {
    setCollectionId(id);
    const season = activeSeasons.find((s: any) => s.collectionId === id);
    if (season) {
      setStartDate(new Date(season.startDate).toISOString().slice(0, 16));
      setEndDate(new Date(season.endDate).toISOString().slice(0, 16));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-muted/20 border-border/50">
        <CardContent className="pt-4 space-y-4">
          {/* Row 1: Collection + Date range */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Collection</label>
              <select
                value={collectionId}
                onChange={e => handleCollectionChange(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">Select collection...</option>
                {collections.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">End Date</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Row 2: Open race config */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Open Races/Day</label>
              <input
                type="number"
                value={racesPerDay}
                onChange={e => setRacesPerDay(Number(e.target.value))}
                min={1}
                max={12}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Spacing</label>
              <select
                value={spacing}
                onChange={e => setSpacing(Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {SPACING_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Day Start (UTC)</label>
              <input
                type="number"
                value={dayStartHour}
                onChange={e => setDayStartHour(Number(e.target.value))}
                min={0}
                max={23}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Max Entries</label>
              <input
                type="number"
                value={maxEntries}
                onChange={e => setMaxEntries(Number(e.target.value))}
                min={2}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Row 3: Type rotation */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Type Rotation</label>
            <div className="flex flex-wrap gap-2">
              {RACE_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    typeRotation.includes(t)
                      ? 'bg-primary/20 text-primary border-primary/40'
                      : 'bg-muted/30 text-muted-foreground border-border/50 opacity-50'
                  }`}
                >
                  {capitalize(t)}
                </button>
              ))}
            </div>
          </div>

          {/* Row 4: Class race distribution */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg bg-background/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-green-400">Rookie</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground">Per Day</label>
                  <input
                    type="number"
                    value={rookiePerDay}
                    onChange={e => setRookiePerDay(Number(e.target.value))}
                    min={0}
                    max={4}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground">Max Entries</label>
                  <input
                    type="number"
                    value={rookieMaxEntries}
                    onChange={e => setRookieMaxEntries(Number(e.target.value))}
                    min={2}
                        className="w-full px-2 py-1 bg-background border border-border rounded text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-background/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-yellow-400">Contender</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground">Total/Season</label>
                  <input
                    type="number"
                    value={contenderTotal}
                    onChange={e => setContenderTotal(Number(e.target.value))}
                    min={0}
                        className="w-full px-2 py-1 bg-background border border-border rounded text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground">Max Entries</label>
                  <input
                    type="number"
                    value={contenderMaxEntries}
                    onChange={e => setContenderMaxEntries(Number(e.target.value))}
                    min={2}
                        className="w-full px-2 py-1 bg-background border border-border rounded text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-background/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-red-400">Champion</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground">Total/Season</label>
                  <input
                    type="number"
                    value={championTotal}
                    onChange={e => setChampionTotal(Number(e.target.value))}
                    min={0}
                    max={10}
                    className="w-full px-2 py-1 bg-background border border-border rounded text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground">Max Entries</label>
                  <input
                    type="number"
                    value={championMaxEntries}
                    onChange={e => setChampionMaxEntries(Number(e.target.value))}
                    min={2}
                        className="w-full px-2 py-1 bg-background border border-border rounded text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 5: Naming templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Name Template <span className="text-muted-foreground/60">({'{type}'}, {'{n}'}, {'{day}'}, {'{slot}'})</span>
              </label>
              <input
                type="text"
                value={nameTemplate}
                onChange={e => setNameTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Class Template <span className="text-muted-foreground/60">(+ {'{class}'})</span>
              </label>
              <input
                type="text"
                value={classNameTemplate}
                onChange={e => setClassNameTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Auto-resolve + Preview button */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoResolve}
                onChange={e => setAutoResolve(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-background accent-primary"
              />
              <span className="text-sm text-muted-foreground">Auto-resolve</span>
            </label>
            <Button
              onClick={handlePreview}
              disabled={previewing || !collectionId}
              className="glow-cyan"
            >
              {previewing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Preview Schedule
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview table */}
      {previewRaces && (
        <RacePreviewTable
          races={previewRaces}
          onRacesChange={setPreviewRaces}
          onCreateAll={handleCreateAll}
          creating={creating}
          summary={previewSummary}
        />
      )}
    </div>
  );
}
