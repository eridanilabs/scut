export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown,
  ) {
    super(`API error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

export function getErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  if (error instanceof ApiError) {
    return `${error.statusText} (${error.status})`;
  }
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === 'string') {
    return error || fallback;
  }
  return fallback;
}

export function getToastErrorMessage(
  error: unknown,
  fallback = 'An error occurred',
): string | null {
  if (!error) return null;
  return getErrorMessage(error, fallback);
}

// Wrap mock calls in Promise.resolve() with a small simulated delay so
// components that use async patterns behave correctly.
export async function mockFetch<T>(fn: () => T): Promise<T> {
  await new Promise((r) => setTimeout(r, 50));
  return fn();
}
