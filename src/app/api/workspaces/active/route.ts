import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/auth/workspace';
import { listWorkspaceOptions } from '@/lib/platform/service';

const requestSchema = z.object({
  workspaceId: z.string().min(1)
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid workspace.' },
      { status: 400 }
    );
  }

  const workspaces = await listWorkspaceOptions(
    session.user.id,
    session.user.systemRole
  );
  const matched = workspaces.find(
    (workspace) => workspace.id === parsed.data.workspaceId
  );

  if (!matched) {
    return NextResponse.json(
      { message: 'Workspace not found.' },
      { status: 404 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, matched.id, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  });

  return NextResponse.json({ ok: true, workspaceId: matched.id });
}
