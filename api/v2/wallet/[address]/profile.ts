import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../../_lib/supabase.js';

// Allowed: Unicode letters, digits, spaces, hyphens, underscores. 2-20 chars.
const NAME_REGEX = /^[\p{L}\p{N} _-]{2,20}$/u;

function isErgoAddress(s: string): boolean {
  return s.length === 51 && s.startsWith('9');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const address = req.query.address as string;
  if (!address) {
    return res.status(400).json({ error: 'address is required' });
  }

  // GET — fetch display name for a wallet
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('wallet_profiles')
      .select('address, display_name')
      .eq('address', address)
      .single();

    if (error || !data) {
      return res.status(200).json({ address, displayName: null });
    }

    return res.status(200).json({
      address: data.address,
      displayName: data.display_name,
    });
  }

  // PUT — set or clear display name
  if (req.method === 'PUT') {
    const { walletAddress, displayName } = req.body ?? {};

    // Auth: caller must own this address
    if (!walletAddress || walletAddress !== address) {
      return res.status(403).json({ error: 'walletAddress must match the URL address' });
    }

    // Clear name
    if (displayName === null || displayName === '') {
      const { error } = await supabase
        .from('wallet_profiles')
        .delete()
        .eq('address', address);

      if (error) {
        console.error('Delete wallet profile error:', error);
        return res.status(500).json({ error: 'Failed to clear display name' });
      }
      return res.status(200).json({ address, displayName: null });
    }

    // Validate
    const trimmed = typeof displayName === 'string' ? displayName.trim() : '';
    if (!NAME_REGEX.test(trimmed)) {
      return res.status(400).json({
        error: 'Display name must be 2-20 characters. Letters, digits, spaces, hyphens, and underscores only.',
      });
    }
    if (isErgoAddress(trimmed)) {
      return res.status(400).json({
        error: 'Display name cannot look like a wallet address.',
      });
    }

    // Upsert
    const { data, error } = await supabase
      .from('wallet_profiles')
      .upsert(
        { address, display_name: trimmed, updated_at: new Date().toISOString() },
        { onConflict: 'address' },
      )
      .select('address, display_name')
      .single();

    if (error) {
      // Unique violation on case-insensitive display_name index
      if (error.code === '23505') {
        return res.status(409).json({ error: 'That display name is already taken.' });
      }
      console.error('Upsert wallet profile error:', error);
      return res.status(500).json({ error: 'Failed to save display name' });
    }

    return res.status(200).json({
      address: data.address,
      displayName: data.display_name,
    });
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or PUT.' });
}
