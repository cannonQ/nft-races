'use client';

import { useState } from 'react';
import type { CyberPetInfo } from '@/lib/cyberpets';
import { getRarityColor } from '@/lib/cyberpets';

interface CyberPetSelectorProps {
  pets: CyberPetInfo[];
  selectedTokenId: string;
  onSelect: (tokenId: string) => void;
  loading?: boolean;
}

export function CyberPetSelector({
  pets,
  selectedTokenId,
  onSelect,
  loading = false,
}: CyberPetSelectorProps) {
  const [expandedPet, setExpandedPet] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = (tokenId: string) => {
    setFailedImages(prev => new Set(prev).add(tokenId));
  };

  if (loading) {
    return (
      <div className="pet-selector">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading your CyberPets...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (pets.length === 0) {
    return (
      <div className="pet-selector">
        <div className="empty-state">
          <p>No CyberPets found in your wallet</p>
          <p className="hint">Only CyberPets NFTs can enter races</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="pet-selector">
      <label className="selector-label">Select your CyberPet:</label>
      <div className="pet-grid">
        {pets.map((pet) => (
          <div
            key={pet.tokenId}
            className={`pet-card ${selectedTokenId === pet.tokenId ? 'selected' : ''}`}
            onClick={() => onSelect(pet.tokenId)}
            onMouseEnter={() => setExpandedPet(pet.tokenId)}
            onMouseLeave={() => setExpandedPet(null)}
          >
            <div className="pet-image-container">
              {failedImages.has(pet.tokenId) ? (
                <div className="pet-image-fallback">
                  <span className="fallback-icon">🐾</span>
                  <span className="fallback-text">#{pet.number}</span>
                </div>
              ) : (
                <img
                  src={pet.imageUrl}
                  alt={pet.name}
                  className="pet-image"
                  loading="lazy"
                  onError={() => handleImageError(pet.tokenId)}
                />
              )}
              <div
                className="rarity-badge"
                style={{ backgroundColor: getRarityColor(pet.traits.rarity) }}
              >
                {pet.traits.rarity}
              </div>
            </div>

            <div className="pet-info">
              <h4 className="pet-name">{pet.name}</h4>
              <div className="pet-stats">
                <span className="stat">
                  <span className="stat-label">Score:</span>
                  <span className="stat-value">{pet.racingScore}</span>
                </span>
                <span className="stat">
                  <span className="stat-label">Parts:</span>
                  <span className="stat-value">{pet.traits.bodyParts.length}</span>
                </span>
              </div>
              <p className="pet-type">{pet.traits.pet}</p>
            </div>

            {/* Expanded body parts tooltip */}
            {expandedPet === pet.tokenId && pet.traits.bodyParts.length > 0 && (
              <div className="body-parts-tooltip">
                <h5>Body Parts ({pet.traits.bodyParts.length})</h5>
                <ul>
                  {pet.traits.bodyParts.map((part, idx) => (
                    <li key={idx}>{part}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedTokenId === pet.tokenId && (
              <div className="selected-indicator">Selected</div>
            )}
          </div>
        ))}
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .pet-selector {
    width: 100%;
  }

  .selector-label {
    display: block;
    margin-bottom: 0.75rem;
    color: #888;
    font-size: 0.9rem;
  }

  .loading-state,
  .empty-state {
    text-align: center;
    padding: 2rem;
    background: #2a2a4e;
    border-radius: 8px;
  }

  .loading-state p,
  .empty-state p {
    color: #888;
    margin: 0;
  }

  .empty-state .hint {
    font-size: 0.85rem;
    margin-top: 0.5rem;
    color: #f59e0b;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #444;
    border-top-color: #4361ee;
    border-radius: 50%;
    margin: 0 auto 1rem;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .pet-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 1rem;
    max-height: 320px;
    overflow-y: auto;
    padding: 0.25rem;
  }

  .pet-card {
    position: relative;
    background: #2a2a4e;
    border: 2px solid #333;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;
  }

  .pet-card:hover {
    border-color: #4361ee;
    transform: translateY(-2px);
  }

  .pet-card.selected {
    border-color: #10b981;
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
  }

  .pet-image-container {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: #1a1a2e;
  }

  .pet-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .pet-image-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #2a2a4e 0%, #1a1a2e 100%);
  }

  .fallback-icon {
    font-size: 2.5rem;
    opacity: 0.6;
  }

  .fallback-text {
    font-size: 0.75rem;
    color: #888;
    margin-top: 0.25rem;
  }

  .rarity-badge {
    position: absolute;
    top: 4px;
    right: 4px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 600;
    color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }

  .pet-info {
    padding: 0.5rem;
  }

  .pet-name {
    margin: 0 0 0.25rem;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pet-stats {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .stat {
    font-size: 0.7rem;
  }

  .stat-label {
    color: #888;
  }

  .stat-value {
    color: #10b981;
    font-weight: 600;
    margin-left: 2px;
  }

  .pet-type {
    margin: 0;
    font-size: 0.7rem;
    color: #666;
  }

  .body-parts-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a2e;
    border: 1px solid #4361ee;
    border-radius: 8px;
    padding: 0.75rem;
    min-width: 200px;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  .body-parts-tooltip h5 {
    margin: 0 0 0.5rem;
    font-size: 0.8rem;
    color: #4361ee;
  }

  .body-parts-tooltip ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .body-parts-tooltip li {
    font-size: 0.75rem;
    color: #ccc;
    padding: 0.15rem 0;
    border-bottom: 1px solid #333;
  }

  .body-parts-tooltip li:last-child {
    border-bottom: none;
  }

  .selected-indicator {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: #10b981;
    color: white;
    text-align: center;
    padding: 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
  }
`;

export default CyberPetSelector;
