'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UnifiedWalletConnect } from '@/components/UnifiedWalletConnect';

interface Race {
  id: string;
  name: string;
  status: 'pending' | 'open' | 'closed' | 'resolved';
  entry_fee: number;
  max_entries: number;
  entry_count: number;
  entry_deadline: string;
  resolved_at?: string;
}

interface ResolvedRace extends Race {
  winner?: {
    nft_name: string;
    nft_number: number;
    owner_address: string;
  };
}

const CYBERPETS_IPFS_CID = 'QmeQZUQJiKQYZ2dQ795491ykn1ikEv3bNJ1Aa1uyGs1aJw';

function getPetImageUrl(petNumber: number): string {
  return `https://api.ergexplorer.com/nftcache/${CYBERPETS_IPFS_CID}_${petNumber}.png.png`;
}

export default function HomePage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [resolvedRaces, setResolvedRaces] = useState<ResolvedRace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRaces();
  }, []);

  async function fetchRaces() {
    try {
      const res = await fetch('/api/races');
      if (res.ok) {
        const data = await res.json();
        setRaces(data.races || []);
        setResolvedRaces(data.resolvedRaces || []);
      }
    } catch (err) {
      console.error('Failed to fetch races:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">🏁 NFT Races</h1>
          <p className="text-gray-400">Provably fair racing for CyberPets</p>
        </div>

        {/* Navigation */}
        <div className="flex justify-center gap-4 mb-8">
          <Link 
            href="/admin" 
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Admin
          </Link>
        </div>

        {/* Race List */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">Open Races</h2>
          
          {loading ? (
            <p className="text-gray-400">Loading races...</p>
          ) : races.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <p className="text-gray-400 mb-4">No races available</p>
              <Link 
                href="/admin" 
                className="text-blue-400 hover:text-blue-300"
              >
                Create a test race →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {races.map((race) => (
                <div 
                  key={race.id} 
                  className="bg-gray-800 rounded-lg p-4 flex justify-between items-center"
                >
                  <div>
                    <h3 className="font-semibold">{race.name}</h3>
                    <p className="text-sm text-gray-400">
                      {race.entry_count}/{race.max_entries} entries · {race.entry_fee / 1e9} ERG
                    </p>
                    <p className="text-xs text-gray-500">
                      Deadline: {new Date(race.entry_deadline).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      race.status === 'open' ? 'bg-green-600' :
                      race.status === 'pending' ? 'bg-yellow-600' :
                      race.status === 'resolved' ? 'bg-blue-600' :
                      'bg-gray-600'
                    }`}>
                      {race.status}
                    </span>
                    {race.status === 'open' && (
                      <Link
                        href={`/race/${race.id}`}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
                      >
                        Enter
                      </Link>
                    )}
                    {race.status === 'closed' && (
                      <Link
                        href={`/race/${race.id}`}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past Races */}
        {resolvedRaces.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Past Races</h2>
            <div className="space-y-3">
              {resolvedRaces.map((race) => (
                <div
                  key={race.id}
                  className="bg-gray-800 rounded-lg p-4 flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    {/* Winner thumbnail */}
                    {race.winner?.nft_number && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0">
                        <img
                          src={getPetImageUrl(race.winner.nft_number)}
                          alt={race.winner.nft_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold">{race.name}</h3>
                      <p className="text-sm text-gray-400">
                        {race.entry_count} entries · {race.entry_fee / 1e9} ERG
                        {race.winner && (
                          <span className="text-yellow-400 ml-2">
                            🏆 {race.winner.nft_name}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {race.resolved_at && new Date(race.resolved_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/race/${race.id}`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded"
                  >
                    Results
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Info */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Connect your Nautilus wallet (or use mobile with ErgoAuth)</li>
            <li>Select a CyberPet NFT you own</li>
            <li>Sign a message to prove ownership (0.05 ERG sent, reduces spam during testing)</li>
            <li>Wait for race to start</li>
            <li>Results determined by provably fair algorithm</li>
          </ol>
          
          <div className="mt-6 p-4 bg-gray-700 rounded">
            <h3 className="font-semibold mb-2">Trait Box</h3>
            <p className="text-sm text-gray-400">
              CyberPets traits are frozen on-chain for fair racing.
            </p>
            <a 
              href="https://explorer.ergoplatform.com/en/transactions/c988253964cba60b9eea9110c400d545ea3bcb49ce8ad8e5842f1070da3da744"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View on Explorer →
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
