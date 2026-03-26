import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { hasPermission } from './permission';

export async function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    redirect('/auth/sign-in');
  }

  return session;
}

export async function requirePagePermission(
  permissionCode: string,
  workspaceId?: string | null
) {
  const session = await requireSession();

  if (!hasPermission(session.user, permissionCode, workspaceId)) {
    notFound();
  }

  return session;
}
