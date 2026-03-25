import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id: string;
    githubUsername: string;
    systemRole: 'super_admin' | 'admin' | 'member';
    permissions: string[];
    workspaceIds: string[];
    defaultWorkspaceId: string | null;
    name: string | null;
    email: string | null;
    image: string | null;
  }

  interface Session {
    user: {
      id: string;
      githubUsername: string;
      systemRole: 'super_admin' | 'admin' | 'member';
      permissions: string[];
      workspaceIds: string[];
      defaultWorkspaceId: string | null;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    githubUsername?: string;
    systemRole?: 'super_admin' | 'admin' | 'member';
    permissions?: string[];
    workspaceIds?: string[];
    defaultWorkspaceId?: string | null;
  }
}
