import type { NextAuthOptions } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { z } from 'zod';
import { env } from '@/lib/env';
import {
  buildAuthUserSnapshot,
  findUserByEmail,
  findUserByGithubUsername,
  syncGithubProfile
} from '@/lib/auth/service';
import { normalizeWorkspacePermissionMap } from '@/lib/auth/permission';
import { consumeLoginCode } from '@/lib/auth/email-code';

const credentialsSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6)
});

function getGithubProfileValue(
  profile: unknown,
  key: 'login' | 'id' | 'name' | 'avatar_url' | 'email'
) {
  if (!profile || typeof profile !== 'object') {
    return undefined;
  }

  const value = (profile as Record<string, unknown>)[key];
  return value;
}

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    id: 'email-code',
    name: 'Email Code',
    credentials: {
      email: { label: 'Email', type: 'email' },
      code: { label: 'Code', type: 'text' }
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }

      const { email, code } = parsed.data;
      const verified = await consumeLoginCode(email, code);
      if (!verified) {
        return null;
      }

      const user = await findUserByEmail(email);
      if (!user || user.status !== 'active') {
        return null;
      }

      return buildAuthUserSnapshot(user.id);
    }
  })
];

if (
  env.auth.githubEnabled &&
  env.auth.githubClientId &&
  env.auth.githubClientSecret
) {
  providers.push(
    GitHubProvider({
      clientId: env.auth.githubClientId,
      clientSecret: env.auth.githubClientSecret
    })
  );
}

export const authOptions: NextAuthOptions = {
  secret: env.auth.secret,
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/auth/sign-in'
  },
  providers,
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== 'github') {
        return true;
      }

      const githubLogin = getGithubProfileValue(profile, 'login');
      const githubId = getGithubProfileValue(profile, 'id');
      const githubName = getGithubProfileValue(profile, 'name');
      const githubAvatarUrl = getGithubProfileValue(profile, 'avatar_url');
      const githubEmail = getGithubProfileValue(profile, 'email');

      const githubUsername =
        typeof githubLogin === 'string' ? githubLogin.toLowerCase() : undefined;

      if (!githubUsername) {
        return '/auth/sign-in?error=github_profile';
      }

      const user = await findUserByGithubUsername(githubUsername);
      if (!user || user.status !== 'active') {
        return '/auth/sign-in?error=github_not_allowed';
      }

      await syncGithubProfile({
        userId: user.id,
        githubUserId:
          typeof githubId === 'number' || typeof githubId === 'string'
            ? `${githubId}`
            : null,
        displayName:
          typeof githubName === 'string' ? githubName : githubUsername,
        avatarUrl: typeof githubAvatarUrl === 'string' ? githubAvatarUrl : null,
        email: typeof githubEmail === 'string' ? githubEmail : null
      });

      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.id = user.id;
        token.githubUsername = user.githubUsername;
        token.systemRole = user.systemRole;
        token.permissions = user.permissions;
        token.workspacePermissions = user.workspacePermissions;
        token.workspaceIds = user.workspaceIds;
        token.defaultWorkspaceId = user.defaultWorkspaceId;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }

      const githubLogin =
        account?.provider === 'github'
          ? getGithubProfileValue(profile, 'login')
          : undefined;
      const githubUsername =
        typeof githubLogin === 'string' ? githubLogin.toLowerCase() : undefined;
      const snapshotUserId =
        typeof token.id === 'string'
          ? token.id
          : githubUsername
            ? (await findUserByGithubUsername(githubUsername))?.id
            : undefined;

      if (snapshotUserId) {
        const snapshot = await buildAuthUserSnapshot(snapshotUserId);
        if (snapshot) {
          token.id = snapshot.id;
          token.githubUsername = snapshot.githubUsername;
          token.systemRole = snapshot.systemRole;
          token.permissions = snapshot.permissions;
          token.workspacePermissions = snapshot.workspacePermissions;
          token.workspaceIds = snapshot.workspaceIds;
          token.defaultWorkspaceId = snapshot.defaultWorkspaceId;
          token.name = snapshot.name;
          token.email = snapshot.email;
          token.picture = snapshot.image;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === 'string' ? token.id : '';
        session.user.githubUsername =
          typeof token.githubUsername === 'string' ? token.githubUsername : '';
        session.user.systemRole =
          token.systemRole === 'super_admin' ||
          token.systemRole === 'admin' ||
          token.systemRole === 'member'
            ? token.systemRole
            : 'member';
        session.user.permissions = Array.isArray(token.permissions)
          ? token.permissions.filter(
              (value): value is string => typeof value === 'string'
            )
          : [];
        session.user.workspacePermissions = normalizeWorkspacePermissionMap(
          token.workspacePermissions
        );
        session.user.workspaceIds = Array.isArray(token.workspaceIds)
          ? token.workspaceIds.filter(
              (value): value is string => typeof value === 'string'
            )
          : [];
        session.user.defaultWorkspaceId =
          typeof token.defaultWorkspaceId === 'string'
            ? token.defaultWorkspaceId
            : null;
        session.user.image =
          typeof token.picture === 'string' ? token.picture : null;
        session.user.email =
          typeof token.email === 'string' ? token.email : null;
        session.user.name =
          typeof token.name === 'string'
            ? token.name
            : session.user.githubUsername;
      }

      return session;
    }
  }
};
