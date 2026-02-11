import { MainLayout } from '@/components/layout/MainLayout';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

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
  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            How It Works
          </h1>
          <p className="text-muted-foreground">
            Everything you need to know about training, racing, and boosting your CyberPets.
          </p>
        </div>

        {/* Overview */}
        <div className="cyber-card rounded-xl p-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-foreground">The Basics</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            CyberPets Racing is a seasonal competitive game built on the Ergo blockchain.
            You own CyberPet NFTs, train them to build stats, enter races to compete, and
            earn rewards that make your pets even stronger. Each season resets trained stats,
            so everyone starts fresh — but your NFT's base stats are permanent.
          </p>
        </div>

        {/* Stats */}
        <div className="cyber-card rounded-xl p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">The Six Stats</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Every CyberPet has six stats. <strong>Base stats</strong> come from your NFT's
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

        {/* Base Stats Comparison */}
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

          {/* Rarity stat budget table */}
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

          {/* Side-by-side example */}
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider pt-2">
            Example: Common vs Epic
          </p>
          <div className="grid grid-cols-2 gap-4">
            {/* Common Example */}
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

            {/* Epic Example */}
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
                  matches the stats you want to develop.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/30">Sprint Drills → <StatBadge abbr="SPD" color="text-race-sprint" /> primary</div>
                  <div className="p-2 rounded bg-muted/30">Distance Runs → <StatBadge abbr="STM" color="text-race-distance" /> primary</div>
                  <div className="p-2 rounded bg-muted/30">Gate Work → <StatBadge abbr="ACC" color="text-race-technical" /> primary</div>
                  <div className="p-2 rounded bg-muted/30">Agility Course → <StatBadge abbr="AGI" color="text-race-mixed" /> primary</div>
                  <div className="p-2 rounded bg-muted/30">Cross-Training → <StatBadge abbr="STM" color="text-race-distance" /> + <StatBadge abbr="HRT" color="text-secondary" /></div>
                  <div className="p-2 rounded bg-muted/30">Mental Prep → <StatBadge abbr="FOC" color="text-primary" /> primary</div>
                </div>
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
                  <strong>Fatigue</strong> (0–100) builds up when you train. Higher fatigue
                  penalizes race performance. It decays naturally over time (~3 points per day).
                  Manage when you train relative to race day.
                </p>
                <p>
                  <strong>Sharpness</strong> (0–100) increases when you train. Higher sharpness
                  boosts race performance. It stays high for 24 hours after training, then decays
                  (~10 points per day). Train recently before a race to stay sharp.
                </p>
                <p className="text-xs border-l-2 border-primary/30 pl-3">
                  <strong>Race impact:</strong> Fatigue applies a penalty up to -50% (at max fatigue).
                  Sharpness applies a bonus from -10% (at 0) to 0% (at 100). The sweet spot is
                  training recently enough to be sharp, but not so much that fatigue drags you down.
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
                  Each race type weights the six stats differently. Your pet's <strong>effective
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
                    <p>Balanced weights across all stats. Well-rounded pets perform best.</p>
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
                    <strong>Sharpness Modifier</strong> — Ranges from ×0.90 (rusty) to ×1.00
                    (peak). Formula: 0.90 + (sharpness / 1000).
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
                  CyberPets, and confirm entry. Your creature's current stats, fatigue, and
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

            {/* Rarity */}
            <AccordionItem value="rarity">
              <AccordionTrigger className="text-foreground">
                Does NFT rarity matter?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-3">
                <p>
                  Yes — rarity determines your pet's <strong>base stats</strong>. Rarer pets
                  start with higher base values, giving them a natural advantage. But because of
                  the total trained stat cap (300), commons can still compete by specializing
                  their training build for specific race types.
                </p>
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
                <p>
                  A well-trained Common focused on speed can beat an untrained Epic in a sprint.
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
                <p>
                  Think of Focus as "consistency insurance." If your pet has strong base stats,
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
                  CyberPets are NFTs on the Ergo blockchain. The game uses the chain for:
                </p>
                <ul className="space-y-1 text-sm list-disc list-inside">
                  <li><strong>Ownership verification</strong> — Your wallet proves you own each pet</li>
                  <li><strong>Deterministic RNG</strong> — Race outcomes are seeded from Ergo block hashes,
                  making results provably fair and verifiable</li>
                  <li><strong>Boost expiry</strong> — Boosts expire based on Ergo block height, not wall-clock time</li>
                </ul>
                <p>
                  Connect your Nautilus wallet to get started. Your CyberPets are auto-discovered
                  from your wallet balance.
                </p>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      </div>
    </MainLayout>
  );
}
