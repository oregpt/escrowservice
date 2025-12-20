/**
 * Proxied HTTP Client
 *
 * Provides HTTP request methods that automatically route through the SSH SOCKS5 tunnel
 * when available. Falls back to direct requests when tunnel is not connected.
 *
 * Use this for all API calls to IP-whitelisted services.
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getProxyUrl, isTunnelConnected, getTunnelStatus } from './ssh-tunnel.js';

export interface ProxiedRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  requireProxy?: boolean; // If true, fail if proxy not available
}

export interface ProxiedResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  proxied: boolean;
}

/**
 * Create a SOCKS proxy agent if tunnel is connected
 */
function getProxyAgent(): SocksProxyAgent | undefined {
  const proxyUrl = getProxyUrl();
  if (proxyUrl && isTunnelConnected()) {
    return new SocksProxyAgent(proxyUrl);
  }
  return undefined;
}

/**
 * Make an HTTP request, routing through SSH tunnel if available
 */
export async function proxiedRequest<T = any>(
  url: string,
  options: ProxiedRequestOptions = {}
): Promise<ProxiedResponse<T>> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = 30000,
    requireProxy = false,
  } = options;

  const proxyAgent = getProxyAgent();
  const isProxied = !!proxyAgent;

  // Check if proxy is required but not available
  if (requireProxy && !isProxied) {
    const status = getTunnelStatus();
    throw new Error(
      `Proxy required but not available. Tunnel status: ${JSON.stringify(status)}`
    );
  }

  // Log routing info
  if (isProxied) {
    console.log(`[Proxied HTTP] Routing request through SOCKS proxy: ${method} ${url}`);
  } else {
    console.log(`[Proxied HTTP] Direct request (no proxy): ${method} ${url}`);
  }

  const config: AxiosRequestConfig = {
    method,
    url,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    timeout,
    validateStatus: () => true, // Don't throw on HTTP errors
  };

  // Add body for POST/PUT/PATCH
  if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
    config.data = body;
  }

  // Add proxy agent if available
  if (proxyAgent) {
    config.httpAgent = proxyAgent;
    config.httpsAgent = proxyAgent;
  }

  try {
    const response: AxiosResponse<T> = await axios(config);

    // Convert headers to plain object
    const responseHeaders: Record<string, string> = {};
    Object.entries(response.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        responseHeaders[key] = value;
      }
    });

    return {
      data: response.data,
      status: response.status,
      headers: responseHeaders,
      proxied: isProxied,
    };
  } catch (error) {
    // Add context to error
    if (error instanceof Error) {
      const enhancedError = new Error(
        `[Proxied HTTP] Request failed: ${error.message} (proxied: ${isProxied})`
      );
      (enhancedError as any).originalError = error;
      (enhancedError as any).proxied = isProxied;
      (enhancedError as any).url = url;
      throw enhancedError;
    }
    throw error;
  }
}

/**
 * Convenience method for GET requests
 */
export async function proxiedGet<T = any>(
  url: string,
  headers?: Record<string, string>,
  options?: Omit<ProxiedRequestOptions, 'method' | 'headers' | 'body'>
): Promise<ProxiedResponse<T>> {
  return proxiedRequest<T>(url, { method: 'GET', headers, ...options });
}

/**
 * Convenience method for POST requests
 */
export async function proxiedPost<T = any>(
  url: string,
  body: any,
  headers?: Record<string, string>,
  options?: Omit<ProxiedRequestOptions, 'method' | 'headers' | 'body'>
): Promise<ProxiedResponse<T>> {
  return proxiedRequest<T>(url, { method: 'POST', body, headers, ...options });
}

/**
 * Convenience method for PUT requests
 */
export async function proxiedPut<T = any>(
  url: string,
  body: any,
  headers?: Record<string, string>,
  options?: Omit<ProxiedRequestOptions, 'method' | 'headers' | 'body'>
): Promise<ProxiedResponse<T>> {
  return proxiedRequest<T>(url, { method: 'PUT', body, headers, ...options });
}

/**
 * Convenience method for PATCH requests
 */
export async function proxiedPatch<T = any>(
  url: string,
  body: any,
  headers?: Record<string, string>,
  options?: Omit<ProxiedRequestOptions, 'method' | 'headers' | 'body'>
): Promise<ProxiedResponse<T>> {
  return proxiedRequest<T>(url, { method: 'PATCH', body, headers, ...options });
}

/**
 * Convenience method for DELETE requests
 */
export async function proxiedDelete<T = any>(
  url: string,
  headers?: Record<string, string>,
  options?: Omit<ProxiedRequestOptions, 'method' | 'headers' | 'body'>
): Promise<ProxiedResponse<T>> {
  return proxiedRequest<T>(url, { method: 'DELETE', headers, ...options });
}

/**
 * Make a request with retry logic
 * Useful for when the tunnel might temporarily disconnect
 */
export async function proxiedRequestWithRetry<T = any>(
  url: string,
  options: ProxiedRequestOptions & { maxRetries?: number; retryDelay?: number } = {}
): Promise<ProxiedResponse<T>> {
  const { maxRetries = 3, retryDelay = 2000, ...requestOptions } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if proxy is connected before attempting
      if (options.requireProxy && !isTunnelConnected()) {
        console.log(
          `[Proxied HTTP] Attempt ${attempt}/${maxRetries}: Tunnel not connected, waiting...`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      return await proxiedRequest<T>(url, requestOptions);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[Proxied HTTP] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      if (attempt < maxRetries) {
        console.log(`[Proxied HTTP] Retrying in ${retryDelay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}

/**
 * Export tunnel status checker for convenience
 */
export { isTunnelConnected, getTunnelStatus } from './ssh-tunnel.js';
