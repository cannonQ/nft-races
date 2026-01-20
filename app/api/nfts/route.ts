import { NextRequest, NextResponse } from 'next/server';
import { filterAndEnrichCyberPets, isCyberPet } from '@/lib/cyberpets';

const EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

// GET /api/nfts?address=xxx - Get user's CyberPets NFTs
// Optional: ?all=true to include non-CyberPet NFTs
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  const includeAll = request.nextUrl.searchParams.get('all') === 'true';

  if (!address) {
    return NextResponse.json({ error: 'Address required' }, { status: 400 });
  }

  try {
    // Fetch user's boxes
    const response = await fetch(
      `${EXPLORER_API}/boxes/unspent/byAddress/${address}?limit=100`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch boxes');
    }

    const data = await response.json();
    const boxes = data.items || [];

    // Extract tokens (NFTs)
    const rawNfts: { tokenId: string; name: string }[] = [];

    for (const box of boxes) {
      for (const asset of box.assets || []) {
        // Only include NFTs (amount = 1)
        if (asset.amount === 1) {
          rawNfts.push({
            tokenId: asset.tokenId,
            name: asset.name || `Token ${asset.tokenId.slice(0, 8)}...`,
          });
        }
      }
    }

    // Filter and enrich CyberPets
    const cyberPets = filterAndEnrichCyberPets(rawNfts);

    // If includeAll, also return other NFTs separately
    if (includeAll) {
      const otherNfts = rawNfts.filter(nft => !isCyberPet(nft.tokenId));
      return NextResponse.json({
        cyberPets,
        otherNfts,
        total: rawNfts.length,
      });
    }

    // Return only CyberPets (default)
    return NextResponse.json({
      nfts: cyberPets,
      count: cyberPets.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
