import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { listWorkspaceOptions } from '@/lib/platform/service';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const workspaces = await listWorkspaceOptions(
    session.user.id,
    session.user.systemRole
  );

  return NextResponse.json({ workspaces });
}
