import { PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiPermission, unavailable } from '@/lib/auth/api-guard';
import { env } from '@/lib/env';
import { saveFileAsset } from '@/lib/platform/mutations';
import { actionPermissionCode } from '@/lib/platform/rbac';
import { getS3Client, getS3PublicUrl } from '@/lib/storage/s3';
import { slugify } from '@/lib/utils';

const uploadSchema = z.object({
  workspaceId: z.string().optional(),
  entityType: z.enum(['ticket', 'ticket_comment', 'workspace', 'general']),
  entityId: z.string().optional()
});

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json({ message: '上传表单无效。' }, { status: 400 });
  }

  const file = formData.get('file');
  const parsed = uploadSchema.safeParse({
    workspaceId: formData.get('workspaceId') ?? undefined,
    entityType: formData.get('entityType') ?? undefined,
    entityId: formData.get('entityId') ?? undefined
  });

  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json(
      { message: '上传参数校验失败。' },
      { status: 400 }
    );
  }

  const permissionCode =
    parsed.data.entityType === 'ticket' ||
    parsed.data.entityType === 'ticket_comment'
      ? actionPermissionCode('upload', 'dashboard', 'workspaces', 'tickets')
      : actionPermissionCode('update', 'dashboard', 'workspaces');
  const { session, response } = await requireApiPermission(
    permissionCode,
    parsed.data.workspaceId
  );

  if (response || !session) {
    return response;
  }

  const client = getS3Client();
  if (!client || !env.storage.bucket) {
    return unavailable('S3 尚未配置，当前无法上传文件。');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const safeName = slugify(file.name.replace(/\.[^.]+$/, '')) || 'file';
  const extension = file.name.includes('.') ? file.name.split('.').pop() : '';
  const objectKey = [
    parsed.data.entityType,
    parsed.data.entityId ?? 'general',
    `${Date.now()}-${safeName}${extension ? `.${extension}` : ''}`
  ].join('/');

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: env.storage.bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream'
      })
    );

    const fileAsset = await saveFileAsset(session.user.id, {
      workspaceId: parsed.data.workspaceId,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      bucket: env.storage.bucket,
      objectKey,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      publicUrl: getS3PublicUrl(objectKey)
    });

    return NextResponse.json({ file: fileAsset });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: '文件上传失败。' }, { status: 500 });
  }
}
