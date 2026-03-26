import { ensureDatabaseInitialized } from '@/lib/db/bootstrap';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  await ensureDatabaseInitialized();
}

export async function onRequestError(..._args: unknown[]) {}
