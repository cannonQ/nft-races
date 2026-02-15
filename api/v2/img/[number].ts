import type { VercelRequest, VercelResponse } from '@vercel/node';

const IPFS_CID = 'QmeQZUQJiKQYZ2dQ795491ykn1ikEv3bNJ1Aa1uyGs1aJw';

const SOURCES = [
  (n: string) => `https://api.ergexplorer.com/nftcache/${IPFS_CID}_${n}.png`,
  (n: string) => `https://www.cyberversewiki.com/img/cyberpets/${n}.png`,
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  const { number } = req.query;
  const num = Array.isArray(number) ? number[0] : number;

  if (!num || !/^\d+$/.test(num)) {
    return res.status(400).json({ error: 'Invalid pet number' });
  }

  for (const buildUrl of SOURCES) {
    try {
      const upstream = await fetch(buildUrl(num), { signal: AbortSignal.timeout(5000) });
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
