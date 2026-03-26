import type { GithubSearchUser } from './types';

const GITHUB_API_BASE = 'https://api.github.com';

type GithubSearchResponse = {
  items?: Array<{
    login: string;
    id: number;
    avatar_url: string | null;
    html_url: string;
  }>;
};

type GithubUserResponse = {
  login: string;
  id: number;
  avatar_url: string | null;
  html_url: string;
  name: string | null;
  bio: string | null;
};

export interface GithubUserProfile {
  githubUsername: string;
  githubUserId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  profileUrl: string;
}

export class GithubApiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
  }
}

function getGithubHeaders() {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'bendywork-info-base',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  const token =
    process.env.GITHUB_API_TOKEN ??
    process.env.GITHUB_TOKEN ??
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function normalizeGithubUsername(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

async function readGithubErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | null;

  if (response.status === 404) {
    return 'GitHub 用户不存在。';
  }

  if (response.status === 403 || response.status === 429) {
    return 'GitHub 接口已触发速率限制，请稍后再试。';
  }

  return payload?.message || 'GitHub 服务暂时不可用，请稍后再试。';
}

async function requestGithub<T>(pathname: string, searchParams?: URLSearchParams) {
  const url = new URL(pathname, GITHUB_API_BASE);

  if (searchParams) {
    url.search = searchParams.toString();
  }

  const response = await fetch(url, {
    headers: getGithubHeaders(),
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new GithubApiError(
      await readGithubErrorMessage(response),
      response.status === 404 ? 404 : 502
    );
  }

  return (await response.json()) as T;
}

export async function searchGithubUsers(
  query: string,
  limit = 8
): Promise<GithubSearchUser[]> {
  const normalizedQuery = normalizeGithubUsername(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: `${normalizedQuery} in:login`,
    per_page: String(Math.min(Math.max(limit, 1), 20)),
    page: '1'
  });
  const payload = await requestGithub<GithubSearchResponse>(
    '/search/users',
    params
  );

  return (payload.items ?? []).map((user) => ({
    githubUsername: user.login.toLowerCase(),
    githubUserId: String(user.id),
    avatarUrl: user.avatar_url,
    profileUrl: user.html_url
  }));
}

export async function getGithubUserByUsername(
  username: string
): Promise<GithubUserProfile> {
  const normalizedUsername = normalizeGithubUsername(username);

  if (!normalizedUsername) {
    throw new GithubApiError('GitHub 用户名不能为空。', 400);
  }

  const payload = await requestGithub<GithubUserResponse>(
    `/users/${encodeURIComponent(normalizedUsername)}`
  );

  return {
    githubUsername: payload.login.toLowerCase(),
    githubUserId: String(payload.id),
    displayName: payload.name?.trim() || null,
    avatarUrl: payload.avatar_url,
    bio: payload.bio?.trim() || null,
    profileUrl: payload.html_url
  };
}
