export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function safeErrorMessage(status: number): string {
  if (status === 401) return 'Authentication is required.';
  if (status === 403) return 'You are not authorized to perform this action.';
  if (status === 429) return 'Too many requests. Try again later.';
  if (status >= 500) return 'The service is temporarily unavailable.';
  return 'The request could not be completed.';
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
  const controller = new AbortController();
  const timeoutMs = 8000;
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(init?.headers ?? {});

    if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: init?.credentials ?? 'include',
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      throw new ApiError(response.status, safeErrorMessage(response.status));
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
