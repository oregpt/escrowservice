/**
 * useLoopWallet Hook
 *
 * Combines Loop SDK functionality with backend API calls
 * to provide a complete wallet funding flow.
 */

import { useState, useCallback } from 'react';
import { useLoopContext, LoopProvider, LoopTransferResult } from '../lib/loop/loop-context';

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ===== Types =====

export interface LoopConfig {
  platformPartyId: string;
  network: string;
  supportedInstruments: string[];
  ccToUsdRate: number;
}

export interface PaymentSession {
  paymentId: string;
  platformPartyId: string;
  ccAmount: string;
  usdAmount: number;
  exchangeRate: number;
  network: string;
  expiresAt: string;
}

export interface FundingResult {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  error?: string;
}

export interface SavedWallet {
  partyId: string;
  publicKey?: string;
  email?: string;
}

// ===== API Helper =====

async function loopApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const sessionId = localStorage.getItem('escrow_session_id');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (sessionId) {
    (headers as Record<string, string>)['X-Session-ID'] = sessionId;
  }

  try {
    const response = await fetch(`${API_BASE}/payments/loop${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ===== Hook =====

export function useLoopWallet() {
  const loopContext = useLoopContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);

  // Get Loop configuration from backend
  const getConfig = useCallback(async (): Promise<LoopConfig | null> => {
    const result = await loopApi<LoopConfig>('/config');
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  }, []);

  // Get current exchange rate
  const getExchangeRate = useCallback(async (): Promise<number | null> => {
    const result = await loopApi<{ ccToUsdRate: number; usdToCcRate: number }>('/exchange-rate');
    if (result.success && result.data) {
      return result.data.ccToUsdRate;
    }
    return null;
  }, []);

  // Get user's saved wallet
  const getSavedWallet = useCallback(async (): Promise<SavedWallet | null> => {
    const result = await loopApi<{ wallet: SavedWallet | null }>('/wallet');
    if (result.success && result.data) {
      return result.data.wallet;
    }
    return null;
  }, []);

  // Save wallet connection to backend
  const saveWallet = useCallback(async (provider: LoopProvider): Promise<boolean> => {
    const result = await loopApi('/save-wallet', {
      method: 'POST',
      body: JSON.stringify({
        partyId: provider.party_id,
        publicKey: provider.public_key,
        email: provider.email,
      }),
    });
    return result.success;
  }, []);

  // Disconnect wallet from backend
  const disconnectSavedWallet = useCallback(async (): Promise<boolean> => {
    const result = await loopApi('/wallet', { method: 'DELETE' });
    return result.success;
  }, []);

  // Connect wallet and optionally save to backend
  const connectAndSave = useCallback(async (): Promise<LoopProvider | null> => {
    try {
      const provider = await loopContext.connect();
      await saveWallet(provider);
      return provider;
    } catch (error) {
      setFundingError(error instanceof Error ? error.message : 'Failed to connect wallet');
      return null;
    }
  }, [loopContext, saveWallet]);

  // Full funding flow
  const fundAccount = useCallback(
    async (usdAmount: number): Promise<FundingResult> => {
      setIsProcessing(true);
      setFundingError(null);

      try {
        // 1. Ensure wallet is connected
        if (!loopContext.isConnected) {
          throw new Error('Please connect your wallet first');
        }

        // 2. Create payment session on backend
        const sessionResult = await loopApi<PaymentSession>('/create-session', {
          method: 'POST',
          body: JSON.stringify({
            amount: usdAmount,
            currency: 'USD',
          }),
        });

        if (!sessionResult.success || !sessionResult.data) {
          throw new Error(sessionResult.error || 'Failed to create payment session');
        }

        const session = sessionResult.data;

        // 3. Execute transfer via Loop SDK
        console.log('[Loop Funding] Session created:', session);

        let transferResult: LoopTransferResult;
        try {
          console.log('[Loop Funding] Calling transfer with:', {
            platformPartyId: session.platformPartyId,
            ccAmount: session.ccAmount,
          });
          transferResult = await loopContext.transfer(
            session.platformPartyId,
            session.ccAmount
          );
          console.log('[Loop Funding] Transfer result:', transferResult);
        } catch (transferError) {
          console.error('[Loop Funding] Transfer error:', transferError);
          throw new Error(
            transferError instanceof Error
              ? transferError.message
              : 'Transfer failed in wallet'
          );
        }

        if (!transferResult.success) {
          throw new Error(transferResult.error || 'Transfer was not successful');
        }

        // 4. Verify transfer on backend and credit account
        const verifyPayload = {
          paymentId: session.paymentId,
          cantonTxId: transferResult.transactionId,
          fromPartyId: loopContext.provider?.party_id,
          ccAmount: session.ccAmount,
        };
        console.log('[Loop Funding] Verify payload:', verifyPayload);

        const verifyResult = await loopApi<{ paymentId: string; message: string }>(
          '/verify-transfer',
          {
            method: 'POST',
            body: JSON.stringify(verifyPayload),
          }
        );

        if (!verifyResult.success) {
          throw new Error(verifyResult.error || 'Transfer verification failed');
        }

        return {
          success: true,
          paymentId: session.paymentId,
          transactionId: transferResult.transactionId,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An unknown error occurred';
        setFundingError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsProcessing(false);
      }
    },
    [loopContext]
  );

  // Calculate CC amount for a given USD amount
  const calculateCCAmount = useCallback(
    async (usdAmount: number): Promise<string | null> => {
      const rate = await getExchangeRate();
      if (rate && rate > 0) {
        return (usdAmount / rate).toFixed(8);
      }
      return null;
    },
    [getExchangeRate]
  );

  // Clear funding error
  const clearFundingError = useCallback(() => {
    setFundingError(null);
  }, []);

  return {
    // Loop SDK state (from context)
    isInitialized: loopContext.isInitialized,
    isConnecting: loopContext.isConnecting,
    isConnected: loopContext.isConnected,
    provider: loopContext.provider,
    sdkError: loopContext.error,

    // Hook state
    isProcessing,
    fundingError,

    // SDK actions
    initialize: loopContext.initialize,
    connect: loopContext.connect,
    disconnect: loopContext.disconnect,
    getBalance: loopContext.getBalance,

    // Backend-integrated actions
    getConfig,
    getExchangeRate,
    getSavedWallet,
    saveWallet,
    disconnectSavedWallet,
    connectAndSave,
    fundAccount,
    calculateCCAmount,
    clearFundingError,
  };
}

export type { LoopProvider };
