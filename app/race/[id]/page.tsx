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
  owner_address: string;
  final_position?: number;
  final_distance?: number;
  payout_amount?: number;
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
      if (res.ok) {
        const data = await res.json();
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

        {/* Entry Form (only if race is open) */}
        {race.status === 'open' && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Enter Race</h2>
            <UnifiedWalletConnect
              raceId={raceId}
              availableNFTs={userNFTs}
              onEntrySuccess={handleEntrySuccess}
            />
          </div>
        )}

        {/* Entries / Results */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            {race.status === 'resolved' ? 'Results' : 'Entries'}
          </h2>

          {entries.length === 0 ? (
            <p className="text-gray-400">No entries yet</p>
          ) : (
            <div className="space-y-2">
              {entries
                .sort((a, b) => (a.final_position || 999) - (b.final_position || 999))
                .map((entry, index) => (
                  <div 
                    key={entry.id}
                    className={`flex justify-between items-center p-3 rounded ${
                      race.status === 'resolved' && entry.final_position === 1 
                        ? 'bg-yellow-600/20 border border-yellow-600' 
                        : 'bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {race.status === 'resolved' && (
                        <span className={`w-8 h-8 flex items-center justify-center rounded-full ${
                          entry.final_position === 1 ? 'bg-yellow-500 text-black' :
                          entry.final_position === 2 ? 'bg-gray-300 text-black' :
                          entry.final_position === 3 ? 'bg-orange-600 text-white' :
                          'bg-gray-600'
                        }`}>
                          {entry.final_position || '-'}
                        </span>
                      )}
                      <div>
                        <p className="font-semibold">{entry.nft_name || 'Unknown Pet'}</p>
                        <p className="text-xs text-gray-400">
                          {entry.owner_address.slice(0, 8)}...{entry.owner_address.slice(-6)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {race.status === 'resolved' && entry.final_distance && (
                        <p className="text-sm">{entry.final_distance.toFixed(2)} m</p>
                      )}
                      {entry.payout_amount && entry.payout_amount > 0 && (
                        <p className="text-green-400 text-sm">
                          +{entry.payout_amount / 1e9} ERG
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
