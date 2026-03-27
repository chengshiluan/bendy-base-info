import { ensureDatabaseInitialized } from '@/lib/db/bootstrap';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  try {
    await ensureDatabaseInitialized();
  } catch (error) {
    console.error('[db:init] instrumentation bootstrap failed', error);
  }
}

export async function onRequestError(..._args: unknown[]) {}
