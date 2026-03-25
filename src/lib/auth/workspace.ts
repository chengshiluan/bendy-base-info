import { cookies } from 'next/headers';

export const ACTIVE_WORKSPACE_COOKIE = 'active_workspace_id';

export async function getActiveWorkspaceCookie() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
}
