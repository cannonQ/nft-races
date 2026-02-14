/**
 * Collection loader registry.
 *
 * Maps collection names (matching DB `collections.name`) to their loader instances.
 * Adding a new collection = import its loader here + add to the array.
 */

import type { CollectionLoader } from './types.js';
import { CyberPetsLoader } from './cyberpets.js';
import { AnetaAngelsLoader } from './aneta-angels.js';

// ---------------------------------------------------------------------------
// Registry — instantiate loaders once at module scope
// ---------------------------------------------------------------------------

const loaders: CollectionLoader[] = [
  new CyberPetsLoader(),
  new AnetaAngelsLoader(),
];

const loadersBySlug = new Map<string, CollectionLoader>(
  loaders.map(l => [l.slug, l]),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get all registered collection loaders. */
export function getCollectionLoaders(): CollectionLoader[] {
  return loaders;
}

/** Get a loader by collection name/slug (must match DB `collections.name`). */
export function getLoaderBySlug(slug: string): CollectionLoader | undefined {
  return loadersBySlug.get(slug);
}

/** Find the loader that recognizes a given token_id. Returns undefined if no match. */
export function findLoaderForToken(tokenId: string): CollectionLoader | undefined {
  return loaders.find(l => l.isToken(tokenId));
}

// Re-export types for convenience
export type { CollectionLoader, TokenEntry, Stats, StatName } from './types.js';
export { STAT_KEYS } from './types.js';
