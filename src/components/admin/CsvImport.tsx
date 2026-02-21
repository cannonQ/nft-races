import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Upload, Download, AlertCircle } from 'lucide-react';
import { API_BASE } from '@/api/config';
import { RacePreviewTable, type PreviewRace } from './RacePreviewTable';
import { useToast } from '@/hooks/use-toast';

interface Props {
  secret: string;
  collections: any[];
  activeSeasons: any[];
  onCreated: () => void;
}

export function CsvImport({ secret, collections, activeSeasons, onCreated }: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [collectionId, setCollectionId] = useState('');
  const [csvText, setCsvText] = useState('');
  const [baseDate, setBaseDate] = useState(new Date().toISOString().slice(0, 16));
  const [spacingMinutes, setSpacingMinutes] = useState(360);

  const [previewRaces, setPreviewRaces] = useState<PreviewRace[] | null>(null);
  const [previewSummary, setPreviewSummary] = useState<any>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleDownloadTemplate = () => {
    window.open(`${API_BASE}/admin/races/csv-template`, '_blank');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        setCsvText(text);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleParse = useCallback(async () => {
    if (!csvText.trim()) {
      toast({ title: 'Error', description: 'Paste or upload a CSV first', variant: 'destructive' });
      return;
    }
    setParsing(true);
    setPreviewRaces(null);
    setWarnings([]);
    try {
      const res = await fetch(`${API_BASE}/admin/races/parse-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          csv: csvText,
          baseDate: new Date(baseDate).toISOString(),
          spacingMinutes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse CSV');

      setPreviewRaces(data.races);
      setPreviewSummary(data.summary);
      setWarnings(data.warnings || []);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setParsing(false);
    }
  }, [secret, csvText, baseDate, spacingMinutes, toast]);

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
      setCsvText('');
      onCreated();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }, [secret, collectionId, previewRaces, toast, onCreated]);

  const handleCollectionChange = (id: string) => {
    setCollectionId(id);
    const season = activeSeasons.find((s: any) => s.collectionId === id);
    if (season) {
      setBaseDate(new Date(season.startDate).toISOString().slice(0, 16));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-muted/20 border-border/50">
        <CardContent className="pt-4 space-y-4">
          {/* Row 1: Collection + base date + spacing */}
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
              <label className="block text-xs text-muted-foreground mb-1">Base Date (for sequential offsets)</label>
              <input
                type="datetime-local"
                value={baseDate}
                onChange={e => setBaseDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Default Spacing (min)</label>
              <input
                type="number"
                value={spacingMinutes}
                onChange={e => setSpacingMinutes(Number(e.target.value))}
                min={30}
                max={1440}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Download template */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Template
            </Button>
            <span className="text-xs text-muted-foreground">
              or paste CSV directly below
            </span>
          </div>

          {/* CSV input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">CSV Data</label>
              <label className="cursor-pointer">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <span className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  Upload file
                </span>
              </label>
            </div>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={8}
              placeholder={`name,raceType,deadlineOffset,maxEntries,rarityClass,autoResolve,entryFeeToken\nSprint Showdown #1,sprint,,8,,,\nDistance Challenge #1,distance,+6h,8,,,`}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
            />
          </div>

          {/* Parse button */}
          <div className="flex justify-end">
            <Button
              onClick={handleParse}
              disabled={parsing || !csvText.trim()}
              className="glow-cyan"
            >
              {parsing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                'Parse CSV'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warnings banner */}
      {warnings.length > 0 && (
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm text-yellow-400 font-semibold">
            <AlertCircle className="w-4 h-4" />
            {warnings.length} warning{warnings.length > 1 ? 's' : ''}
          </div>
          <ul className="text-xs text-yellow-400/80 list-disc list-inside space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

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
