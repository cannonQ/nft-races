'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Race {
  id: string;
  name: string;
  status: 'pending' | 'open' | 'closed' | 'resolved';
  entry_fee: number;
  max_entries: number;
  min_entries: number;
  entry_deadline: string;
  server_seed_hash: string;
  created_at: string;
}

export default function AdminPage() {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [name, setName] = useState('Test Race #1');
  const [entryFee, setEntryFee] = useState('0.05');
  const [maxEntries, setMaxEntries] = useState('8');
  const [minEntries, setMinEntries] = useState('2');
  const [deadlineHours, setDeadlineHours] = useState('24');

  useEffect(() => {
    fetchRaces();
  }, []);

  async function fetchRaces() {
    try {
      const res = await fetch('/api/admin/races');
      if (res.ok) {
        const data = await res.json();
        setRaces(data.races || []);
      }
    } catch (err) {
      console.error('Failed to fetch races:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createRace(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    try {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + parseInt(deadlineHours));

      const res = await fetch('/api/admin/races', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          entry_fee: Math.floor(parseFloat(entryFee) * 1e9),
          max_entries: parseInt(maxEntries),
          min_entries: parseInt(minEntries),
          entry_deadline: deadline.toISOString(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: `Race created: ${data.race.id}` });
        fetchRaces();
        // Increment race name for next
        const num = parseInt(name.match(/#(\d+)/)?.[1] || '0') + 1;
        setName(`Test Race #${num}`);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create race' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create race' });
    } finally {
      setCreating(false);
    }
  }

  async function updateRaceStatus(raceId: string, status: string) {
    try {
      const res = await fetch(`/api/admin/races/${raceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: `Race ${status}` });
        fetchRaces();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update race' });
    }
  }

  async function resolveRace(raceId: string) {
    try {
      const res = await fetch(`/api/admin/races/${raceId}/resolve`, {
        method: 'POST',
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Race resolved!' });
        fetchRaces();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to resolve' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to resolve race' });
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin</h1>
            <p className="text-gray-400">Manage races</p>
          </div>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            ← Back to home
          </Link>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded mb-6 ${
            message.type === 'success' ? 'bg-green-600/20 border border-green-600' : 'bg-red-600/20 border border-red-600'
          }`}>
            {message.text}
          </div>
        )}

        {/* Create Race Form */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Race</h2>
          
          <form onSubmit={createRace} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Race Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Entry Fee (ERG)</label>
                <input
                  type="number"
                  step="0.01"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Max Entries</label>
                <input
                  type="number"
                  value={maxEntries}
                  onChange={(e) => setMaxEntries(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Min Entries</label>
                <input
                  type="number"
                  value={minEntries}
                  onChange={(e) => setMinEntries(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Deadline (hours from now)</label>
                <input
                  type="number"
                  value={deadlineHours}
                  onChange={(e) => setDeadlineHours(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 rounded font-semibold"
            >
              {creating ? 'Creating...' : 'Create Race'}
            </button>
          </form>
        </div>

        {/* Race List */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">All Races</h2>
          
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : races.length === 0 ? (
            <p className="text-gray-400">No races yet</p>
          ) : (
            <div className="space-y-4">
              {races.map((race) => (
                <div key={race.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">{race.name}</h3>
                      <p className="text-xs text-gray-400">{race.id}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      race.status === 'open' ? 'bg-green-600' :
                      race.status === 'pending' ? 'bg-yellow-600' :
                      race.status === 'resolved' ? 'bg-blue-600' :
                      race.status === 'closed' ? 'bg-orange-600' :
                      'bg-gray-600'
                    }`}>
                      {race.status}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-400 mb-3">
                    Fee: {race.entry_fee / 1e9} ERG · 
                    Entries: {race.min_entries}-{race.max_entries} · 
                    Deadline: {new Date(race.entry_deadline).toLocaleString()}
                  </div>
                  
                  <div className="flex gap-2">
                    <Link
                      href={`/race/${race.id}`}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded text-sm"
                    >
                      View
                    </Link>
                    
                    {race.status === 'pending' && (
                      <button
                        onClick={() => updateRaceStatus(race.id, 'open')}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-sm"
                      >
                        Open
                      </button>
                    )}
                    
                    {race.status === 'open' && (
                      <button
                        onClick={() => updateRaceStatus(race.id, 'closed')}
                        className="px-3 py-1 bg-orange-600 hover:bg-orange-500 rounded text-sm"
                      >
                        Close
                      </button>
                    )}
                    
                    {race.status === 'closed' && (
                      <button
                        onClick={() => resolveRace(race.id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm"
                      >
                        Resolve
                      </button>
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
