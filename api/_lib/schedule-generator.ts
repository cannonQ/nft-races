/**
 * Race schedule generator — pure function, no DB/Supabase.
 *
 * Takes a ScheduleTemplate + date range → returns flat array of GeneratedRace[].
 * Same array feeds both Phase 1 (supabase.insert) and Phase 2 (TX builder).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RaceType = 'sprint' | 'distance' | 'technical' | 'mixed' | 'hazard';
export type RarityClass = 'rookie' | 'contender' | 'champion';

export interface ScheduleTemplate {
  name: string;
  openRacesPerDay: number;
  defaultMaxEntries: number;
  deadlineSpacingMinutes: number;
  dayStartHourUtc: number;
  typeRotation: RaceType[];
  autoResolve: boolean;
  classRaces: {
    rookie: { perDay: number; maxEntries: number; typeRotation: RaceType[] };
    contender: { totalPerSeason: number; maxEntries: number; typeRotation: RaceType[] };
    champion: { totalPerSeason: number; maxEntries: number; typeRotation: RaceType[] };
  };
  naming: {
    mode: 'template' | 'explicit';
    template: string;
    classTemplate?: string;
    customNames?: string[];
  };
  fees: {
    entryFeeNanoerg?: number | null;
    entryFeeToken?: number | null;
  } | null;
}

export interface GeneratedRace {
  index: number;
  name: string;
  raceType: RaceType;
  entryDeadline: string;
  maxEntries: number;
  rarityClass: RarityClass | null;
  autoResolve: boolean;
  entryFeeNanoerg: number;
  entryFeeToken: number | null;
  day: number;
  slot: number;
}

// ---------------------------------------------------------------------------
// Default template — standard 7-day season
// ---------------------------------------------------------------------------

export const DEFAULT_SCHEDULE_TEMPLATE: ScheduleTemplate = {
  name: 'Standard 7-Day',
  openRacesPerDay: 4,
  defaultMaxEntries: 8,
  deadlineSpacingMinutes: 360,  // 6h for 4 races/day
  dayStartHourUtc: 6,
  typeRotation: ['sprint', 'hazard', 'distance', 'technical', 'mixed'],
  autoResolve: true,
  classRaces: {
    rookie: { perDay: 1, maxEntries: 8, typeRotation: ['sprint', 'distance', 'technical', 'mixed', 'hazard'] },
    contender: { totalPerSeason: 3, maxEntries: 8, typeRotation: ['sprint', 'distance', 'hazard'] },
    champion: { totalPerSeason: 1, maxEntries: 8, typeRotation: ['technical'] },
  },
  naming: {
    mode: 'template',
    template: '{type} Showdown #{n}',
    classTemplate: '{class} {type} Cup #{n}',
  },
  fees: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_RACE_TYPES: RaceType[] = ['sprint', 'distance', 'technical', 'mixed', 'hazard'];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function applyNameTemplate(
  template: string,
  vars: { type: string; n: number; day: number; slot: number; class?: string },
): string {
  let result = template;
  result = result.replace(/\{type\}/g, capitalize(vars.type));
  result = result.replace(/\{n\}/g, String(vars.n));
  result = result.replace(/\{day\}/g, String(vars.day));
  result = result.replace(/\{slot\}/g, String(vars.slot));
  if (vars.class) {
    result = result.replace(/\{class\}/g, capitalize(vars.class));
  }
  return result;
}

function cycleNext<T>(arr: T[], counter: number): T {
  if (arr.length === 0) return arr[0]; // shouldn't happen but defensive
  return arr[counter % arr.length];
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

export function generateSchedule(
  template: ScheduleTemplate,
  startDate: Date,
  endDate: Date,
  defaults: { entryFeeNanoerg: number; entryFeeToken: number | null },
): GeneratedRace[] {
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay));

  const races: GeneratedRace[] = [];

  // Global index counter for numbering
  let globalIndex = 0;

  // Independent rotation counters per category
  let openRotation = 0;
  let rookieRotation = 0;
  let contenderRotation = 0;
  let championRotation = 0;

  // Per-class global name counters
  let openNameN = 0;
  let rookieNameN = 0;
  let contenderNameN = 0;
  let championNameN = 0;

  // Custom name index
  let customNameIdx = 0;

  // Fee resolution
  const feeNanoerg = template.fees?.entryFeeNanoerg ?? defaults.entryFeeNanoerg;
  const feeToken = template.fees?.entryFeeToken ?? defaults.entryFeeToken;

  // Contender/champion even distribution tracking
  const contenderTotal = template.classRaces.contender.totalPerSeason;
  const championTotal = template.classRaces.champion.totalPerSeason;

  for (let d = 1; d <= totalDays; d++) {
    // Base time for this day
    const dayStartMs = startDate.getTime() + (d - 1) * msPerDay;
    const dayBase = new Date(dayStartMs);
    dayBase.setUTCHours(template.dayStartHourUtc, 0, 0, 0);

    let daySlot = 0;

    // --- Open races ---
    for (let i = 0; i < template.openRacesPerDay; i++) {
      daySlot++;
      openNameN++;
      const rType = cycleNext(template.typeRotation, openRotation++);
      const deadline = new Date(dayBase.getTime() + i * template.deadlineSpacingMinutes * 60 * 1000);

      const name = getName(template, null, rType, openNameN, d, daySlot);

      races.push({
        index: globalIndex++,
        name,
        raceType: rType,
        entryDeadline: deadline.toISOString(),
        maxEntries: template.defaultMaxEntries,
        rarityClass: null,
        autoResolve: template.autoResolve,
        entryFeeNanoerg: feeNanoerg,
        entryFeeToken: feeToken,
        day: d,
        slot: daySlot,
      });
    }

    // --- Rookie races (perDay) ---
    for (let i = 0; i < template.classRaces.rookie.perDay; i++) {
      daySlot++;
      rookieNameN++;
      const rType = cycleNext(template.classRaces.rookie.typeRotation, rookieRotation++);
      // Place after last open race slot
      const offset = (template.openRacesPerDay + i) * template.deadlineSpacingMinutes * 60 * 1000;
      const deadline = new Date(dayBase.getTime() + offset);

      const name = getName(template, 'rookie', rType, rookieNameN, d, daySlot);

      races.push({
        index: globalIndex++,
        name,
        raceType: rType,
        entryDeadline: deadline.toISOString(),
        maxEntries: template.classRaces.rookie.maxEntries,
        rarityClass: 'rookie',
        autoResolve: template.autoResolve,
        entryFeeNanoerg: feeNanoerg,
        entryFeeToken: feeToken,
        day: d,
        slot: daySlot,
      });
    }

    // --- Contender races (evenly distributed) ---
    // Place when floor(d * total / totalDays) > floor((d-1) * total / totalDays)
    if (contenderTotal > 0) {
      const soFar = Math.floor(d * contenderTotal / totalDays);
      const prev = Math.floor((d - 1) * contenderTotal / totalDays);
      const toCreate = soFar - prev;
      for (let i = 0; i < toCreate; i++) {
        daySlot++;
        contenderNameN++;
        const rType = cycleNext(template.classRaces.contender.typeRotation, contenderRotation++);
        const offset = (template.openRacesPerDay + template.classRaces.rookie.perDay + i) * template.deadlineSpacingMinutes * 60 * 1000;
        const deadline = new Date(dayBase.getTime() + offset);

        const name = getName(template, 'contender', rType, contenderNameN, d, daySlot);

        races.push({
          index: globalIndex++,
          name,
          raceType: rType,
          entryDeadline: deadline.toISOString(),
          maxEntries: template.classRaces.contender.maxEntries,
          rarityClass: 'contender',
          autoResolve: template.autoResolve,
          entryFeeNanoerg: feeNanoerg,
          entryFeeToken: feeToken,
          day: d,
          slot: daySlot,
        });
      }
    }

    // --- Champion races (evenly distributed) ---
    if (championTotal > 0) {
      const soFar = Math.floor(d * championTotal / totalDays);
      const prev = Math.floor((d - 1) * championTotal / totalDays);
      const toCreate = soFar - prev;
      for (let i = 0; i < toCreate; i++) {
        daySlot++;
        championNameN++;
        const rType = cycleNext(template.classRaces.champion.typeRotation, championRotation++);
        const offset = (template.openRacesPerDay + template.classRaces.rookie.perDay + i + 1) * template.deadlineSpacingMinutes * 60 * 1000;
        const deadline = new Date(dayBase.getTime() + offset);

        const name = getName(template, 'champion', rType, championNameN, d, daySlot);

        races.push({
          index: globalIndex++,
          name,
          raceType: rType,
          entryDeadline: deadline.toISOString(),
          maxEntries: template.classRaces.champion.maxEntries,
          rarityClass: 'champion',
          autoResolve: template.autoResolve,
          entryFeeNanoerg: feeNanoerg,
          entryFeeToken: feeToken,
          day: d,
          slot: daySlot,
        });
      }
    }
  }

  return races;
}

function getName(
  template: ScheduleTemplate,
  rarityClass: RarityClass | null,
  raceType: RaceType,
  n: number,
  day: number,
  slot: number,
): string {
  // Explicit names list
  if (template.naming.mode === 'explicit' && template.naming.customNames?.length) {
    // Use custom name if available, fall back to template
    const idx = n - 1; // n is 1-based
    if (idx < template.naming.customNames.length) {
      return template.naming.customNames[idx];
    }
  }

  // Template mode
  const tpl = rarityClass
    ? (template.naming.classTemplate || '{class} {type} Cup #{n}')
    : template.naming.template;

  return applyNameTemplate(tpl, { type: raceType, n, day, slot, class: rarityClass ?? undefined });
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

export function validateRaceType(t: string): t is RaceType {
  return VALID_RACE_TYPES.includes(t as RaceType);
}

export function validateRarityClass(c: string): c is RarityClass {
  return ['rookie', 'contender', 'champion'].includes(c);
}
