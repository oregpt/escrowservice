/**
 * SSH SOCKS5 Tunnel Manager
 *
 * Creates an SSH tunnel to a remote server for routing API calls through
 * a specific IP address. Required for IP-whitelisted APIs like Canton.
 *
 * Environment variables:
 *   SSH_TUNNEL_ENABLED - Set to "true" to enable tunnel (default: false)
 *   SSH_HOST - Hostname or IP of proxy server
 *   SSH_USER - SSH username
 *   SSH_PRIVATE_KEY - SSH private key (with \n for newlines)
 *   SSH_PORT - SSH port (default: 22)
 *   SOCKS_PROXY_PORT - Local SOCKS proxy port (default: 8080)
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';

// Configuration
const DEFAULT_SOCKS_PORT = 8080;
const DEFAULT_SSH_PORT = 22;

// State
let tunnelProcess: ChildProcess | null = null;
let isConnected = false;
let reconnectAttempts = 0;
let keyFilePath: string | null = null;
let externalProxyMode = false; // True when user runs SSH manually

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 5000;
const CONNECTION_TIMEOUT_MS = 15000;

// Get SOCKS proxy port from env or default
function getSocksPort(): number {
  return parseInt(process.env.SOCKS_PROXY_PORT || '', 10) || DEFAULT_SOCKS_PORT;
}

// Get SSH port from env or default
function getSshPort(): number {
  return parseInt(process.env.SSH_PORT || '', 10) || DEFAULT_SSH_PORT;
}

/**
 * Returns the SOCKS5 proxy URL if tunnel is connected
 * Uses socks5h:// so DNS is resolved through the proxy (required for IP whitelisting)
 */
export function getProxyUrl(): string | null {
  if (isConnected) {
    return `socks5h://127.0.0.1:${getSocksPort()}`;
  }
  return null;
}

/**
 * Check if tunnel is currently connected
 */
export function isTunnelConnected(): boolean {
  return isConnected;
}

/**
 * Get current tunnel status
 */
export function getTunnelStatus(): {
  enabled: boolean;
  connected: boolean;
  proxyUrl: string | null;
  port: number;
  host: string | null;
  reconnectAttempts: number;
} {
  return {
    enabled: isTunnelEnabled(),
    connected: isConnected,
    proxyUrl: getProxyUrl(),
    port: getSocksPort(),
    host: process.env.SSH_HOST || null,
    reconnectAttempts,
  };
}

/**
 * Write SSH private key to temp file with proper permissions
 */
async function writePrivateKey(): Promise<string> {
  const privateKey = process.env.SSH_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('SSH_PRIVATE_KEY environment variable not set');
  }

  const keyPath = path.join(os.tmpdir(), `ssh_tunnel_key_${process.pid}`);

  // Handle various newline formats in environment variables
  let formattedKey = privateKey
    .replace(/\\n/g, '\n')      // Handle literal \n
    .replace(/\r\n/g, '\n')     // Handle Windows line endings
    .replace(/\r/g, '\n')       // Handle old Mac line endings
    .trim();

  // Ensure the key ends with a newline (required by SSH)
  if (!formattedKey.endsWith('\n')) {
    formattedKey += '\n';
  }

  // Write with restrictive permissions (required by SSH)
  fs.writeFileSync(keyPath, formattedKey, { mode: 0o600 });

  return keyPath;
}

/**
 * Clean up temporary key file
 */
function cleanupKeyFile(): void {
  if (keyFilePath) {
    try {
      if (fs.existsSync(keyFilePath)) {
        fs.unlinkSync(keyFilePath);
        console.log('[SSH Tunnel] Cleaned up key file');
      }
    } catch (error) {
      console.error('[SSH Tunnel] Failed to cleanup key file:', error);
    }
    keyFilePath = null;
  }
}

/**
 * Check if the SOCKS proxy port is accepting connections
 */
async function checkProxyConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const port = getSocksPort();

    socket.setTimeout(2000);

    socket.connect(port, '127.0.0.1', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Wait for the tunnel to be ready
 */
async function waitForConnection(): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < CONNECTION_TIMEOUT_MS) {
    if (await checkProxyConnection()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Connection timeout - SOCKS proxy not responding');
}

/**
 * Check if tunnel is enabled via environment variable
 */
export function isTunnelEnabled(): boolean {
  const enabled = process.env.SSH_TUNNEL_ENABLED;
  return enabled?.toLowerCase() === 'true';
}

/**
 * Check if SOCKS proxy port is listening (for external proxy mode)
 */
async function isProxyPortListening(): Promise<boolean> {
  const port = getSocksPort();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

/**
 * Start the SSH SOCKS5 tunnel
 */
export async function startTunnel(): Promise<boolean> {
  // Check if tunnel is enabled (default: OFF)
  if (!isTunnelEnabled()) {
    console.log('[SSH Tunnel] Tunnel is DISABLED (SSH_TUNNEL_ENABLED != "true")');
    console.log('[SSH Tunnel] Set SSH_TUNNEL_ENABLED=true to enable');
    return false;
  }

  const sshHost = process.env.SSH_HOST;
  const sshUser = process.env.SSH_USER;
  const sshPrivateKey = process.env.SSH_PRIVATE_KEY;

  // Check if we should use external proxy mode (no private key but host is set)
  if (sshHost && (!sshPrivateKey || sshPrivateKey.trim() === '')) {
    console.log('[SSH Tunnel] No SSH_PRIVATE_KEY - using EXTERNAL PROXY mode');
    console.log(`[SSH Tunnel] Expecting proxy on port ${getSocksPort()}`);
    console.log(`[SSH Tunnel] Run manually: ssh -D ${getSocksPort()} ${sshUser || 'root'}@${sshHost}`);

    externalProxyMode = true;

    // Check if proxy is already listening
    const listening = await isProxyPortListening();
    if (listening) {
      console.log('[SSH Tunnel] External proxy detected on port ' + getSocksPort());
      isConnected = true;
      return true;
    } else {
      console.log('[SSH Tunnel] External proxy NOT detected - start your SSH tunnel manually');
      isConnected = false;
      return false;
    }
  }

  // Check if credentials are configured for managed mode
  if (!sshHost || !sshUser || !sshPrivateKey) {
    console.log('[SSH Tunnel] SSH credentials not configured, tunnel disabled');
    console.log('[SSH Tunnel] Set SSH_HOST, SSH_USER, and SSH_PRIVATE_KEY to enable');
    return false;
  }

  externalProxyMode = false;

  const socksPort = getSocksPort();
  const sshPort = getSshPort();

  console.log(`[SSH Tunnel] Starting SOCKS5 tunnel to ${sshUser}@${sshHost}:${sshPort}...`);
  console.log(`[SSH Tunnel] Local SOCKS proxy will be on port ${socksPort}`);

  try {
    // Write private key to temp file
    keyFilePath = await writePrivateKey();

    // SSH arguments for SOCKS5 dynamic port forwarding
    const sshArgs = [
      '-D', socksPort.toString(),           // Dynamic SOCKS proxy on this port
      '-p', sshPort.toString(),             // SSH port
      '-N',                                  // No remote command (just tunnel)
      '-o', 'StrictHostKeyChecking=no',     // Don't prompt for host verification
      '-o', 'UserKnownHostsFile=/dev/null', // Don't save host key
      '-o', 'ServerAliveInterval=30',       // Keep-alive every 30 seconds
      '-o', 'ServerAliveCountMax=3',        // Disconnect after 3 missed keep-alives
      '-o', 'ExitOnForwardFailure=yes',     // Exit if port forward fails
      '-o', 'ConnectTimeout=10',            // Connection timeout
      '-o', 'BatchMode=yes',                // Disable interactive prompts
      '-i', keyFilePath,                    // Path to private key
      `${sshUser}@${sshHost}`,              // User@Host
    ];

    // Spawn SSH process
    tunnelProcess = spawn('ssh', sshArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    // Handle stdout
    tunnelProcess.stdout?.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        console.log(`[SSH Tunnel] ${message}`);
      }
    });

    // Handle stderr
    tunnelProcess.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      if (message) {
        // Filter out debug messages if not interesting
        if (!message.includes('debug')) {
          console.log(`[SSH Tunnel] ${message}`);
        }
      }
    });

    // Handle process errors
    tunnelProcess.on('error', (error) => {
      console.error('[SSH Tunnel] Process error:', error.message);
      isConnected = false;
      cleanupKeyFile();
      scheduleReconnect();
    });

    // Handle process exit
    tunnelProcess.on('close', (code, signal) => {
      console.log(`[SSH Tunnel] Process exited with code ${code}, signal ${signal}`);
      isConnected = false;
      cleanupKeyFile();
      if (code !== 0 && code !== null) {
        scheduleReconnect();
      }
    });

    // Wait for the tunnel to be ready
    await waitForConnection();

    isConnected = true;
    reconnectAttempts = 0;

    console.log('[SSH Tunnel] ========================================');
    console.log(`[SSH Tunnel] SOCKS5 proxy available at socks5h://127.0.0.1:${socksPort}`);
    console.log(`[SSH Tunnel] Traffic will route through: ${sshHost}`);
    console.log('[SSH Tunnel] ========================================');

    return true;

  } catch (error) {
    console.error('[SSH Tunnel] Failed to establish tunnel:', error);
    isConnected = false;
    cleanupKeyFile();

    // Kill any orphaned process
    if (tunnelProcess) {
      tunnelProcess.kill('SIGTERM');
      tunnelProcess = null;
    }

    return false;
  }
}

/**
 * Schedule a reconnection attempt
 */
function scheduleReconnect(): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`[SSH Tunnel] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Tunnel disabled.`);
    console.error('[SSH Tunnel] Restart the server to try again.');
    return;
  }

  reconnectAttempts++;
  console.log(`[SSH Tunnel] Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY_MS / 1000}s...`);

  setTimeout(async () => {
    const success = await startTunnel();
    if (!success && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      // startTunnel will schedule another reconnect on failure
    }
  }, RECONNECT_DELAY_MS);
}

/**
 * Stop the SSH tunnel
 */
export function stopTunnel(): void {
  if (tunnelProcess) {
    console.log('[SSH Tunnel] Stopping tunnel...');
    tunnelProcess.kill('SIGTERM');
    tunnelProcess = null;
    isConnected = false;
    cleanupKeyFile();
  }
}

/**
 * Manually trigger reconnection
 */
export async function reconnectTunnel(): Promise<boolean> {
  stopTunnel();
  reconnectAttempts = 0;
  return startTunnel();
}

// Cleanup on process exit
process.on('SIGINT', () => {
  stopTunnel();
});

process.on('SIGTERM', () => {
  stopTunnel();
});

process.on('exit', () => {
  cleanupKeyFile();
});
