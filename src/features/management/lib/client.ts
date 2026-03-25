export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { message?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.message || '请求失败，请稍后再试。');
  }

  return payload as T;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '请求失败，请稍后再试。';
}
