import { z } from 'zod';

const trimmedString = z.string().trim();

function normalizeNullableInput(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

const nullableString = z
  .union([trimmedString, z.null(), z.undefined()])
  .transform(normalizeNullableInput);

const nullableSlug = z
  .union([z.string().trim().max(80), z.null(), z.undefined()])
  .transform(normalizeNullableInput);

export const workspacePayloadSchema = z.object({
  name: trimmedString.min(1).max(120),
  slug: nullableSlug,
  description: nullableString,
  status: z.enum(['active', 'archived']).default('active')
});

export const userPayloadSchema = z.object({
  workspaceId: z.string().min(1),
  githubUsername: trimmedString.min(1).max(39),
  displayName: nullableString,
  email: z
    .union([z.string().trim().email(), z.literal(''), z.undefined()])
    .transform((value) => (value ? value.toLowerCase() : null)),
  systemRole: z.enum(['super_admin', 'admin', 'member']),
  status: z.enum(['active', 'invited', 'disabled']),
  emailLoginEnabled: z.boolean().default(true)
});

export const rolePayloadSchema = z.object({
  workspaceId: z.string().min(1),
  key: trimmedString.min(1).max(80),
  name: trimmedString.min(1).max(120),
  description: nullableString,
  permissionIds: z.array(z.string().min(1)).default([])
});

export const permissionPayloadSchema = z.object({
  code: trimmedString.min(1).max(120),
  name: trimmedString.min(1).max(120),
  module: trimmedString.min(1).max(60),
  action: trimmedString.min(1).max(60),
  description: nullableString
});

export const teamPayloadSchema = z.object({
  workspaceId: z.string().min(1),
  name: trimmedString.min(1).max(120),
  slug: nullableSlug,
  description: nullableString,
  leadUserId: nullableString,
  memberIds: z.array(z.string().min(1)).default([])
});

export const githubUserImportPayloadSchema = z.object({
  workspaceId: z.string().min(1),
  githubUsernames: z
    .array(
      trimmedString
        .min(1)
        .max(39)
        .transform((value) => value.replace(/^@/, '').toLowerCase())
    )
    .min(1)
    .max(20)
});

export const notificationPayloadSchema = z.object({
  workspaceId: nullableString,
  userId: nullableString,
  title: trimmedString.min(1).max(160),
  content: trimmedString.min(1),
  level: z.enum(['info', 'success', 'warning', 'error']),
  isRead: z.boolean().optional()
});

export const notificationReadPayloadSchema = z.object({
  isRead: z.boolean()
});

export const ticketPayloadSchema = z.object({
  workspaceId: z.string().min(1),
  title: trimmedString.min(1).max(180),
  description: nullableString,
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).default('open'),
  assigneeId: nullableString
});

export const ticketCommentPayloadSchema = z.object({
  body: trimmedString.min(1),
  attachmentIds: z.array(z.string().min(1)).default([])
});
