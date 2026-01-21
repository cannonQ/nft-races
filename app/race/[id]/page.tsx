'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { UnifiedWalletConnect } from '@/components/UnifiedWalletConnect';

interface Race {
  id: string;
  name: string;
  status: 'pending' | 'open' | 'closed' | 'resolved';
  entry_fee: number;
  max_entries: number;
  min_entries: number;
  entry_deadline: string;
  server_seed_hash: string;
  server_seed?: string;
  combined_seed?: string;
  created_at: string;
}

interface RaceEntry {
  id: string;
  nft_token_id: string;
  nft_name: string;
  nft_number: number;
  owner_address: string;
  final_position?: number;
  final_distance?: number;
  payout_amount?: number;
  is_house_nft?: boolean;
}

// Payout percentages for top 3
const PAYOUT_PERCENTAGES = [
  { position: 1, percentage: 0.50, label: '50%' },
  { position: 2, percentage: 0.30, label: '30%' },
  { position: 3, percentage: 0.15, label: '15%' },
];

const CYBERPETS_IPFS_CID = 'QmeQZUQJiKQYZ2dQ795491ykn1ikEv3bNJ1Aa1uyGs1aJw';

function getPetImageUrl(petNumber: number): string {
  return `https://api.ergexplorer.com/nftcache/${CYBERPETS_IPFS_CID}_${petNumber}.png.png`;
}

function getPetName(nftName: string): string {
  // Extract pet type from name like "CyberPet #1906" or return the trait pet type
  const match = nftName?.match(/CyberPet\s*#?\d*/i);
  return match ? nftName : (nftName || 'Unknown Pet');
}

interface NFT {
  tokenId: string;
  name: string;
}

export default function RacePage() {
  const params = useParams();
  const raceId = params.id as string;

  const [race, setRace] = useState<Race | null>(null);
  const [entries, setEntries] = useState<RaceEntry[]>([]);
  const [userNFTs, setUserNFTs] = useState<NFT[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (raceId) {
      fetchRace();
      fetchEntries();

      // Auto-refresh entries every 10 seconds
      const interval = setInterval(() => {
        fetchEntries();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [raceId]);

  async function fetchRace() {
    try {
      const res = await fetch(`/api/races/${raceId}`);
      if (res.ok) {
        const data = await res.json();
        setRace(data.race);
      } else {
        setError('Race not found');
      }
    } catch (err) {
      setError('Failed to load race');
    } finally {
      setLoading(false);
    }
  }

  async function fetchEntries() {
    try {
      const res = await fetch(`/api/races/${raceId}/entries`);
      const data = await res.json();
      if (res.ok) {
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    }
  }

  async function fetchUserNFTs(address: string) {
    try {
      const res = await fetch(`/api/nfts?address=${address}`);
      if (res.ok) {
        const data = await res.json();
        setUserNFTs(data.nfts || []);
      }
    } catch (err) {
      console.error('Failed to fetch NFTs:', err);
    }
  }

  function handleWalletConnect(address: string) {
    setWalletAddress(address);
    fetchUserNFTs(address);
  }

  function handleEntrySuccess(entryId: string) {
    fetchEntries();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Loading race...</p>
      </main>
    );
  }

  if (error || !race) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center">
        <p className="text-red-400 mb-4">{error || 'Race not found'}</p>
        <Link href="/" className="text-blue-400 hover:text-blue-300">
          ← Back to races
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/" className="text-blue-400 hover:text-blue-300 mb-4 inline-block">
          ← Back to races
        </Link>

        {/* Race Header */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold">{race.name}</h1>
              <p className="text-gray-400">Race ID: {race.id}</p>
            </div>
            <span className={`px-3 py-1 rounded text-sm ${
              race.status === 'open' ? 'bg-green-600' :
              race.status === 'pending' ? 'bg-yellow-600' :
              race.status === 'resolved' ? 'bg-blue-600' :
              'bg-gray-600'
            }`}>
              {race.status.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Entry Fee</p>
              <p className="font-semibold">{race.entry_fee / 1e9} ERG</p>
            </div>
            <div>
              <p className="text-gray-400">Entries</p>
              <p className="font-semibold">{entries.length}/{race.max_entries}</p>
            </div>
            <div>
              <p className="text-gray-400">Min Entries</p>
              <p className="font-semibold">{race.min_entries}</p>
            </div>
            <div>
              <p className="text-gray-400">Deadline</p>
              <p className="font-semibold">{new Date(race.entry_deadline).toLocaleString()}</p>
            </div>
          </div>

          {/* Seed info for verification */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              Seed Hash: <code className="bg-gray-900 px-1 rounded">{race.server_seed_hash}</code>
            </p>
            {race.server_seed && (
              <p className="text-xs text-gray-500 mt-1">
                Revealed Seed: <code className="bg-gray-900 px-1 rounded">{race.server_seed}</code>
              </p>
            )}
          </div>
        </div>

        {/* Results Summary (only if race is resolved) */}
        {race.status === 'resolved' && entries.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Race Results</h2>

            {/* Podium */}
            <div className="flex justify-center items-end gap-4 mb-6">
              {/* 2nd place */}
              {entries.find(e => e.final_position === 2) && (
                <div className="text-center">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-700 mx-auto mb-2 ring-2 ring-gray-300">
                    {entries.find(e => e.final_position === 2)?.nft_number && (
                      <img
                        src={getPetImageUrl(entries.find(e => e.final_position === 2)!.nft_number)}
                        alt="2nd place"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="bg-gray-300 text-black px-3 py-1 rounded font-bold text-sm">2nd</div>
                  <p className="text-xs text-gray-400 mt-1 truncate max-w-[80px]">
                    {entries.find(e => e.final_position === 2)?.nft_name}
                  </p>
                  <p className="text-xs text-green-400">30%</p>
                </div>
              )}

              {/* 1st place */}
              {entries.find(e => e.final_position === 1) && (
                <div className="text-center -mt-4">
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-700 mx-auto mb-2 ring-4 ring-yellow-500">
                    {entries.find(e => e.final_position === 1)?.nft_number && (
                      <img
                        src={getPetImageUrl(entries.find(e => e.final_position === 1)!.nft_number)}
                        alt="1st place"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="bg-yellow-500 text-black px-4 py-1 rounded font-bold">1st</div>
                  <p className="text-sm text-white mt-1 truncate max-w-[96px]">
                    {entries.find(e => e.final_position === 1)?.nft_name}
                  </p>
                  <p className="text-sm text-green-400 font-semibold">50%</p>
                </div>
              )}

              {/* 3rd place */}
              {entries.find(e => e.final_position === 3) && (
                <div className="text-center">
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-700 mx-auto mb-2 ring-2 ring-orange-500">
                    {entries.find(e => e.final_position === 3)?.nft_number && (
                      <img
                        src={getPetImageUrl(entries.find(e => e.final_position === 3)!.nft_number)}
                        alt="3rd place"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="bg-orange-500 text-white px-3 py-1 rounded font-bold text-sm">3rd</div>
                  <p className="text-xs text-gray-400 mt-1 truncate max-w-[64px]">
                    {entries.find(e => e.final_position === 3)?.nft_name}
                  </p>
                  <p className="text-xs text-green-400">15%</p>
                </div>
              )}
            </div>

            {/* Prize pool info */}
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <p className="text-gray-400 text-sm">Prize Pool</p>
              <p className="text-2xl font-bold text-green-400">
                {((entries.filter(e => !e.is_house_nft).length * race.entry_fee) / 1e9 * 0.95).toFixed(3)} ERG
              </p>
              <p className="text-xs text-gray-500">
                ({entries.filter(e => !e.is_house_nft).length} paid entries × {race.entry_fee / 1e9} ERG - 5% house)
              </p>
            </div>

            {/* Verification info */}
            {race.combined_seed && (
              <div className="mt-4 p-3 bg-gray-700/50 rounded text-xs">
                <p className="text-gray-400 mb-1">Provably Fair Verification</p>
                <p className="font-mono text-gray-500 break-all">
                  Combined Seed: {race.combined_seed}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Entry Form (only if race is open) */}
        {race.status === 'open' && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Enter Race</h2>
            <UnifiedWalletConnect
              raceId={raceId}
              raceName={race.name}
              entryFeeNanoErg={BigInt(race.entry_fee)}
              availableNFTs={userNFTs}
              onEntrySuccess={handleEntrySuccess}
            />
          </div>
        )}

        {/* Entries / Results */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            {race.status === 'resolved' ? 'Results' : 'Entries'} ({entries.length}/{race.max_entries})
          </h2>

          {/* Simple grid gallery */}
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {/* Show entered pets */}
            {entries
              .sort((a, b) => (a.final_position || 999) - (b.final_position || 999))
              .map((entry) => (
                <div
                  key={entry.id}
                  className={`relative rounded-lg overflow-hidden bg-gray-700 ${
                    race.status === 'resolved' && entry.final_position === 1
                      ? 'ring-2 ring-yellow-500'
                      : race.status === 'resolved' && entry.final_position === 2
                      ? 'ring-2 ring-gray-300'
                      : race.status === 'resolved' && entry.final_position === 3
                      ? 'ring-2 ring-orange-500'
                      : ''
                  }`}
                >
                  {/* Position badge for resolved races */}
                  {race.status === 'resolved' && entry.final_position && (
                    <div className={`absolute top-1 left-1 z-10 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      entry.final_position === 1 ? 'bg-yellow-500 text-black' :
                      entry.final_position === 2 ? 'bg-gray-300 text-black' :
                      entry.final_position === 3 ? 'bg-orange-500 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {entry.final_position}
                    </div>
                  )}

                  {/* Pet image */}
                  <div className="aspect-square">
                    {entry.nft_number ? (
                      <img
                        src={getPetImageUrl(entry.nft_number)}
                        alt={entry.nft_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-600 flex items-center justify-center">
                        <span className="text-2xl">🐾</span>
                      </div>
                    )}
                  </div>

                  {/* Pet name tag */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
                    <p className="text-xs text-center text-white truncate">
                      {entry.nft_name || 'Pet'}
                    </p>
                  </div>
                </div>
              ))}

            {/* Empty slots */}
            {Array.from({ length: race.max_entries - entries.length }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="relative rounded-lg overflow-hidden bg-gray-700/50 border-2 border-dashed border-gray-600"
              >
                <div className="aspect-square flex items-center justify-center">
                  <span className="text-gray-500 text-2xl">?</span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                  <p className="text-xs text-center text-gray-500">Empty</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
