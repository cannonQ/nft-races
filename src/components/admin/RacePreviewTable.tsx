import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Check, X, Loader2 } from 'lucide-react';

const RACE_TYPES = ['sprint', 'distance', 'technical', 'mixed', 'hazard'] as const;
const RARITY_CLASSES = [
  { value: '', label: 'Open' },
  { value: 'rookie', label: 'Rookie' },
  { value: 'contender', label: 'Contender' },
  { value: 'champion', label: 'Champion' },
] as const;

export interface PreviewRace {
  index: number;
  name: string;
  raceType: string;
  entryDeadline: string;
  maxEntries: number;
  rarityClass: string | null;
  autoResolve: boolean;
  entryFeeNanoerg: number;
  entryFeeToken: number | null;
  day: number;
  slot: number;
}

interface Props {
  races: PreviewRace[];
  onRacesChange: (races: PreviewRace[]) => void;
  onCreateAll: () => void;
  creating: boolean;
  summary?: { open: number; rookie: number; contender: number; champion: number };
}

const TYPE_COLORS: Record<string, string> = {
  sprint: 'bg-race-sprint/20 text-race-sprint border-race-sprint/30',
  distance: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  technical: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  mixed: 'bg-green-500/20 text-green-400 border-green-500/30',
  hazard: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const CLASS_COLORS: Record<string, string> = {
  rookie: 'bg-green-500/20 text-green-400 border-green-500/30',
  contender: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  champion: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function RacePreviewTable({ races, onRacesChange, onCreateAll, creating, summary }: Props) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editClass, setEditClass] = useState('');

  const startEdit = (race: PreviewRace) => {
    setEditIdx(race.index);
    setEditName(race.name);
    setEditType(race.raceType);
    setEditClass(race.rarityClass ?? '');
  };

  const saveEdit = () => {
    if (editIdx === null) return;
    const updated = races.map(r =>
      r.index === editIdx
        ? { ...r, name: editName, raceType: editType, rarityClass: editClass || null }
        : r,
    );
    onRacesChange(updated);
    setEditIdx(null);
  };

  const cancelEdit = () => setEditIdx(null);

  const removeRace = (index: number) => {
    onRacesChange(races.filter(r => r.index !== index));
  };

  if (races.length === 0) {
    return <p className="text-sm text-muted-foreground">No races to preview.</p>;
  }

  const computedSummary = summary ?? {
    open: races.filter(r => !r.rarityClass).length,
    rookie: races.filter(r => r.rarityClass === 'rookie').length,
    contender: races.filter(r => r.rarityClass === 'contender').length,
    champion: races.filter(r => r.rarityClass === 'champion').length,
  };

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
        <span className="font-semibold text-foreground">{races.length} total</span>
        <span className="text-muted-foreground">=</span>
        <span>{computedSummary.open} Open</span>
        {computedSummary.rookie > 0 && (
          <>
            <span>+</span>
            <span className="text-green-400">{computedSummary.rookie} Rookie</span>
          </>
        )}
        {computedSummary.contender > 0 && (
          <>
            <span>+</span>
            <span className="text-yellow-400">{computedSummary.contender} Contender</span>
          </>
        )}
        {computedSummary.champion > 0 && (
          <>
            <span>+</span>
            <span className="text-red-400">{computedSummary.champion} Champion</span>
          </>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground uppercase border-b border-border/30">
              <th className="text-left py-2 pr-2 w-8">#</th>
              <th className="text-left py-2 pr-2">Name</th>
              <th className="text-left py-2 pr-2">Type</th>
              <th className="text-left py-2 pr-2">Class</th>
              <th className="text-left py-2 pr-2">Deadline</th>
              <th className="text-center py-2 pr-2">Max</th>
              <th className="text-center py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {races.map(race => (
              <tr key={race.index} className="border-b border-border/10 hover:bg-muted/20">
                {editIdx === race.index ? (
                  <>
                    <td className="py-1.5 pr-2 text-muted-foreground">{race.index + 1}</td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="w-full px-2 py-1 bg-background border border-border rounded text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={editType}
                        onChange={e => setEditType(e.target.value)}
                        className="px-2 py-1 bg-background border border-border rounded text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      >
                        {RACE_TYPES.map(t => (
                          <option key={t} value={t}>{capitalize(t)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2">
                      <select
                        value={editClass}
                        onChange={e => setEditClass(e.target.value)}
                        className="px-2 py-1 bg-background border border-border rounded text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                      >
                        {RARITY_CLASSES.map(rc => (
                          <option key={rc.value} value={rc.value}>{rc.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                      {new Date(race.entryDeadline).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-center text-xs">{race.maxEntries}</td>
                    <td className="py-1.5 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={saveEdit} className="p-1 text-green-400 hover:text-green-300">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:text-foreground">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-1.5 pr-2 text-muted-foreground">{race.index + 1}</td>
                    <td className="py-1.5 pr-2 text-foreground">{race.name}</td>
                    <td className="py-1.5 pr-2">
                      <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[race.raceType] ?? ''}`}>
                        {capitalize(race.raceType)}
                      </Badge>
                    </td>
                    <td className="py-1.5 pr-2">
                      {race.rarityClass ? (
                        <Badge variant="outline" className={`text-[10px] ${CLASS_COLORS[race.rarityClass] ?? ''}`}>
                          {capitalize(race.rarityClass)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Open</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                      {new Date(race.entryDeadline).toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-2 text-center text-xs">{race.maxEntries}</td>
                    <td className="py-1.5 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => startEdit(race)} className="p-1 text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => removeRace(race.index)} className="p-1 text-muted-foreground hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create button */}
      <Button
        onClick={onCreateAll}
        disabled={creating || races.length === 0}
        className="glow-cyan w-full"
      >
        {creating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating {races.length} Races...
          </>
        ) : (
          `Create All ${races.length} Races`
        )}
      </Button>
    </div>
  );
}
