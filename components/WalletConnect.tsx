/**
 * WalletConnect Component
 * Example UI for connecting wallet and entering races
 */

'use client';

import { useState } from 'react';
import { useErgoWallet, formatErg, truncateAddress } from '@/hooks/useErgoWallet';

interface WalletConnectProps {
  raceId?: string;
  raceName?: string;
  entryFeeNanoErg?: bigint;
  availableNFTs?: Array<{
    tokenId: string;
    name: string;
    imageUrl?: string;
  }>;
}

export function WalletConnect({
  raceId,
  raceName = 'Race',
  entryFeeNanoErg = 50000000n,
  availableNFTs = []
}: WalletConnectProps) {
  const { state, isInstalled, connect, disconnect, signAndJoinRace } = useErgoWallet();
  const [selectedNFT, setSelectedNFT] = useState<string>('');
  const [joinResult, setJoinResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Handle join race with transaction payment
  const handleJoinRace = async () => {
    if (!raceId || !selectedNFT) return;

    setJoinResult(null);
    const result = await signAndJoinRace(raceId, raceName, selectedNFT, entryFeeNanoErg);

    if (result.success) {
      setJoinResult({
        success: true,
        message: `Successfully entered race! TX: ${result.txId?.slice(0, 8)}...`,
      });
    } else {
      setJoinResult({
        success: false,
        message: result.error || 'Failed to join race',
      });
    }
  };

  // Not installed state
  if (!isInstalled) {
    return (
      <div className="wallet-connect">
        <div className="wallet-not-installed">
          <h3>Nautilus Wallet Required</h3>
          <p>Please install the Nautilus wallet extension to continue.</p>
          <a
            href="https://chrome.google.com/webstore/detail/nautilus-wallet/gjlmehlldlphhljhpnlddaodbjjcchai"
            target="_blank"
            rel="noopener noreferrer"
            className="install-button"
          >
            Install Nautilus
          </a>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!state.connected) {
    return (
      <div className="wallet-connect">
        <button
          onClick={connect}
          disabled={state.loading}
          className="connect-button"
        >
          {state.loading ? 'Connecting...' : 'Connect Nautilus Wallet'}
        </button>
        {state.error && <p className="error">{state.error}</p>}
      </div>
    );
  }

  // Connected state
  return (
    <div className="wallet-connect connected">
      {/* Wallet Info */}
      <div className="wallet-info">
        <div className="address">
          <span className="label">Connected:</span>
          <span className="value" title={state.address || ''}>
            {truncateAddress(state.address || '')}
          </span>
        </div>
        {state.balance && (
          <div className="balance">
            <span className="label">Balance:</span>
            <span className="value">{formatErg(state.balance.nanoErgs)} ERG</span>
          </div>
        )}
        <button onClick={disconnect} className="disconnect-button">
          Disconnect
        </button>
      </div>

      {/* Race Entry Form */}
      {raceId && (
        <div className="race-entry">
          <h3>Enter Race</h3>

          {availableNFTs.length > 0 ? (
            <>
              <div className="nft-selector">
                <label htmlFor="nft-select">Select your CyberPet:</label>
                <select
                  id="nft-select"
                  value={selectedNFT}
                  onChange={(e) => setSelectedNFT(e.target.value)}
                >
                  <option value="">Choose a CyberPet...</option>
                  {availableNFTs.map((nft) => (
                    <option key={nft.tokenId} value={nft.tokenId}>
                      {nft.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleJoinRace}
                disabled={!selectedNFT || state.loading}
                className="join-button"
              >
                {state.loading ? 'Signing...' : 'Sign & Join Race'}
              </button>
            </>
          ) : (
            <p className="no-nfts">No CyberPets NFTs found in your wallet.</p>
          )}

          {/* Result message */}
          {joinResult && (
            <div className={`result ${joinResult.success ? 'success' : 'error'}`}>
              {joinResult.message}
            </div>
          )}
        </div>
      )}

      {/* Loading overlay */}
      {state.loading && (
        <div className="loading-overlay">
          <div className="spinner" />
          <p>Please check your Nautilus wallet...</p>
        </div>
      )}

      <style jsx>{`
        .wallet-connect {
          padding: 1rem;
          border-radius: 8px;
          background: #1a1a2e;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .wallet-not-installed {
          text-align: center;
        }

        .install-button,
        .connect-button,
        .disconnect-button,
        .join-button {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 500;
          transition: all 0.2s;
        }

        .connect-button,
        .join-button {
          background: #4361ee;
          color: white;
        }

        .connect-button:hover,
        .join-button:hover {
          background: #3651de;
        }

        .connect-button:disabled,
        .join-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .disconnect-button {
          background: transparent;
          color: #888;
          border: 1px solid #444;
        }

        .disconnect-button:hover {
          border-color: #666;
        }

        .install-button {
          background: #f72585;
          color: white;
        }

        .wallet-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #333;
        }

        .address,
        .balance {
          display: flex;
          gap: 0.5rem;
        }

        .label {
          color: #888;
        }

        .value {
          font-family: monospace;
        }

        .race-entry {
          margin-top: 1rem;
        }

        .race-entry h3 {
          margin-bottom: 1rem;
        }

        .nft-selector {
          margin-bottom: 1rem;
        }

        .nft-selector label {
          display: block;
          margin-bottom: 0.5rem;
          color: #888;
        }

        .nft-selector select {
          width: 100%;
          padding: 0.75rem;
          border-radius: 6px;
          background: #2a2a4e;
          color: white;
          border: 1px solid #444;
          font-size: 1rem;
        }

        .no-nfts {
          color: #f72585;
          font-style: italic;
        }

        .result {
          margin-top: 1rem;
          padding: 0.75rem;
          border-radius: 6px;
        }

        .result.success {
          background: #10b981;
          color: white;
        }

        .result.error {
          background: #ef4444;
          color: white;
        }

        .error {
          color: #ef4444;
          margin-top: 0.5rem;
        }

        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #333;
          border-top-color: #4361ee;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-overlay p {
          margin-top: 1rem;
          color: #888;
        }
      `}</style>
    </div>
  );
}

export default WalletConnect;
