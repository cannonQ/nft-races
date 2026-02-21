/**
 * CSV parser for race schedule import.
 *
 * Accepts CSV text + base date → returns parsed GeneratedRace[] with warnings.
 * Handles quoted fields, \r\n line endings, and flexible deadline formats.
 */

import type { GeneratedRace, RaceType, RarityClass } from './schedule-generator.js';
import { validateRaceType, validateRarityClass } from './schedule-generator.js';

// ---------------------------------------------------------------------------
// CSV template
// ---------------------------------------------------------------------------

export const CSV_TEMPLATE_HEADER = 'name,raceType,deadlineOffset,maxEntries,rarityClass,autoResolve,entryFeeToken';

// Comment block embedded at the top of the downloaded CSV for self-documentation
const CSV_GUIDE = `# ── Race Schedule CSV Guide ──
# name (REQUIRED): Race display name. Use quotes if it contains commas: "Sprint, Round 1"
# raceType (REQUIRED): sprint | distance | technical | mixed | hazard
# deadlineOffset: When the deadline is relative to Base Date. Formats:
#   +6h  +132h  +1d12h  +2d  +6h30m  (hours can exceed 24, minutes supported too)
#   Day 2 Slot 3              (day & slot number)
#   2026-03-01T18:00:00Z      (absolute ISO datetime)
#   (blank = sequential spacing from Base Date)
# maxEntries: minimum 2, no upper limit (default: 8)
# rarityClass: rookie | contender | champion (blank = open / any rarity)
# autoResolve: true | false (default: true)
# entryFeeToken: Override token fee for this race, e.g. 500 for high-stakes (blank = collection default)
#`;

export const CSV_TEMPLATE_ROWS = [
  'Sprint Showdown #1,sprint,,8,,,',
  'Distance Challenge #1,distance,+6h,8,,,',
  'Rookie Sprint Cup #1,sprint,+12h,8,rookie,,',
  'Champion Hazard Gauntlet,hazard,+1d,6,champion,,',
  '"High Stakes Showdown #1",mixed,+1d6h,12,,,500',
];

export function getCsvTemplate(): string {
  return [CSV_GUIDE, CSV_TEMPLATE_HEADER, ...CSV_TEMPLATE_ROWS].join('\n');
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

interface ParseResult {
  races: GeneratedRace[];
  warnings: string[];
}

export function parseRaceCsv(
  csv: string,
  baseDate: Date,
  spacingMinutes: number,
  defaults: { entryFeeNanoerg: number; entryFeeToken: number | null },
): ParseResult {
  const warnings: string[] = [];
  const races: GeneratedRace[] = [];

  // Normalize line endings and filter out comment lines (# prefix).
  // Excel wraps comment lines in quotes when they contain commas, so also
  // catch lines starting with "# (quoted comment) or BOM + # / BOM + "# .
  const lines = csv
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => {
      const t = l.trimStart().replace(/^\uFEFF/, '');
      return !t.startsWith('#') && !t.startsWith('"#');
    });

  if (lines.length === 0) {
    warnings.push('CSV is empty');
    return { races, warnings };
  }

  // Parse header
  const headerLine = lines[0].trim().toLowerCase();
  const headers = parseCsvLine(headerLine);

  const COL = {
    name: headers.indexOf('name'),
    raceType: headers.indexOf('racetype'),
    deadlineOffset: headers.indexOf('deadlineoffset'),
    maxEntries: headers.indexOf('maxentries'),
    rarityClass: headers.indexOf('rarityclass'),
    autoResolve: headers.indexOf('autoresolve'),
    entryFeeToken: headers.indexOf('entryfeetoken'),
  };

  if (COL.name === -1) {
    warnings.push('Missing required column: name');
    return { races, warnings };
  }
  if (COL.raceType === -1) {
    warnings.push('Missing required column: raceType');
    return { races, warnings };
  }

  let sequentialOffset = 0;
  let day = 1;
  let slot = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip blank lines

    const cols = parseCsvLine(line);
    const rowNum = i + 1;

    // Name (required)
    const name = getCol(cols, COL.name)?.trim();
    if (!name) {
      warnings.push(`Row ${rowNum}: missing name, skipped`);
      continue;
    }

    // Race type (required)
    const raceTypeRaw = getCol(cols, COL.raceType)?.trim().toLowerCase() ?? '';
    if (!validateRaceType(raceTypeRaw)) {
      warnings.push(`Row ${rowNum}: invalid raceType "${raceTypeRaw}", skipped`);
      continue;
    }
    const raceType = raceTypeRaw as RaceType;

    // Deadline offset (optional)
    const offsetStr = getCol(cols, COL.deadlineOffset)?.trim() ?? '';
    let deadline: Date;
    if (offsetStr) {
      const parsed = parseDeadlineOffset(offsetStr, baseDate, spacingMinutes);
      if (parsed.error) {
        warnings.push(`Row ${rowNum}: ${parsed.error}, using sequential offset`);
        deadline = new Date(baseDate.getTime() + sequentialOffset * spacingMinutes * 60 * 1000);
      } else {
        deadline = parsed.date!;
      }
    } else {
      deadline = new Date(baseDate.getTime() + sequentialOffset * spacingMinutes * 60 * 1000);
    }
    sequentialOffset++;

    // Compute day/slot from deadline
    const diffMs = deadline.getTime() - baseDate.getTime();
    day = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    slot++;

    // Max entries (optional, default 8)
    const maxEntriesRaw = getCol(cols, COL.maxEntries)?.trim();
    let maxEntries = 8;
    if (maxEntriesRaw) {
      const n = parseInt(maxEntriesRaw, 10);
      if (isNaN(n) || n < 2) {
        warnings.push(`Row ${rowNum}: maxEntries "${maxEntriesRaw}" must be at least 2, using 8`);
      } else {
        maxEntries = n;
      }
    }

    // Rarity class (optional)
    const rarityClassRaw = getCol(cols, COL.rarityClass)?.trim().toLowerCase() ?? '';
    let rarityClass: RarityClass | null = null;
    if (rarityClassRaw) {
      if (validateRarityClass(rarityClassRaw)) {
        rarityClass = rarityClassRaw as RarityClass;
      } else {
        warnings.push(`Row ${rowNum}: invalid rarityClass "${rarityClassRaw}", treating as open`);
      }
    }

    // Auto resolve (optional, default true)
    const autoResolveRaw = getCol(cols, COL.autoResolve)?.trim().toLowerCase();
    const autoResolve = autoResolveRaw === 'false' ? false : true;

    // Entry fee token (optional)
    const feeTokenRaw = getCol(cols, COL.entryFeeToken)?.trim();
    let entryFeeToken = defaults.entryFeeToken;
    if (feeTokenRaw) {
      const n = parseFloat(feeTokenRaw);
      if (!isNaN(n) && n >= 0) {
        entryFeeToken = n;
      } else {
        warnings.push(`Row ${rowNum}: invalid entryFeeToken "${feeTokenRaw}", using default`);
      }
    }

    races.push({
      index: races.length,
      name,
      raceType,
      entryDeadline: deadline.toISOString(),
      maxEntries,
      rarityClass,
      autoResolve,
      entryFeeNanoerg: defaults.entryFeeNanoerg,
      entryFeeToken,
      day,
      slot,
    });
  }

  return { races, warnings };
}

// ---------------------------------------------------------------------------
// Deadline offset parsing
// ---------------------------------------------------------------------------

interface OffsetResult {
  date?: Date;
  error?: string;
}

function parseDeadlineOffset(
  rawStr: string,
  baseDate: Date,
  spacingMinutes: number,
): OffsetResult {
  // Strip leading/trailing quotes (Excel apostrophe prefix can leak through some CSV editors)
  const str = rawStr.replace(/^['"`]+|['"`]+$/g, '');

  // Try "Day N Slot M" format
  const daySlotMatch = str.match(/^day\s+(\d+)\s+slot\s+(\d+)$/i);
  if (daySlotMatch) {
    const day = parseInt(daySlotMatch[1], 10);
    const slot = parseInt(daySlotMatch[2], 10);
    const offset = ((day - 1) * 24 * 60 + (slot - 1) * spacingMinutes) * 60 * 1000;
    return { date: new Date(baseDate.getTime() + offset) };
  }

  // Try relative "+Xh", "+Xd", "+XdYh", "+Xm" format (hours can exceed 24)
  const relMatch = str.match(/^\+(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$/i);
  if (relMatch && (relMatch[1] || relMatch[2] || relMatch[3])) {
    const days = parseInt(relMatch[1] || '0', 10);
    const hours = parseInt(relMatch[2] || '0', 10);
    const minutes = parseInt(relMatch[3] || '0', 10);
    const offsetMs = (days * 24 * 60 + hours * 60 + minutes) * 60 * 1000;
    return { date: new Date(baseDate.getTime() + offsetMs) };
  }

  // Try ISO datetime
  const isoDate = new Date(str);
  if (!isNaN(isoDate.getTime())) {
    return { date: isoDate };
  }

  return { error: `unrecognized deadline format "${str}"` };
}

// ---------------------------------------------------------------------------
// Simple CSV line parser (handles quoted fields)
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function getCol(cols: string[], idx: number): string | undefined {
  if (idx < 0 || idx >= cols.length) return undefined;
  return cols[idx];
}
