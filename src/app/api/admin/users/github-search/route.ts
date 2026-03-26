import { NextResponse } from 'next/server';
import { requireManagerApi } from '@/lib/auth/api-guard';
import { searchGithubUsers, GithubApiError } from '@/lib/platform/github';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? undefined;
  const query = url.searchParams.get('query')?.trim() ?? '';
  const { response } = await requireManagerApi(workspaceId);

  if (response) {
    return response;
  }

  if (query.length < 2) {
    return NextResponse.json({ githubUsers: [] });
  }

  try {
    const githubUsers = await searchGithubUsers(query);
    return NextResponse.json({ githubUsers });
  } catch (error) {
    if (error instanceof GithubApiError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    console.error(error);
    return NextResponse.json(
      { message: 'GitHub 搜索失败，请稍后再试。' },
      { status: 500 }
    );
  }
}
