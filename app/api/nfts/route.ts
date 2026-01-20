import { NextRequest, NextResponse } from 'next/server';

const EXPLORER_API = 'https://api.ergoplatform.com/api/v1';

// CyberPets policy ID prefix (first 4 bytes that identify the collection)
// You may need to adjust this based on actual CyberPets token IDs
const CYBERPETS_PREFIXES = [
  '0030e827', '0083431a', '009e95dd', // From packed data
  // Add more known prefixes or use a different identification method
];

// GET /api/nfts?address=xxx - Get user's CyberPets NFTs
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');

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
    const nfts: { tokenId: string; name: string; amount: number }[] = [];

    for (const box of boxes) {
      for (const asset of box.assets || []) {
        // Check if this is a CyberPet
        // For now, include all NFTs with amount 1
        if (asset.amount === 1) {
          nfts.push({
            tokenId: asset.tokenId,
            name: asset.name || `Token ${asset.tokenId.slice(0, 8)}...`,
            amount: asset.amount,
          });
        }
      }
    }

    // TODO: Filter to only CyberPets by checking against packed-data.json
    // For now, return all NFTs and let frontend filter

    return NextResponse.json({ nfts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
