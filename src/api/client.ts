/**
 * JEXA Unified Frontend API Client
 * - 15-second timeout
 * - Authorization: Bearer <token>
 * - Clear, sanitized error messages
 * - Never falls back to window.location.origin if hosted on github.io without configured backend URL
 */

export interface ApiClientOptions extends RequestInit {
  timeoutMs?: number;
}

export class ApiClient {
  public static getBackendUrl(): string {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem('jexa_backend_url')?.trim();
    if (stored) return stored.replace(/\/+$/, '');

    // If hosted on GitHub Pages (github.io), do NOT fall back to window.location.origin
    if (window.location.hostname.endsWith('github.io')) {
      return '';
    }

    return window.location.origin.replace(/\/+$/, '');
  }

  public static getAccessToken(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('jexa_access_token')?.trim() || '';
  }

  public static isConnected(): boolean {
    return Boolean(this.getBackendUrl());
  }

  public static async request<T = any>(endpoint: string, options: ApiClientOptions = {}): Promise<T> {
    const backendUrl = this.getBackendUrl();
    if (!backendUrl) {
      throw new Error('Backend not connected. Open Settings to add your backend URL.');
    }

    const token = this.getAccessToken();
    const timeoutMs = options.timeoutMs ?? 15000;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${backendUrl}${cleanEndpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const message = errJson.error || errJson.message || `Request failed with HTTP ${response.status}`;
        throw new Error(message);
      }

      // Check if response is json
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return (await response.json()) as T;
      }
      return (await response.text()) as unknown as T;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        throw new Error(`Request to ${cleanEndpoint} timed out after ${timeoutMs / 1000}s`);
      }
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        throw new Error('Backend not reachable. Check your backend URL or internet connection.');
      }
      throw err;
    }
  }

  public static async get<T = any>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public static async post<T = any>(endpoint: string, body?: any, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...((options?.headers as Record<string, string>) || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}
