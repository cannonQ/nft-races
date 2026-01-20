/**
 * ErgoAuth QR Code Component
 * 
 * Displays a QR code for mobile wallet (Terminus) authentication.
 * Polls for completion and shows success/error states.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface ErgoAuthQRProps {
  raceId: string;
  nftTokenId: string;
  address: string;
  onSuccess?: (entryId: string) => void;
  onError?: (error: string) => void;
}

interface SessionState {
  sessionId: string | null;
  qrCodeUrl: string | null;
  status: 'idle' | 'loading' | 'waiting' | 'completed' | 'expired' | 'error';
  error: string | null;
  entryId: string | null;
}

export function ErgoAuthQR({
  raceId,
  nftTokenId,
  address,
  onSuccess,
  onError,
}: ErgoAuthQRProps) {
  const [state, setState] = useState<SessionState>({
    sessionId: null,
    qrCodeUrl: null,
    status: 'idle',
    error: null,
    entryId: null,
  });

  // Create session and get QR code
  const createSession = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'loading', error: null }));

    try {
      const response = await fetch('/api/ergoauth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceId, nftTokenId, address }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session');
      }

      setState({
        sessionId: data.sessionId,
        qrCodeUrl: data.qrCodeUrl,
        status: 'waiting',
        error: null,
        entryId: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
      onError?.(errorMessage);
    }
  }, [raceId, nftTokenId, address, onError]);

  // Poll for status
  useEffect(() => {
    if (state.status !== 'waiting' || !state.sessionId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/ergoauth/status/${state.sessionId}`);
        const data = await response.json();

        if (data.status === 'completed') {
          setState(prev => ({
            ...prev,
            status: 'completed',
            entryId: data.entryId,
          }));
          onSuccess?.(data.entryId);
          clearInterval(pollInterval);
        } else if (data.status === 'expired') {
          setState(prev => ({
            ...prev,
            status: 'expired',
            error: 'Session expired. Please try again.',
          }));
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [state.status, state.sessionId, onSuccess]);

  // Auto-create session on mount
  useEffect(() => {
    if (state.status === 'idle') {
      createSession();
    }
  }, [state.status, createSession]);

  // Generate QR code URL (using a QR code API)
  const getQRCodeImageUrl = (data: string) => {
    // Using QR Server API - replace with your preferred QR generation
    const encoded = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encoded}`;
  };

  return (
    <div className="ergoauth-qr">
      {/* Loading State */}
      {state.status === 'loading' && (
        <div className="loading">
          <div className="spinner" />
          <p>Preparing authentication...</p>
        </div>
      )}

      {/* QR Code Display */}
      {state.status === 'waiting' && state.qrCodeUrl && (
        <div className="qr-container">
          <h3>Scan with Mobile Wallet</h3>
          <p className="instructions">
            Open your Terminus or Ergo Wallet app and scan this QR code to sign in.
          </p>
          
          <div className="qr-code">
            <img
              src={getQRCodeImageUrl(state.qrCodeUrl)}
              alt="ErgoAuth QR Code"
              width={250}
              height={250}
            />
          </div>

          <p className="waiting-text">
            <span className="dot-animation">Waiting for signature</span>
          </p>

          {/* Mobile deep link button */}
          <a
            href={state.qrCodeUrl}
            className="mobile-link"
          >
            Open in Wallet App
          </a>

          <button onClick={createSession} className="refresh-button">
            Generate New QR Code
          </button>
        </div>
      )}

      {/* Success State */}
      {state.status === 'completed' && (
        <div className="success">
          <div className="success-icon">✓</div>
          <h3>Successfully Signed!</h3>
          <p>You have been entered into the race.</p>
          {state.entryId && (
            <p className="entry-id">Entry ID: {state.entryId}</p>
          )}
        </div>
      )}

      {/* Expired State */}
      {state.status === 'expired' && (
        <div className="expired">
          <h3>Session Expired</h3>
          <p>The QR code has expired. Please try again.</p>
          <button onClick={createSession} className="retry-button">
            Try Again
          </button>
        </div>
      )}

      {/* Error State */}
      {state.status === 'error' && (
        <div className="error">
          <h3>Error</h3>
          <p>{state.error}</p>
          <button onClick={createSession} className="retry-button">
            Try Again
          </button>
        </div>
      )}

      <style jsx>{`
        .ergoauth-qr {
          padding: 1.5rem;
          border-radius: 12px;
          background: #1a1a2e;
          color: white;
          text-align: center;
          font-family: system-ui, -apple-system, sans-serif;
        }

        h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
        }

        .instructions {
          color: #888;
          font-size: 0.9rem;
          margin-bottom: 1.5rem;
        }

        .loading, .success, .expired, .error {
          padding: 2rem;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #333;
          border-top-color: #4361ee;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .qr-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .qr-code {
          background: white;
          padding: 1rem;
          border-radius: 8px;
        }

        .qr-code img {
          display: block;
        }

        .waiting-text {
          color: #888;
          font-size: 0.9rem;
        }

        .dot-animation::after {
          content: '';
          animation: dots 1.5s infinite;
        }

        @keyframes dots {
          0%, 20% { content: '.'; }
          40% { content: '..'; }
          60%, 100% { content: '...'; }
        }

        .mobile-link {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          background: #4361ee;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .mobile-link:hover {
          background: #3651de;
        }

        .refresh-button, .retry-button {
          padding: 0.5rem 1rem;
          background: transparent;
          color: #888;
          border: 1px solid #444;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .refresh-button:hover, .retry-button:hover {
          border-color: #666;
          color: #aaa;
        }

        .success-icon {
          width: 60px;
          height: 60px;
          background: #10b981;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          margin: 0 auto 1rem;
        }

        .entry-id {
          font-family: monospace;
          font-size: 0.8rem;
          color: #666;
        }

        .error h3 {
          color: #ef4444;
        }

        .expired h3 {
          color: #f59e0b;
        }
      `}</style>
    </div>
  );
}

export default ErgoAuthQR;
