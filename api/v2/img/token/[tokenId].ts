import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCollectionLoaders } from '../../../_lib/collections/registry.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { tokenId } = req.query;
  const tid = Array.isArray(tokenId) ? tokenId[0] : tokenId;

  if (!tid || tid.length < 8) {
    return res.status(400).json({ error: 'Invalid token ID' });
  }

  // Find the loader that recognises this token and get its image URLs
  const loaders = getCollectionLoaders();
  let imageUrl: string | undefined;
  let fallbackUrl: string | undefined;

  for (const loader of loaders) {
    const token = loader.getToken(tid);
    if (token) {
      // Build a fake metadata to get the raw image URL
      const traits = loader.parseTraits(token);
      if (traits) {
        const metadata = loader.buildMetadata(token, traits);
        // Get the direct upstream URL (IPFS, etc.) — NOT the proxy URL
        imageUrl = metadata?.ipfsUrl;
        fallbackUrl = `https://api.ergexplorer.com/nftcache/${tid}`;
      }
      break;
    }
  }

  if (!imageUrl && !fallbackUrl) {
    // Generic fallback for any token
    fallbackUrl = `https://api.ergexplorer.com/nftcache/${tid}`;
  }

  const sources = [imageUrl, fallbackUrl].filter(Boolean) as string[];

  for (const url of sources) {
    try {
      // Upgrade http to https
      const secureUrl = url.replace(/^http:\/\//, 'https://');
      const upstream = await fetch(secureUrl, { signal: AbortSignal.timeout(8000) });
      if (!upstream.ok) continue;

      const contentType = upstream.headers.get('content-type') || 'image/png';
      const body = Buffer.from(await upstream.arrayBuffer());

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, s-maxage=31536000, max-age=31536000, immutable');
      return res.status(200).send(body);
    } catch {
      continue;
    }
  }

  return res.status(404).json({ error: 'Image not found' });
}
