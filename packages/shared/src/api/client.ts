import type { ApiResponse, ApiError } from '../types/api';

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null>;
  onUnauthorized?: () => void;
}

let apiConfig: ApiClientConfig | null = null;

export function initApiClient(config: ApiClientConfig): void {
  apiConfig = config;
}

export function getApiConfig(): ApiClientConfig {
  if (!apiConfig) {
    throw new Error('API client not initialized. Call initApiClient() first.');
  }
  return apiConfig;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const config = getApiConfig();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (config.getAuthToken) {
    const token = await config.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(`${config.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && config.onUnauthorized) {
      config.onUnauthorized();
      return {
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      };
    }

    const data = await response.json();

    if (!response.ok) {
      return {
        data: null,
        error: {
          code: data.code || `HTTP_${response.status}`,
          message: data.message || response.statusText,
          details: data.details,
        },
      };
    }

    return { data, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return {
      data: null,
      error: { code: 'NETWORK_ERROR', message },
    };
  }
}

export async function get<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { method: 'GET' });
}

export async function post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function del<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { method: 'DELETE' });
}
