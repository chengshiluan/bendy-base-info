import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { hasAnyPermission, hasPermission } from './permission';

type ApiSession = NonNullable<Awaited<ReturnType<typeof getApiSession>>>;

export async function getApiSession() {
  return getServerSession(authOptions);
}

export async function requireApiSession() {
  const session = await getApiSession();

  if (!session?.user?.id) {
    return {
      session: null,
      response: NextResponse.json(
        { message: '未登录或会话已失效。' },
        { status: 401 }
      )
    };
  }

  return { session, response: null };
}

export function isManager(role?: string | null) {
  return role === 'super_admin' || role === 'admin';
}

export function canAccessWorkspace(
  session: ApiSession,
  workspaceId?: string | null
) {
  if (!workspaceId) {
    return session.user.systemRole === 'super_admin';
  }

  if (session.user.systemRole === 'super_admin') {
    return true;
  }

  return session.user.workspaceIds.includes(workspaceId);
}

export function forbidden(message = '你没有执行该操作的权限。') {
  return NextResponse.json({ message }, { status: 403 });
}

export function unavailable(
  message = '数据库尚未配置，当前无法执行写入操作。'
) {
  return NextResponse.json({ message }, { status: 503 });
}

export async function requireManagerApi(workspaceId?: string | null) {
  const { session, response } = await requireApiSession();

  if (response || !session) {
    return { session: null, response };
  }

  if (!isManager(session.user.systemRole)) {
    return {
      session: null,
      response: forbidden('当前仅管理员可以执行该操作。')
    };
  }

  if (workspaceId && !canAccessWorkspace(session, workspaceId)) {
    return {
      session: null,
      response: forbidden('你无法访问当前工作区。')
    };
  }

  return { session, response: null };
}

export async function requireSuperAdminApi() {
  const { session, response } = await requireApiSession();

  if (response || !session) {
    return { session: null, response };
  }

  if (session.user.systemRole !== 'super_admin') {
    return {
      session: null,
      response: forbidden('当前仅超级管理员可以执行该操作。')
    };
  }

  return { session, response: null };
}

export async function requireApiPermission(
  permissionCode: string,
  workspaceId?: string | null,
  message = '你没有执行该操作的权限。'
) {
  const { session, response } = await requireApiSession();

  if (response || !session) {
    return { session: null, response };
  }

  if (workspaceId && !canAccessWorkspace(session, workspaceId)) {
    return {
      session: null,
      response: forbidden('你无法访问当前工作区。')
    };
  }

  if (!hasPermission(session.user, permissionCode, workspaceId)) {
    return {
      session: null,
      response: forbidden(message)
    };
  }

  return { session, response: null };
}

export async function requireAnyApiPermission(
  permissionCodes: string[],
  workspaceId?: string | null,
  message = '你没有执行该操作的权限。'
) {
  const { session, response } = await requireApiSession();

  if (response || !session) {
    return { session: null, response };
  }

  if (workspaceId && !canAccessWorkspace(session, workspaceId)) {
    return {
      session: null,
      response: forbidden('你无法访问当前工作区。')
    };
  }

  if (!hasAnyPermission(session.user, permissionCodes, workspaceId)) {
    return {
      session: null,
      response: forbidden(message)
    };
  }

  return { session, response: null };
}
