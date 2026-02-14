/**
 * Per-collection game config resolution.
 *
 * Fallback chain: collection game_config_overrides → global game_config → hardcoded defaults.
 * Deep merge at the key level — collection overrides replace, not append.
 */
import { supabase } from './supabase.js';

/**
 * Get the merged game config for a collection.
 * If no collectionId, returns the global config only.
 */
export async function getGameConfig(collectionId?: string): Promise<Record<string, any>> {
  // 1. Fetch global game_config (single row, id=1)
  const { data: gameConfig } = await supabase
    .from('game_config')
    .select('config')
    .limit(1)
    .single();

  const globalConfig = gameConfig?.config ?? {};

  if (!collectionId) return globalConfig;

  // 2. Fetch collection overrides
  const { data: collection } = await supabase
    .from('collections')
    .select('game_config_overrides')
    .eq('id', collectionId)
    .single();

  const overrides = collection?.game_config_overrides ?? {};
  if (!overrides || Object.keys(overrides).length === 0) return globalConfig;

  // 3. Deep merge: overrides replace global at key level
  return deepMerge(globalConfig, overrides);
}

function deepMerge(
  base: Record<string, any>,
  override: Record<string, any>,
): Record<string, any> {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      override[key] &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}
