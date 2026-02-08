// API configuration - change this when connecting to real backend
export const API_BASE = '/api/v2';

// Simulated network delay for mock responses (ms)
export const MOCK_DELAY = 300;

// Helper to simulate API delay
export const delay = (ms: number = MOCK_DELAY): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));
