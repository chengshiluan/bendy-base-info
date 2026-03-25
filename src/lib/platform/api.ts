import { NextResponse } from 'next/server';
import { PlatformMutationError } from './mutations';

export async function parseJsonRequest<T>(request: Request): Promise<T | null> {
  return request.json().catch(() => null);
}

export function getSearchParam(request: Request, key: string) {
  const url = new URL(request.url);
  return url.searchParams.get(key) ?? undefined;
}

export function handlePlatformError(error: unknown) {
  if (error instanceof PlatformMutationError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status }
    );
  }

  console.error(error);
  return NextResponse.json(
    { message: '服务器开小差了，请稍后再试。' },
    { status: 500 }
  );
}
