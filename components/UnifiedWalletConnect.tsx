/**
 * Unified Wallet Connect Component
 * 
 * Supports both:
 * - Nautilus browser extension (desktop)
 * - ErgoAuth QR code (mobile wallets like Terminus)
 * 
 * Auto-detects if Nautilus is available, otherwise shows QR option.
 */

'use client';

import { useState, useEffect } from 'react';
import { useErgoWallet, formatErg, truncateAddress } from '@/hooks/useErgoWallet';
import { isNautilusInstalled } from '@/lib/ergo/client';
import { ErgoAuthQR } from './ErgoAuthQR';
import { CyberPetSelector } from './CyberPetSelector';
import type { CyberPetInfo } from '@/lib/cyberpets';

interface UnifiedWalletConnectProps {
  raceId?: string;
  raceName?: string;
  entryFeeNanoErg?: bigint;
  availableNFTs?: Array<{
    tokenId: string;
    name: string;
    imageUrl?: string;
  }>;
  onEntrySuccess?: (entryId: string, txId?: string) => void;
}

type ConnectionMethod = 'auto' | 'nautilus' | 'mobile';

export function UnifiedWalletConnect({
  raceId,
  raceName = 'Race',
  entryFeeNanoErg = 50000000n, // Default 0.05 ERG
  availableNFTs = [],
  onEntrySuccess,
}: UnifiedWalletConnectProps) {
  const wallet = useErgoWallet();
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod>('auto');
  const [selectedNFT, setSelectedNFT] = useState<string>('');
  const [manualAddress, setManualAddress] = useState<string>('');
  const [showQR, setShowQR] = useState(false);
  const [joinResult, setJoinResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [fetchedNFTs, setFetchedNFTs] = useState<CyberPetInfo[]>([]);
  const [nftsLoading, setNftsLoading] = useState(false);

  // Detect available connection methods
  const hasNautilus = wallet.isInstalled;
  const isMobile = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Auto-select method based on platform
  useEffect(() => {
    if (connectionMethod === 'auto') {
      if (isMobile) {
        setConnectionMethod('mobile');
      } else if (hasNautilus) {
        setConnectionMethod('nautilus');
      } else {
        setConnectionMethod('mobile'); // Fallback to QR
      }
    }
  }, [connectionMethod, isMobile, hasNautilus]);

  // Fetch NFTs when wallet connects
  useEffect(() => {
    const address = wallet.state.address || manualAddress;
    if (!address) {
      setFetchedNFTs([]);
      return;
    }

    async function fetchNFTs() {
      setNftsLoading(true);
      try {
        const res = await fetch(`/api/nfts?address=${address}`);
        if (res.ok) {
          const data = await res.json();
          setFetchedNFTs(data.nfts || []);
        }
      } catch (err) {
        console.error('Failed to fetch NFTs:', err);
      } finally {
        setNftsLoading(false);
      }
    }

    fetchNFTs();
  }, [wallet.state.address, manualAddress]);

  // Handle Nautilus join with transaction payment
  const handleNautilusJoin = async () => {
    if (!raceId || !selectedNFT) return;

    setJoinResult(null);

    // PRE-CHECK: Verify NFT can enter BEFORE signing transaction
    try {
      const checkRes = await fetch(
        `/api/race/check-entry?raceId=${raceId}&nftTokenId=${selectedNFT}`
      );
      const checkData = await checkRes.json();

      if (!checkData.canEnter) {
        setJoinResult({
          success: false,
          message: checkData.error || 'Cannot enter this race',
        });
        return; // Stop - don't sign transaction
      }
    } catch (err) {
      console.error('Pre-check failed:', err);
      // Continue anyway if check fails - backend will catch it
    }

    const result = await wallet.signAndJoinRace(
      raceId,
      raceName,
      selectedNFT,
      entryFeeNanoErg
    );

    if (result.success) {
      setJoinResult({
        success: true,
        message: `Successfully entered race! TX: ${result.txId?.slice(0, 8)}...`,
      });
      onEntrySuccess?.(result.entryId!, result.txId);
    } else {
      setJoinResult({
        success: false,
        message: result.error || 'Failed to join race',
      });
    }
  };

  // Handle mobile QR success
  const handleMobileSuccess = (entryId: string) => {
    setJoinResult({
      success: true,
      message: `Successfully entered race! Entry ID: ${entryId}`,
    });
    setShowQR(false);
    onEntrySuccess?.(entryId);
  };

  // Get the address to use for mobile flow
  const mobileAddress = wallet.state.address || manualAddress;

  return (
    <div className="unified-wallet">
      {/* Connection Method Tabs */}
      <div className="method-tabs">
        {hasNautilus && (
          <button
            className={`tab ${connectionMethod === 'nautilus' ? 'active' : ''}`}
            onClick={() => setConnectionMethod('nautilus')}
          >
            🦊 Browser Wallet
          </button>
        )}
        <button
          className={`tab ${connectionMethod === 'mobile' ? 'active' : ''}`}
          onClick={() => setConnectionMethod('mobile')}
        >
          📱 Mobile Wallet
        </button>
      </div>

      {/* Nautilus Flow */}
      {connectionMethod === 'nautilus' && (
        <div className="nautilus-flow">
          {!wallet.state.connected ? (
            <div className="connect-section">
              <p>Connect your Nautilus browser extension to continue.</p>
              <button
                onClick={wallet.connect}
                disabled={wallet.state.loading}
                className="primary-button"
              >
                {wallet.state.loading ? 'Connecting...' : 'Connect Nautilus'}
              </button>
              {wallet.state.error && (
                <p className="error">{wallet.state.error}</p>
              )}
            </div>
          ) : (
            <div className="connected-section">
              <div className="wallet-info">
                <span className="label">Connected:</span>
                <span className="address" title={wallet.state.address || ''}>
                  {truncateAddress(wallet.state.address || '')}
                </span>
                {wallet.state.balance && (
                  <span className="balance">
                    {formatErg(wallet.state.balance.nanoErgs)} ERG
                  </span>
                )}
                <button onClick={wallet.disconnect} className="disconnect-btn">
                  Disconnect
                </button>
              </div>

              {raceId && (
                <div className="race-entry">
                  <CyberPetSelector
                    pets={fetchedNFTs}
                    selectedTokenId={selectedNFT}
                    onSelect={setSelectedNFT}
                    loading={nftsLoading}
                  />

                  {fetchedNFTs.length > 0 && (
                    <button
                      onClick={handleNautilusJoin}
                      disabled={!selectedNFT || wallet.state.loading}
                      className="primary-button"
                    >
                      {wallet.state.loading ? 'Signing...' : 'Sign & Join Race'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mobile/QR Flow */}
      {connectionMethod === 'mobile' && (
        <div className="mobile-flow">
          {!showQR ? (
            <div className="mobile-setup">
              <p>
                Use your mobile wallet (Terminus, Ergo Wallet) to sign in via QR code.
              </p>

              {/* Address input if not connected via Nautilus */}
              {!wallet.state.address && (
                <div className="address-input">
                  <label>Enter your Ergo address:</label>
                  <input
                    type="text"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    placeholder="9f..."
                  />
                </div>
              )}

              {/* NFT Selection */}
              {raceId && mobileAddress && (
                <div className="nft-select">
                  <CyberPetSelector
                    pets={fetchedNFTs}
                    selectedTokenId={selectedNFT}
                    onSelect={setSelectedNFT}
                    loading={nftsLoading}
                  />
                </div>
              )}

              <button
                onClick={async () => {
                  // PRE-CHECK before showing QR
                  if (raceId && selectedNFT) {
                    try {
                      const checkRes = await fetch(
                        `/api/race/check-entry?raceId=${raceId}&nftTokenId=${selectedNFT}`
                      );
                      const checkData = await checkRes.json();
                      if (!checkData.canEnter) {
                        setJoinResult({
                          success: false,
                          message: checkData.error || 'Cannot enter this race',
                        });
                        return;
                      }
                    } catch (err) {
                      console.error('Pre-check failed:', err);
                    }
                  }
                  setShowQR(true);
                }}
                disabled={!mobileAddress || !selectedNFT}
                className="primary-button"
              >
                Show QR Code
              </button>
            </div>
          ) : (
            <div className="qr-section">
              <button onClick={() => setShowQR(false)} className="back-button">
                ← Back
              </button>
              
              {raceId && mobileAddress && selectedNFT && (
                <ErgoAuthQR
                  raceId={raceId}
                  nftTokenId={selectedNFT}
                  address={mobileAddress}
                  onSuccess={handleMobileSuccess}
                  onError={(error) => setJoinResult({ success: false, message: error })}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Result Message */}
      {joinResult && (
        <div className={`result ${joinResult.success ? 'success' : 'error'}`}>
          <span>{joinResult.message}</span>
          <button
            className="dismiss-btn"
            onClick={() => setJoinResult(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <style jsx>{`
        .unified-wallet {
          padding: 1.5rem;
          border-radius: 12px;
          background: #1a1a2e;
          color: white;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .method-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid #333;
          padding-bottom: 1rem;
        }

        .tab {
          padding: 0.75rem 1rem;
          background: transparent;
          color: #888;
          border: 1px solid #333;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .tab:hover {
          border-color: #555;
          color: #aaa;
        }

        .tab.active {
          background: #4361ee;
          border-color: #4361ee;
          color: white;
        }

        .connect-section,
        .mobile-setup {
          text-align: center;
        }

        .connect-section p,
        .mobile-setup p {
          color: #888;
          margin-bottom: 1rem;
        }

        .primary-button {
          padding: 0.75rem 1.5rem;
          background: #4361ee;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 500;
          transition: background 0.2s;
        }

        .primary-button:hover {
          background: #3651de;
        }

        .primary-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .wallet-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          padding: 1rem;
          background: #2a2a4e;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .label {
          color: #888;
        }

        .address {
          font-family: monospace;
          font-size: 0.9rem;
        }

        .balance {
          color: #10b981;
          font-weight: 500;
        }

        .disconnect-btn {
          margin-left: auto;
          padding: 0.5rem 1rem;
          background: transparent;
          color: #888;
          border: 1px solid #444;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.85rem;
        }

        .race-entry,
        .nft-select,
        .address-input {
          margin-top: 1rem;
        }

        label {
          display: block;
          margin-bottom: 0.5rem;
          color: #888;
        }

        select,
        input[type="text"] {
          width: 100%;
          padding: 0.75rem;
          background: #2a2a4e;
          color: white;
          border: 1px solid #444;
          border-radius: 6px;
          font-size: 1rem;
          margin-bottom: 1rem;
        }

        select:focus,
        input[type="text"]:focus {
          outline: none;
          border-color: #4361ee;
        }

        .back-button {
          padding: 0.5rem 1rem;
          background: transparent;
          color: #888;
          border: none;
          cursor: pointer;
          margin-bottom: 1rem;
        }

        .back-button:hover {
          color: white;
        }

        .result {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
        }

        .result span {
          flex: 1;
          text-align: center;
        }

        .result.success {
          background: #10b981;
          color: white;
        }

        .result.error {
          background: #ef4444;
          color: white;
        }

        .dismiss-btn {
          background: transparent;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0 0.25rem;
          line-height: 1;
          opacity: 0.8;
          transition: opacity 0.2s;
        }

        .dismiss-btn:hover {
          opacity: 1;
        }

        .error {
          color: #ef4444;
          margin-top: 0.5rem;
        }

        .loading-text {
          color: #888;
          font-style: italic;
          padding: 0.75rem;
          background: #2a2a4e;
          border-radius: 6px;
          margin-bottom: 1rem;
        }

        .no-nfts {
          color: #f59e0b;
          padding: 0.75rem;
          background: #2a2a4e;
          border-radius: 6px;
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}

export default UnifiedWalletConnect;
