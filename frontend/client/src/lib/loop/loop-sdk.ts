/**
 * Loop SDK Type Definitions and Wrapper
 *
 * The Loop SDK is a client-side JavaScript library for Canton wallet integration.
 * It enables users to connect their Canton wallets and transfer CC tokens.
 */

// Import the Loop SDK from npm package
import { loop as loopSDK } from '@fivenorth/loop-sdk';

// ===== SDK Type Definitions =====

export interface LoopProvider {
  party_id: string;
  public_key: string;
  email?: string;
}

export interface LoopTransferResult {
  success: boolean;
  transactionId: string;
  error?: string;
}

export interface LoopBalance {
  instrument: string;
  amount: string;
}

export type LoopNetwork = 'mainnet' | 'devnet' | 'local';

// ===== SDK State =====

let isInitialized = false;

/**
 * Get the Loop SDK instance
 */
export function getLoopSDK() {
  return loopSDK;
}

/**
 * Initialize the Loop SDK with network configuration
 */
export async function initLoopSDK(network: LoopNetwork = 'mainnet') {
  if (isInitialized) {
    return loopSDK;
  }

  try {
    // The Loop SDK init method - check if it exists
    if (typeof loopSDK.init === 'function') {
      await loopSDK.init({ network });
    }
    isInitialized = true;
    console.log('[Loop SDK] Initialized with network:', network);
  } catch (error) {
    console.error('[Loop SDK] Initialization error:', error);
    throw error;
  }

  return loopSDK;
}

/**
 * Load the Loop SDK (for compatibility - now just returns the imported SDK)
 */
export async function loadLoopSDK() {
  return loopSDK;
}

/**
 * Connect to user's Canton wallet
 * The SDK's connect() returns void - provider is set asynchronously
 */
export async function connectWallet(): Promise<LoopProvider> {
  if (!isInitialized) {
    await initLoopSDK();
  }

  // If already connected, return the provider
  if (loopSDK.provider) {
    return loopSDK.provider;
  }

  // Start connection process
  await loopSDK.connect();

  // Wait for provider to be set (via WebSocket callback)
  // Poll for up to 60 seconds
  const maxWaitMs = 60000;
  const pollIntervalMs = 500;
  let waited = 0;

  while (!loopSDK.provider && waited < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    waited += pollIntervalMs;
  }

  if (!loopSDK.provider) {
    throw new Error('Connection timed out. Please try again.');
  }

  console.log('[Loop SDK] Connected provider:', {
    party_id: loopSDK.provider.party_id,
    public_key: loopSDK.provider.public_key,
    email: loopSDK.provider.email,
  });

  return loopSDK.provider;
}

/**
 * Disconnect the current wallet
 */
export async function disconnectWallet(): Promise<void> {
  if (typeof loopSDK.logout === 'function') {
    loopSDK.logout();
  } else if (typeof loopSDK.disconnect === 'function') {
    await loopSDK.disconnect();
  }
}

/**
 * Check if a wallet is currently connected
 */
export function isWalletConnected(): boolean {
  // Check if provider exists
  return loopSDK.provider !== null && loopSDK.provider !== undefined;
}

/**
 * Get the currently connected provider
 */
export function getConnectedProvider(): LoopProvider | null {
  return loopSDK.provider || null;
}

/**
 * Transfer CC tokens to a party
 * @param toPartyId - The recipient's party ID
 * @param amount - Amount to transfer (in CC/Amulet)
 */
export async function transferCC(
  toPartyId: string,
  amount: string | number
): Promise<LoopTransferResult> {
  if (!isWalletConnected()) {
    throw new Error('Wallet not connected');
  }

  try {
    // Ensure connection is still valid before transfer
    const provider = loopSDK.provider;
    if (!provider) {
      throw new Error('No provider available. Please reconnect your wallet.');
    }

    // Try to ensure connection is active
    if (typeof provider.ensureConnected === 'function') {
      console.log('[Loop SDK] Ensuring connection is active...');
      await provider.ensureConnected();
    }

    // The Loop SDK transfer expects instrument as object with instrument_id
    // "Amulet" is the default Canton Coin instrument
    const instrumentObj = { instrument_id: 'Amulet' };

    console.log('[Loop SDK] Calling transfer', {
      toPartyId,
      amount,
      instrument: instrumentObj,
      hasAuthToken: !!provider.auth_token
    });

    // Call transfer directly on provider if wallet.transfer fails
    let result: any;
    try {
      if (loopSDK.wallet?.transfer) {
        result = await loopSDK.wallet.transfer(toPartyId, amount, instrumentObj);
      } else if (typeof provider.transfer === 'function') {
        result = await provider.transfer(toPartyId, amount, instrumentObj);
      } else {
        throw new Error('Transfer method not found on SDK');
      }
    } catch (transferError: any) {
      // Check if it's an auth error - user might need to reconnect
      const errorMsg = transferError?.message || '';
      if (errorMsg.includes('auth') || errorMsg.includes('401') || errorMsg.includes('403') ||
          errorMsg.includes('Unauthorized') || errorMsg.includes('session')) {
        throw new Error('Session expired. Please disconnect and reconnect your wallet.');
      }
      throw transferError;
    }

    console.log('[Loop SDK] Transfer result:', result);

    // Extract transaction ID from various possible fields
    const txId = result?.transactionId
      || result?.txId
      || result?.command_id
      || result?.submission_id
      || result?.id
      || result?.updateId
      || 'unknown';

    return {
      success: true,
      transactionId: txId,
    };
  } catch (error) {
    console.error('[Loop SDK] Transfer error:', error);
    return {
      success: false,
      transactionId: '',
      error: error instanceof Error ? error.message : 'Transfer failed',
    };
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(instrument: string = 'CC'): Promise<LoopBalance> {
  if (!isWalletConnected()) {
    throw new Error('Wallet not connected');
  }

  try {
    let balance: any;

    if (loopSDK.wallet?.getBalance) {
      balance = await loopSDK.wallet.getBalance(instrument);
    } else if (typeof loopSDK.getBalance === 'function') {
      balance = await loopSDK.getBalance(instrument);
    } else {
      // Return default if not available
      return { instrument, amount: '0' };
    }

    return {
      instrument,
      amount: balance?.amount || balance?.toString() || '0',
    };
  } catch (error) {
    console.error('[Loop SDK] Get balance error:', error);
    return { instrument, amount: '0' };
  }
}
