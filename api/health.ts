import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';
import { findBabelBoxes, getTokenPriceFromBox } from './_lib/babel-discovery.js';
import { TX_FEE, MIN_BOX_VALUE } from './_lib/ergo-tx-builder.js';

interface BabelStatus {
  tokenId: string;
  collectionName: string;
  boxCount: number;
  totalErgNanoerg: number;
  usableBoxes: number;
  tokenPriceNanoerg: string | null;
  healthy: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    // Fetch all collections with fee_token configs
    const { data: collections } = await supabase
      .from('collections')
      .select('id, name, game_config_overrides');

    const babelStatuses: BabelStatus[] = [];

    for (const col of (collections ?? [])) {
      const feeToken = col.game_config_overrides?.fee_token;
      if (!feeToken?.token_id) continue;

      const boxes = await findBabelBoxes(feeToken.token_id);
      const minRequired = TX_FEE + MIN_BOX_VALUE;
      const usableBoxes = boxes.filter(b => b.value >= minRequired + 1_000_000);

      let tokenPrice: string | null = null;
      if (boxes.length > 0) {
        try {
          tokenPrice = getTokenPriceFromBox(boxes[0]).toString();
        } catch { /* no price available */ }
      }

      babelStatuses.push({
        tokenId: feeToken.token_id,
        collectionName: col.name ?? 'Unknown',
        boxCount: boxes.length,
        totalErgNanoerg: boxes.reduce((sum, b) => sum + b.value, 0),
        usableBoxes: usableBoxes.length,
        tokenPriceNanoerg: tokenPrice,
        healthy: usableBoxes.length > 0,
      });
    }

    const allHealthy = babelStatuses.length === 0 || babelStatuses.every(b => b.healthy);

    return res.status(200).json({
      ok: allHealthy,
      time: new Date().toISOString(),
      babel: babelStatuses,
    });
  } catch (err) {
    console.error('GET /api/health error:', err);
    return res.status(200).json({
      ok: false,
      time: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
}
