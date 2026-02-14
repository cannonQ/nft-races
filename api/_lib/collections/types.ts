/**
 * Generic collection loader interface.
 *
 * Each NFT collection implements this interface to plug into the racing platform.
 * Adding a new collection = one loader module + one DB row + a JSON data file.
 */

export interface TokenEntry {
  token_id: string;
  name: string;
  [key: string]: any;
}

export type StatName = 'speed' | 'stamina' | 'accel' | 'agility' | 'heart' | 'focus';
export type Stats = Record<StatName, number>;

export const STAT_KEYS: StatName[] = ['speed', 'stamina', 'accel', 'agility', 'heart', 'focus'];

export interface CollectionLoader {
  /** Collection slug — used in URLs, logs, and as a registry key. Must match DB `collections.name`. */
  readonly slug: string;

  /** Check if a token_id belongs to this collection's circulating set. */
  isToken(tokenId: string): boolean;

  /** Get a token entry by token_id, or undefined if not found. */
  getToken(tokenId: string): TokenEntry | undefined;

  /** Parse traits from a token entry. Returns null if parsing fails. */
  parseTraits(token: TokenEntry): Record<string, any> | null;

  /** Compute base stats from parsed traits + DB-stored template/mapping. */
  computeBaseStats(
    traits: Record<string, any>,
    baseStatTemplate: Record<string, any>,
    traitMapping: Record<string, any>,
  ): Stats;

  /** Build the metadata object stored in `creatures.metadata` at registration time. */
  buildMetadata(token: TokenEntry, traits: Record<string, any>): Record<string, any>;

  /** Get the image URL for a creature from its stored metadata. */
  getImageUrl(metadata: Record<string, any>): string | undefined;

  /** Get the fallback image URL (used when primary fails). */
  getFallbackImageUrl(metadata: Record<string, any>): string | undefined;

  /** Get the display name from stored metadata, with a fallback. */
  getDisplayName(metadata: Record<string, any>, fallbackName: string): string;

  /** Extract the rarity string from parsed traits. */
  getRarity(traits: Record<string, any>): string;
}
