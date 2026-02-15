import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

type CollectionId = 'cyberpets' | 'aneta-angels';

const statLabels = [
  { key: 'speed', label: 'Speed', abbr: 'SPD', color: 'text-race-sprint' },
  { key: 'stamina', label: 'Stamina', abbr: 'STM', color: 'text-race-distance' },
  { key: 'accel', label: 'Acceleration', abbr: 'ACC', color: 'text-race-technical' },
  { key: 'agility', label: 'Agility', abbr: 'AGI', color: 'text-race-mixed' },
  { key: 'heart', label: 'Heart', abbr: 'HRT', color: 'text-secondary' },
  { key: 'focus', label: 'Focus', abbr: 'FOC', color: 'text-primary' },
];

function StatBadge({ abbr, color }: { abbr: string; color: string }) {
  return (
    <span className={cn('font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted/50', color)}>
      {abbr}
    </span>
  );
}

export default function FAQ() {
  const [collection, setCollection] = useState<CollectionId>('cyberpets');
  const isCyberPets = collection === 'cyberpets';
  const collectionName = isCyberPets ? 'CyberPets' : 'Aneta Angels';
  const creatureSingular = isCyberPets ? 'CyberPet' : 'angel';

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            How It Works
          </h1>
          <p className="text-muted-foreground">
            Everything you need to know about training, racing, and boosting your {collectionName}.
          </p>
        </div>

        {/* Collection Pills */}
        <div className="flex items-center gap-2">
          {(['cyberpets', 'aneta-angels'] as const).map((id) => {
            const isActive = collection === id;
            const label = id === 'cyberpets' ? 'CyberPets' : 'Aneta Angels';
            return (
              <button
                key={id}
                onClick={() => setCollection(id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 border',
                  isActive
                    ? 'bg-primary/20 text-primary border-primary/50'
                    : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/30'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Overview */}
        <div className="cyber-card rounded-xl p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">The Basics</h2>
          {isCyberPets ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              CyberPets Racing is a seasonal competitive game built on the Ergo blockchain.
              You own CyberPet NFTs, train them to build stats, enter races to compete, and
              earn rewards that make your pets even stronger. Each season resets trained stats,
              so everyone starts fresh — but your NFT's base stats are permanent.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Aneta Angels is a collection of 4,406 unique angel NFTs on the Ergo blockchain,
                originally launched by the anetaBTC project and then RUGGED the community. 
                This is an attempt to give some value back to the community. Each angel has 6 visual traits
                that determine its rarity and racing stats — all derived mathematically from
                on-chain trait scarcity.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Train your angels to build stats, enter races to compete, and earn rewards.
                Each season resets trained stats, so everyone starts fresh — but your NFT's
                base stats are permanent and frozen on-chain (unlike Frosty and his ever-changing loyalties).
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="cyber-card rounded-xl p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">The Six Stats</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every {creatureSingular} has six stats. <strong>Base stats</strong> come from your NFT's
            on-chain traits and never change. <strong>Trained stats</strong> are earned through
            training and reset each season. Your <strong>effective stat</strong> is base + trained.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {statLabels.map(({ key, label, abbr, color }) => (
              <div key={key} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                <StatBadge abbr={abbr} color={color} />
                <div>
                  <p className={cn('text-sm font-semibold', color)}>{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {key === 'speed' && 'Raw top-end speed. Dominant in sprint races.'}
                    {key === 'stamina' && 'Endurance over distance. Key for distance races.'}
                    {key === 'accel' && 'Burst off the start. Crucial in technical races.'}
                    {key === 'agility' && 'Course navigation and turning. Matters in mixed/hazard.'}
                    {key === 'heart' && 'Grit under pressure. Contributes across all race types.'}
                    {key === 'focus' && 'Mental consistency. Reduces luck variance in races.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Each stat caps at <strong>80</strong>. Total trained stats cap at <strong>300</strong> —
            you can't max everything, so choose your build wisely.
          </p>
        </div>

        {/* Base Stats — collection-specific */}
        {isCyberPets ? (
          <div className="cyber-card rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">
              How Base Stats Are Created
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your NFT's on-chain traits determine its permanent base stats. Three factors matter:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                <p className="font-semibold text-foreground mb-1">Rarity</p>
                <p className="text-muted-foreground">
                  Higher rarity = higher <strong>stat budget</strong>. A Common gets ~60 total
                  stat points distributed across 6 stats; an Epic gets ~90+.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                <p className="font-semibold text-foreground mb-1">Body Parts</p>
                <p className="text-muted-foreground">
                  More body parts = bonus <StatBadge abbr="STM" color="text-race-distance" />.
                  Each body part adds a small <strong>stamina</strong> bump.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                <p className="font-semibold text-foreground mb-1">Material Quality</p>
                <p className="text-muted-foreground">
                  Higher material (Cyberium {'>'} Diamond {'>'} Golden {'>'} Silver) = bonus <StatBadge abbr="FOC" color="text-primary" />.
                  Better materials give a <strong>focus</strong> edge.
                </p>
              </div>
            </div>

            {/* CyberPets rarity table */}
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-2">
              Starting Stat Budgets by Rarity
            </p>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-semibold">Rarity</th>
                    <th className="text-right px-3 py-2 font-semibold">Stat Budget</th>
                    <th className="text-right px-3 py-2 font-semibold">Avg / Stat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {[
                    { name: 'Common', total: 60, style: 'text-muted-foreground' },
                    { name: 'Uncommon', total: 70, style: 'text-rarity-uncommon' },
                    { name: 'Rare', total: 80, style: 'text-rarity-rare' },
                    { name: 'Masterwork', total: 85, style: 'text-rarity-rare' },
                    { name: 'Epic', total: 90, style: 'text-rarity-epic' },
                    { name: 'Relic', total: 95, style: 'text-rarity-epic' },
                    { name: 'Legendary', total: 100, style: 'text-rarity-legendary' },
                    { name: 'Mythic', total: 110, style: 'text-rarity-mythic' },
                    { name: 'Cyberium', total: 120, style: 'text-primary' },
                  ].map((r) => (
                    <tr key={r.name}>
                      <td className={cn('px-3 py-1.5 font-semibold', r.style)}>{r.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-foreground">{r.total}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                        ~{(r.total / 6).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Body parts and material quality shift points between stats (more parts = stamina
              bonus, better material = focus bonus), but the total stays within the rarity budget.
              Because the trained stat cap is the same for everyone (300), a Common can close the
              gap through focused training and smart race-type selection.
            </p>

            {/* CyberPets side-by-side example */}
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-2">
              Example: Common vs Epic
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-foreground">Quokka 1906</span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                    Common
                  </span>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <p className="text-muted-foreground mb-2">
                    Budget: ~60 · 8 parts · Silver material
                  </p>
                  {[
                    { abbr: 'SPD', val: 9.2, color: 'text-race-sprint' },
                    { abbr: 'STM', val: 13.2, color: 'text-race-distance' },
                    { abbr: 'ACC', val: 9.2, color: 'text-race-technical' },
                    { abbr: 'AGI', val: 9.2, color: 'text-race-mixed' },
                    { abbr: 'HRT', val: 9.2, color: 'text-secondary' },
                    { abbr: 'FOC', val: 9.7, color: 'text-primary' },
                  ].map((s) => (
                    <div key={s.abbr} className="flex items-center gap-2">
                      <span className={cn('font-mono w-7', s.color)}>{s.abbr}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${(s.val / 25) * 100}%` }} />
                      </div>
                      <span className="font-mono text-foreground w-8 text-right">{s.val}</span>
                    </div>
                  ))}
                  <p className="font-mono text-muted-foreground text-right pt-1">Total: 59.7</p>
                </div>
              </div>

              <div className="rounded-lg border border-rarity-epic/30 overflow-hidden">
                <div className="bg-rarity-epic/5 px-3 py-2 flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-foreground">Hydra 42</span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-rarity-epic/10 text-rarity-epic">
                    Epic
                  </span>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <p className="text-muted-foreground mb-2">
                    Budget: ~90 · 6 parts · Cyberium material
                  </p>
                  {[
                    { abbr: 'SPD', val: 14.1, color: 'text-race-sprint' },
                    { abbr: 'STM', val: 17.1, color: 'text-race-distance' },
                    { abbr: 'ACC', val: 14.1, color: 'text-race-technical' },
                    { abbr: 'AGI', val: 14.1, color: 'text-race-mixed' },
                    { abbr: 'HRT', val: 14.1, color: 'text-secondary' },
                    { abbr: 'FOC', val: 16.1, color: 'text-primary' },
                  ].map((s) => (
                    <div key={s.abbr} className="flex items-center gap-2">
                      <span className={cn('font-mono w-7', s.color)}>{s.abbr}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-rarity-epic/40" style={{ width: `${(s.val / 25) * 100}%` }} />
                      </div>
                      <span className="font-mono text-foreground w-8 text-right">{s.val}</span>
                    </div>
                  ))}
                  <p className="font-mono text-rarity-epic text-right pt-1">Total: 89.6</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Aneta Angels Base Stats */
          <div className="cyber-card rounded-xl p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">
              How Base Stats Are Created
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Aneta Angels don't have an explicit rarity trait. Instead, <strong>rarity is
              mathematically derived from how scarce each trait value is</strong> across the
              entire collection of 4,406 circulating tokens. The scoring is frozen on-chain
              and fully auditable.
            </p>

            {/* Scoring overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                <p className="font-semibold text-foreground mb-1">Trait Rarity Scoring</p>
                <p className="text-muted-foreground">
                  For each of the 5 scored traits, rarer values get higher scores using
                  inverse frequency. Scores are <strong>normalized 0–100 per category</strong> so
                  no single trait dominates.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/20 border border-border/30">
                <p className="font-semibold text-foreground mb-1">Percentile Tiers</p>
                <p className="text-muted-foreground">
                  All 4,406 tokens are ranked by total score. Tiers are assigned by
                  percentile: exactly <strong>2% Mythic, 6% Legendary, 12% Epic</strong>, etc.
                  This guarantees a fair, predictable distribution.
                </p>
              </div>
            </div>

            {/* Trait → Stat mapping */}
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-2">
              Trait → Stat Mapping
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Each of the 5 scored trait categories maps to a specific stat. Your angel's
              trait scores determine how its stat budget is distributed — two angels of the
              same rarity tier will have different stat profiles based on their traits.
            </p>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-semibold">Trait</th>
                    <th className="text-left px-3 py-2 font-semibold">Stat</th>
                    <th className="text-left px-3 py-2 font-semibold">Unique Values</th>
                    <th className="text-left px-3 py-2 font-semibold">Logic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {[
                    { trait: 'Wings', stat: 'SPD', statColor: 'text-race-sprint', values: 8, logic: 'Wings = how fast you fly' },
                    { trait: 'Body', stat: 'STM', statColor: 'text-race-distance', values: 41, logic: 'Body type = physical endurance' },
                    { trait: 'Face', stat: 'HRT', statColor: 'text-secondary', values: 20, logic: 'Expression = grit and determination' },
                    { trait: 'Head', stat: 'ACC', statColor: 'text-race-technical', values: 37, logic: 'Headgear = aerodynamics and burst' },
                    { trait: 'Background', stat: 'AGI', statColor: 'text-race-mixed', values: 18, logic: 'Environment = adaptability' },
                  ].map((row) => (
                    <tr key={row.trait}>
                      <td className="px-3 py-1.5 font-semibold text-foreground">{row.trait}</td>
                      <td className="px-3 py-1.5"><StatBadge abbr={row.stat} color={row.statColor} /></td>
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{row.values}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.logic}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-3 py-1.5 font-semibold text-foreground">Skin Tone</td>
                    <td className="px-3 py-1.5"><StatBadge abbr="FOC" color="text-primary" /></td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">4</td>
                    <td className="px-3 py-1.5 text-muted-foreground">Separate — not part of stat budget</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Aneta Angels rarity table */}
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-2">
              Rarity Tiers & Stat Budgets
            </p>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-semibold">Tier</th>
                    <th className="text-right px-3 py-2 font-semibold">Stat Budget</th>
                    <th className="text-right px-3 py-2 font-semibold">Avg / Stat</th>
                    <th className="text-right px-3 py-2 font-semibold">Count</th>
                    <th className="text-right px-3 py-2 font-semibold">% of Collection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {[
                    { name: 'Common', total: 50, count: 1321, pct: '30.0%', style: 'text-muted-foreground' },
                    { name: 'Uncommon', total: 60, count: 1321, pct: '30.0%', style: 'text-rarity-uncommon' },
                    { name: 'Rare', total: 70, count: 882, pct: '20.0%', style: 'text-rarity-rare' },
                    { name: 'Epic', total: 80, count: 529, pct: '12.0%', style: 'text-rarity-epic' },
                    { name: 'Legendary', total: 90, count: 264, pct: '6.0%', style: 'text-rarity-legendary' },
                    { name: 'Mythic', total: 100, count: 89, pct: '2.0%', style: 'text-rarity-mythic' },
                  ].map((r) => (
                    <tr key={r.name}>
                      <td className={cn('px-3 py-1.5 font-semibold', r.style)}>{r.name}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-foreground">{r.total}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                        ~{(r.total / 6).toFixed(1)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{r.count.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{r.pct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Focus / Skin Tone */}
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-2">
              Skin Tone → Focus
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Focus is <strong>not</strong> part of the stat budget. It's a separate modifier
              from Skin Tone that controls how much luck can swing your results. All four
              tones are equally distributed (~25% each) — this is a strategic property, not
              a power advantage.
            </p>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="text-left px-3 py-2 font-semibold">Skin Tone</th>
                    <th className="text-right px-3 py-2 font-semibold">Focus</th>
                    <th className="text-left px-3 py-2 font-semibold">Effect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {[
                    { tone: 'Tone 1', focus: '0.85 (High)', effect: 'Consistent, reliable. Protects a lead.' },
                    { tone: 'Tone 2', focus: '0.70 (Mid-High)', effect: 'Slightly swingy. Small chance of surprise.' },
                    { tone: 'Tone 3', focus: '0.55 (Mid-Low)', effect: 'Noticeable variance. Can overperform or underperform.' },
                    { tone: 'Tone 4', focus: '0.40 (Low)', effect: 'Wild swings. Upset specialist — or spectacular flameout.' },
                  ].map((row) => (
                    <tr key={row.tone}>
                      <td className="px-3 py-1.5 font-semibold text-foreground">{row.tone}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-primary">{row.focus}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Aneta Angels examples */}
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-2">
              Example: Common vs Mythic
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Common angel */}
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-foreground">Aneta #2847</span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                    Common
                  </span>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <p className="text-muted-foreground mb-2">
                    Score: 12.4 · Angel Wings · Tone 1
                  </p>
                  {[
                    { abbr: 'SPD', val: 10, color: 'text-race-sprint' },
                    { abbr: 'STM', val: 10, color: 'text-race-distance' },
                    { abbr: 'ACC', val: 10, color: 'text-race-technical' },
                    { abbr: 'AGI', val: 10, color: 'text-race-mixed' },
                    { abbr: 'HRT', val: 10, color: 'text-secondary' },
                    { abbr: 'FOC', val: 0.85, color: 'text-primary' },
                  ].map((s) => (
                    <div key={s.abbr} className="flex items-center gap-2">
                      <span className={cn('font-mono w-7', s.color)}>{s.abbr}</span>
                      {s.abbr !== 'FOC' ? (
                        <>
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${(s.val / 30) * 100}%` }} />
                          </div>
                          <span className="font-mono text-foreground w-8 text-right">~{s.val}</span>
                        </>
                      ) : (
                        <span className="font-mono text-primary text-right flex-1">{s.val}</span>
                      )}
                    </div>
                  ))}
                  <p className="font-mono text-muted-foreground text-right pt-1">Total: ~50</p>
                  <p className="text-muted-foreground pt-1 italic">
                    All common traits = flat stats, but high Focus means rock-solid consistency. Specialize via training to compete.
                  </p>
                </div>
              </div>

              {/* Mythic angel */}
              <div className="rounded-lg border border-rarity-mythic/30 overflow-hidden">
                <div className="bg-rarity-mythic/5 px-3 py-2 flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-foreground">Aneta #0581</span>
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-rarity-mythic/10 text-rarity-mythic">
                    Mythic
                  </span>
                </div>
                <div className="p-3 space-y-1.5 text-xs">
                  <p className="text-muted-foreground mb-2">
                    Score: 265.0 · Gold Wings · Tone 4
                  </p>
                  {[
                    { abbr: 'SPD', val: 27, color: 'text-race-sprint' },
                    { abbr: 'STM', val: 14, color: 'text-race-distance' },
                    { abbr: 'ACC', val: 8, color: 'text-race-technical' },
                    { abbr: 'AGI', val: 16, color: 'text-race-mixed' },
                    { abbr: 'HRT', val: 27, color: 'text-secondary' },
                    { abbr: 'FOC', val: 0.40, color: 'text-primary' },
                  ].map((s) => (
                    <div key={s.abbr} className="flex items-center gap-2">
                      <span className={cn('font-mono w-7', s.color)}>{s.abbr}</span>
                      {s.abbr !== 'FOC' ? (
                        <>
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-rarity-mythic/40" style={{ width: `${(s.val / 30) * 100}%` }} />
                          </div>
                          <span className="font-mono text-foreground w-8 text-right">~{s.val}</span>
                        </>
                      ) : (
                        <span className="font-mono text-primary text-right flex-1">{s.val}</span>
                      )}
                    </div>
                  ))}
                  <p className="font-mono text-rarity-mythic text-right pt-1">Total: ~92</p>
                  <p className="text-muted-foreground pt-1 italic">
                    Gold Wings + Meme 4 face = massive SPD and HRT spikes, but low Focus means wild luck swings every race.
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              A well-trained Common that specializes for sprint races can beat an untrained
              Mythic. The trained stat cap (300) is the same for everyone — strategy matters
              as much as rarity.
            </p>
          </div>
        )}

        {/* FAQ Accordion */}
        <div className="cyber-card rounded-xl p-6">
          <Accordion type="multiple" className="w-full">

            {/* Training */}
            <AccordionItem value="training">
              <AccordionTrigger className="text-foreground">
                How does training work?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  You get <strong>2 training actions per day</strong> (UTC reset). Each action
                  targets a primary stat and a secondary stat. Pick the activity that
                  matches the stats you want to develop. Each activity also affects
                  your <strong>sharpness</strong> — physical activities tend to decrease it,
                  while mental activities increase it.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/30">Sprint Drills → <StatBadge abbr="SPD" color="text-race-sprint" /> primary · Sharpness −5</div>
                  <div className="p-2 rounded bg-muted/30">Distance Runs → <StatBadge abbr="STM" color="text-race-distance" /> primary · Sharpness −3</div>
                  <div className="p-2 rounded bg-muted/30">Gate Work → <StatBadge abbr="ACC" color="text-race-technical" /> primary · Sharpness +5</div>
                  <div className="p-2 rounded bg-muted/30">Agility Course → <StatBadge abbr="AGI" color="text-race-mixed" /> primary · Sharpness ±0</div>
                  <div className="p-2 rounded bg-muted/30">Cross-Training → <StatBadge abbr="STM" color="text-race-distance" /> + <StatBadge abbr="HRT" color="text-secondary" /> · Sharpness −2</div>
                  <div className="p-2 rounded bg-muted/30">Mental Prep → <StatBadge abbr="FOC" color="text-primary" /> primary · Sharpness +15</div>
                </div>
                <p className="text-xs border-l-2 border-accent/30 pl-3">
                  <strong>Meditation</strong> is a special recovery action: no stat gains, but
                  <strong> −25 fatigue</strong> and <strong>+15 sharpness</strong>. Use it when
                  your fatigue is too high or you need a sharpness boost before a race.
                </p>
                <p>
                  <strong>Diminishing returns:</strong> The closer a stat is to 80, the less
                  you gain per session. Early training is efficient; maxing a stat takes dedication.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Condition */}
            <AccordionItem value="condition">
              <AccordionTrigger className="text-foreground">
                What are Fatigue and Sharpness?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  <strong>Fatigue</strong> (0–100) builds up when you train physical activities.
                  Higher fatigue penalizes race performance. It decays naturally over time at a
                  <strong> scaled rate</strong> — light fatigue (under 30) decays slowly (~3/day),
                  while heavy fatigue (60+) decays faster (~15/day). This means you recover from
                  over-training faster than you might expect.
                </p>
                <p>
                  <strong>Sharpness</strong> (0–100) is a strategic variable — different training
                  activities affect it differently. Physical activities like Sprint Drills <em>decrease</em> sharpness,
                  while mental activities like Mental Prep and Meditation <em>increase</em> it.
                  After your last action, sharpness holds steady for <strong>12 hours</strong>, then
                  decays at ~15 points per day. Train recently before a race to stay sharp.
                </p>
                <p className="text-xs border-l-2 border-primary/30 pl-3">
                  <strong>Race impact:</strong> Fatigue applies a penalty up to -50% (at max fatigue).
                  Sharpness has a wider modifier: from <strong>×0.80</strong> (at 0 sharpness — a 20% penalty)
                  up to <strong>×1.05</strong> (at 100 sharpness — a 5% bonus). The sweet spot is balancing
                  physical training for stats with mental training to keep sharpness high before race day.
                </p>
                <p className="text-xs">
                  <strong>Recovery options:</strong> Use <strong>Meditation</strong> (a training action that
                  reduces fatigue by 25 and boosts sharpness by 15), or visit the <strong>Treatment Center</strong> for
                  deeper recovery with lockout-based treatments.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Treatment Center */}
            <AccordionItem value="treatment">
              <AccordionTrigger className="text-foreground">
                What is the Treatment Center?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  The Treatment Center offers <strong>deep recovery</strong> for creatures that have
                  accumulated too much fatigue or lost sharpness. Unlike Meditation (which uses a
                  training action), treatments are <strong>lockout-based</strong> — your creature
                  can't train or race during the treatment period, but the recovery is much more powerful.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
                    <p className="font-semibold text-yellow-400 mb-1">Stim Pack — 6 hour lockout</p>
                    <p>Reduces fatigue by 20 points. Sharpness unchanged. Quick fix between races.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-400/5 border border-cyan-400/20">
                    <p className="font-semibold text-cyan-400 mb-1">Cryo Pod — 12 hour lockout</p>
                    <p>Reduces fatigue by 40 points. Sets sharpness to 50. Solid overnight recovery.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-violet-400/5 border border-violet-400/20">
                    <p className="font-semibold text-violet-400 mb-1">Full Reset — 24 hour lockout</p>
                    <p>Fatigue goes to 0. Sharpness set to 30. Complete recovery but costs a full day.</p>
                  </div>
                </div>
                <p className="text-xs border-l-2 border-destructive/30 pl-3">
                  <strong>Strategic cost:</strong> In a weekly season, a 24h Full Reset costs
                  1/7th of your season — that's a real strategic decision, not a casual click.
                  Treatments are best reserved for when you've dug yourself into a fatigue hole
                  and need a reset before a big race.
                </p>
                <p>
                  Treatment effects are applied automatically when the timer completes. Your creature
                  will be ready to train and race immediately after.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Race Types */}
            <AccordionItem value="race-types">
              <AccordionTrigger className="text-foreground">
                What do different race types mean?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Each race type weights the six stats differently. Your {creatureSingular}'s <strong>effective
                  stats</strong> are multiplied by these weights to produce a <strong>Base Power</strong> score.
                  The higher the weight, the more that stat matters.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg bg-race-sprint/5 border border-race-sprint/20">
                    <p className="font-semibold text-race-sprint mb-1">Sprint</p>
                    <p>Heavily favors <StatBadge abbr="SPD" color="text-race-sprint" /> and <StatBadge abbr="ACC" color="text-race-technical" />.
                    Fast starters with raw speed dominate.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-race-distance/5 border border-race-distance/20">
                    <p className="font-semibold text-race-distance mb-1">Distance</p>
                    <p>Heavily favors <StatBadge abbr="STM" color="text-race-distance" /> and <StatBadge abbr="HRT" color="text-secondary" />.
                    Endurance and grit win the long race.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-race-technical/5 border border-race-technical/20">
                    <p className="font-semibold text-race-technical mb-1">Technical</p>
                    <p>Favors <StatBadge abbr="ACC" color="text-race-technical" />, <StatBadge abbr="AGI" color="text-race-mixed" />, and <StatBadge abbr="FOC" color="text-primary" />.
                    Precision and consistency matter here.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-race-mixed/5 border border-race-mixed/20">
                    <p className="font-semibold text-race-mixed mb-1">Mixed</p>
                    <p>Balanced weights across all stats. Well-rounded {creatureSingular}s perform best.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-race-hazard/5 border border-race-hazard/20">
                    <p className="font-semibold text-race-hazard mb-1">Hazard</p>
                    <p>Favors <StatBadge abbr="AGI" color="text-race-mixed" />, <StatBadge abbr="HRT" color="text-secondary" />, and <StatBadge abbr="FOC" color="text-primary" />.
                    Survival and adaptability over raw speed.</p>
                  </div>
                </div>
                <p className="text-xs">
                  Exact weights are configured per season and visible in the score breakdown
                  after each race. Key stats (weight 0.20+) are highlighted.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Scoring */}
            <AccordionItem value="scoring">
              <AccordionTrigger className="text-foreground">
                How is my race score calculated?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>The scoring formula has four components:</p>
                <div className="font-mono text-xs bg-muted/30 rounded-lg p-3 text-foreground">
                  Final = Base Power × Fatigue Mod × Sharpness Mod × (1 + Luck)
                </div>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Base Power</strong> — Each effective stat multiplied by the race type's
                    weight for that stat, then summed. This is your raw ability score.
                  </p>
                  <p>
                    <strong>Fatigue Modifier</strong> — Ranges from ×1.00 (fresh) to ×0.50
                    (exhausted). Formula: 1.0 - (fatigue / 200).
                  </p>
                  <p>
                    <strong>Sharpness Modifier</strong> — Ranges from <strong>×0.80</strong> (completely
                    rusty) to <strong>×1.05</strong> (peak sharpness). At sharpness 50 you're at ×0.925.
                    This is a much wider swing than fatigue — keeping sharpness high is critical.
                  </p>
                  <p>
                    <strong>Luck</strong> — A deterministic random factor seeded from the Ergo block
                    hash, making results verifiable on-chain. The <StatBadge abbr="FOC" color="text-primary" /> stat
                    compresses this variance: high Focus means less swing (safer), low Focus means
                    higher highs and lower lows (riskier).
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Race Entries */}
            <AccordionItem value="race-entries">
              <AccordionTrigger className="text-foreground">
                How do race entries work?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  To enter a race, pick an open race from the Races page, select one of your
                  {' '}{collectionName}, and confirm entry. Your creature's current stats, fatigue, and
                  sharpness are <strong>snapshotted</strong> at entry time — training after
                  entering won't change your race stats.
                </p>
                <p>
                  <strong>One entry per creature per race.</strong> You can enter multiple
                  creatures into the same race if you own more than one.
                </p>
                <p className="text-xs border-l-2 border-destructive/30 pl-3">
                  <strong>No withdrawals, no refunds.</strong> Once you enter a race, your entry
                  is locked. Choose wisely — check your creature's condition and the race type
                  before committing. When entry fees are active, your fee goes into the prize
                  pool and is distributed to finishers.
                </p>
                <p>
                  Races require at least 2 entries to run. If a race doesn't reach minimum
                  entries, it's cancelled by the admin.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Rewards & Boosts */}
            <AccordionItem value="rewards">
              <AccordionTrigger className="text-foreground">
                What rewards do I get from racing?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>Every finisher earns a reward based on placement:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2 rounded bg-race-sprint/10 border border-race-sprint/20">
                    <span className="text-race-sprint font-semibold">1st Place</span>
                    <span>+1 Bonus Action</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded bg-primary/10 border border-primary/20">
                    <span className="text-primary font-semibold">2nd Place</span>
                    <span>+50% Training Boost</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded bg-secondary/10 border border-secondary/20">
                    <span className="text-secondary font-semibold">3rd Place</span>
                    <span>+25% Training Boost</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded bg-muted/30 border border-border/30">
                    <span className="text-muted-foreground font-semibold">4th+</span>
                    <span>+10% Training Boost</span>
                  </div>
                </div>
                <p>
                  <strong>Bonus Actions</strong> give you an extra training session that day,
                  bypassing cooldown and daily limits.
                </p>
                <p>
                  <strong>Training Boosts</strong> are like UTXO reward boxes — each is a separate
                  item you can selectively spend when training. They multiply your stat gains
                  (e.g., a +50% boost turns a +2.0 gain into +3.0). Stack multiple boosts for
                  bigger gains.
                </p>
                <p className="text-xs border-l-2 border-destructive/30 pl-3">
                  Boosts expire after ~3 days (2160 Ergo blocks). Use them or lose them!
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Rarity — collection-specific */}
            <AccordionItem value="rarity">
              <AccordionTrigger className="text-foreground">
                Does NFT rarity matter?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Yes — rarity determines your {creatureSingular}'s <strong>base stats</strong>. Rarer
                  {' '}{collectionName.toLowerCase()} start with higher base values, giving them a natural
                  advantage. But because of the total trained stat cap (300), commons can still
                  compete by specializing their training build for specific race types.
                </p>
                {isCyberPets ? (
                  <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase">
                    <span className="px-2 py-1 rounded bg-muted/30 text-muted-foreground">Common</span>
                    <span className="px-2 py-1 rounded bg-rarity-uncommon/10 text-rarity-uncommon">Uncommon</span>
                    <span className="px-2 py-1 rounded bg-rarity-rare/10 text-rarity-rare">Rare</span>
                    <span className="px-2 py-1 rounded bg-rarity-rare/10 text-rarity-rare">Masterwork</span>
                    <span className="px-2 py-1 rounded bg-rarity-epic/10 text-rarity-epic">Epic</span>
                    <span className="px-2 py-1 rounded bg-rarity-epic/10 text-rarity-epic">Relic</span>
                    <span className="px-2 py-1 rounded bg-rarity-legendary/10 text-rarity-legendary">Legendary</span>
                    <span className="px-2 py-1 rounded bg-rarity-mythic/10 text-rarity-mythic">Mythic</span>
                    <span className="px-2 py-1 rounded bg-primary/10 text-primary">Cyberium</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase">
                    <span className="px-2 py-1 rounded bg-muted/30 text-muted-foreground">Common (30%)</span>
                    <span className="px-2 py-1 rounded bg-rarity-uncommon/10 text-rarity-uncommon">Uncommon (30%)</span>
                    <span className="px-2 py-1 rounded bg-rarity-rare/10 text-rarity-rare">Rare (20%)</span>
                    <span className="px-2 py-1 rounded bg-rarity-epic/10 text-rarity-epic">Epic (12%)</span>
                    <span className="px-2 py-1 rounded bg-rarity-legendary/10 text-rarity-legendary">Legendary (6%)</span>
                    <span className="px-2 py-1 rounded bg-rarity-mythic/10 text-rarity-mythic">Mythic (2%)</span>
                  </div>
                )}
                <p>
                  A well-trained Common focused on speed can beat an untrained {isCyberPets ? 'Epic' : 'Mythic'} in a sprint.
                  Strategy matters as much as rarity.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Focus & Luck */}
            <AccordionItem value="focus-luck">
              <AccordionTrigger className="text-foreground">
                How does Focus affect luck variance?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  The luck factor in races is a deterministic random value seeded from the Ergo
                  block hash — it's verifiable, not truly random. <StatBadge abbr="FOC" color="text-primary" />
                  controls how much this luck can swing your score:
                </p>
                <ul className="space-y-1 text-sm list-disc list-inside">
                  <li><strong>Low Focus:</strong> Up to ±30% swing. High risk, high reward.</li>
                  <li><strong>High Focus:</strong> Minimal swing. Consistent, reliable performance.</li>
                </ul>
                {isCyberPets ? (
                  <p>
                    Focus comes from your CyberPet's <strong>material quality</strong>. Cyberium
                    and Diamond materials give higher base Focus than Silver or Golden.
                  </p>
                ) : (
                  <p>
                    For Aneta Angels, Focus comes from <strong>Skin Tone</strong> (Tone 1 = high
                    Focus 0.85, Tone 4 = low Focus 0.40). It's equally distributed across the
                    collection and operates independently of the stat budget — a strategic property,
                    not a power advantage.
                  </p>
                )}
                <p>
                  Think of Focus as "consistency insurance." If your {creatureSingular} has strong base stats,
                  you might want high Focus to protect that lead. If you're the underdog, low
                  Focus gives you a chance to upset — or crash spectacularly.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Seasons */}
            <AccordionItem value="seasons">
              <AccordionTrigger className="text-foreground">
                What happens each season?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Seasons run for a set period (typically ~30 days). When a new season starts:
                </p>
                <ul className="space-y-1 text-sm list-disc list-inside">
                  <li>All trained stats reset to zero</li>
                  <li>Fatigue and sharpness reset</li>
                  <li>Boosts and bonus actions clear</li>
                  <li>Leaderboard resets</li>
                  <li>Base stats (from your NFT) stay the same</li>
                </ul>
                <p>
                  This keeps the game fresh and gives new players a fair shot each season.
                  Seasons may also introduce modifiers — rule changes that shake up the meta.
                  Each collection has its own independent season.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Blockchain */}
            <AccordionItem value="blockchain">
              <AccordionTrigger className="text-foreground">
                How does the Ergo blockchain fit in?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  {collectionName} are NFTs on the Ergo blockchain. The game uses the chain for:
                </p>
                <ul className="space-y-1 text-sm list-disc list-inside">
                  <li><strong>Ownership verification</strong> — Your wallet proves you own each {creatureSingular}</li>
                  <li><strong>Deterministic RNG</strong> — Race outcomes are seeded from Ergo block hashes,
                  making results provably fair and verifiable</li>
                  <li><strong>Boost expiry</strong> — Boosts expire based on Ergo block height, not wall-clock time</li>
                  {!isCyberPets && (
                    <li><strong>On-chain rarity</strong> — Aneta Angels rarity scores are frozen in an AVL tree
                    on-chain, making them independently verifiable by anyone</li>
                  )}
                </ul>
                <p>
                  Connect your Nautilus wallet to get started. Your {collectionName} are auto-discovered
                  from your wallet balance.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* Aneta Angels: On-Chain Verification — only show for angels */}
            {!isCyberPets && (
              <AccordionItem value="verification">
                <AccordionTrigger className="text-foreground">
                  How can I verify rarity scores on-chain?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-3">
                  <p>
                    The rarity scores are frozen on the Ergo blockchain in a single box containing:
                  </p>
                  <ul className="space-y-1 text-sm list-disc list-inside">
                    <li><strong>R4:</strong> AVL tree root hash — cryptographic fingerprint of all 4,406 token scores</li>
                    <li><strong>R5:</strong> SHA-256 hash of the scoring methodology document</li>
                    <li><strong>R6:</strong> URL to the full scored dataset</li>
                  </ul>
                  <p>
                    If a single trait score, tier assignment, or focus value were changed,
                    the root hash would not match. The methodology hash proves the formula
                    itself hasn't been altered. The scoring script is open source and anyone
                    can independently reproduce the results from on-chain trait data.
                  </p>
                </AccordionContent>
              </AccordionItem>
            )}

          </Accordion>
        </div>
      </div>
    </MainLayout>
  );
}
