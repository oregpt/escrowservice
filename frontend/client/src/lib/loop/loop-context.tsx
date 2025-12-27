/**
 * Loop SDK React Context Provider
 *
 * Provides Loop SDK state and methods throughout the component tree.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  LoopProvider,
  LoopNetwork,
  initLoopSDK,
  connectWallet,
  disconnectWallet,
  isWalletConnected,
  getConnectedProvider,
  transferCC,
  getWalletBalance,
  LoopTransferResult,
  LoopBalance,
} from './loop-sdk';

// ===== Context Types =====

interface LoopContextState {
  // Connection state
  isInitialized: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  provider: LoopProvider | null;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  connect: () => Promise<LoopProvider>;
  disconnect: () => Promise<void>;
  transfer: (toPartyId: string, amount: string | number) => Promise<LoopTransferResult>;
  getBalance: () => Promise<LoopBalance>;
  clearError: () => void;
}

const LoopContext = createContext<LoopContextState | null>(null);

// ===== Provider Props =====

interface LoopSDKProviderProps {
  children: ReactNode;
  network?: LoopNetwork;
  autoInit?: boolean;
}

// ===== Provider Component =====

export function LoopSDKProvider({
  children,
  network = 'mainnet',
  autoInit = false,
}: LoopSDKProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [provider, setProvider] = useState<LoopProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize SDK
  const initialize = useCallback(async () => {
    if (isInitialized) return;

    try {
      setError(null);
      await initLoopSDK(network);
      setIsInitialized(true);

      // Check if already connected (page refresh)
      if (isWalletConnected()) {
        setIsConnected(true);
        setProvider(getConnectedProvider());
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Loop SDK';
      setError(message);
      console.error('[Loop] Initialization error:', err);
    }
  }, [network, isInitialized]);

  // Auto-initialize if enabled
  useEffect(() => {
    if (autoInit && !isInitialized) {
      initialize();
    }
  }, [autoInit, isInitialized, initialize]);

  // Connect wallet
  const connect = useCallback(async (): Promise<LoopProvider> => {
    if (!isInitialized) {
      await initialize();
    }

    setIsConnecting(true);
    setError(null);

    try {
      const connectedProvider = await connectWallet();
      setProvider(connectedProvider);
      setIsConnected(true);
      return connectedProvider;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [isInitialized, initialize]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      await disconnectWallet();
      setProvider(null);
      setIsConnected(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect wallet';
      setError(message);
      console.error('[Loop] Disconnect error:', err);
    }
  }, []);

  // Transfer CC tokens
  const transfer = useCallback(
    async (toPartyId: string, amount: string | number): Promise<LoopTransferResult> => {
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }

      setError(null);

      try {
        return await transferCC(toPartyId, amount);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transfer failed';
        setError(message);
        throw err;
      }
    },
    [isConnected]
  );

  // Get balance
  const getBalance = useCallback(async (): Promise<LoopBalance> => {
    if (!isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      return await getWalletBalance();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get balance';
      setError(message);
      throw err;
    }
  }, [isConnected]);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: LoopContextState = {
    isInitialized,
    isConnecting,
    isConnected,
    provider,
    error,
    initialize,
    connect,
    disconnect,
    transfer,
    getBalance,
    clearError,
  };

  return <LoopContext.Provider value={value}>{children}</LoopContext.Provider>;
}

// ===== Hook =====

export function useLoopContext(): LoopContextState {
  const context = useContext(LoopContext);

  if (!context) {
    throw new Error('useLoopContext must be used within a LoopSDKProvider');
  }

  return context;
}

// Re-export types
export type { LoopProvider, LoopNetwork, LoopTransferResult, LoopBalance };
