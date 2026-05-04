import { z } from 'zod';

const trimmedString = z.string().trim();

function normalizeNullable(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

const nullableString = z
  .union([trimmedString, z.null(), z.undefined()])
  .transform(normalizeNullable);

const ipPattern =
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}|[0-9a-fA-F:]+)$/;

const serverBaseSchema = z.object({
  workspaceId: trimmedString.min(1),
  name: trimmedString.min(1).max(120),
  hostname: nullableString,
  ip: trimmedString.min(1).max(64).regex(ipPattern, {
    message: 'IP 地址格式不合法。'
  }),
  sshPort: z.coerce.number().int().min(1).max(65535).default(22),
  sshUser: trimmedString.min(1).max(64),
  authType: z.enum(['password', 'private_key']),
  secret: nullableString,
  passphrase: nullableString,
  remark: nullableString
});

export const serverPayloadSchema = serverBaseSchema.refine(
  (value) => !(value.authType === 'password' && !value.secret),
  {
    message: '密码认证必须填写密码。',
    path: ['secret']
  }
);

export const serverUpdatePayloadSchema = serverBaseSchema.extend({
  keepSecret: z.coerce.boolean().default(false),
  keepPassphrase: z.coerce.boolean().default(false)
});

export type ServerPayload = z.infer<typeof serverPayloadSchema>;
export type ServerUpdatePayload = z.infer<typeof serverUpdatePayloadSchema>;
