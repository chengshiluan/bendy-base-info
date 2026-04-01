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

const nullableUrl = z
  .union([z.string().trim().url(), z.literal(''), z.null(), z.undefined()])
  .transform((value) => (typeof value === 'string' && value ? value : null));

const nullableDateTime = z
  .union([trimmedString, z.null(), z.undefined()])
  .transform(normalizeNullableInput);

const nullableInteger = z
  .union([z.coerce.number().int().positive(), z.null(), z.undefined()])
  .transform((value) => (typeof value === 'number' ? value : null));

export const accountWealthEntrySchema = z.object({
  key: trimmedString.min(1).max(120),
  value: trimmedString.min(1).max(2000)
});

export const accountPayloadSchema = z.object({
  workspaceId: z.string().min(1),
  platformId: nullableInteger,
  account: trimmedString.min(1).max(255),
  attribute: z.enum(['self_hosted', 'third_party']),
  confidence: z.enum(['very_high', 'high', 'medium', 'low']),
  password: nullableString,
  registeredAt: nullableDateTime,
  status: z.enum(['cancelled', 'available', 'banned']),
  wealthEntries: z.array(accountWealthEntrySchema).default([]),
  sourceIds: z.array(z.coerce.number().int().positive()).default([])
});

export const platformPayloadSchema = z.object({
  workspaceId: z.string().min(1),
  name: trimmedString.min(1).max(120),
  url: z.string().trim().url(),
  iconUrl: nullableUrl,
  region: z.enum(['overseas', 'mainland', 'hk_mo_tw'])
});

export const registrationSourcePayloadSchema = z.object({
  workspaceId: z.string().min(1),
  name: trimmedString.min(1).max(120),
  code: trimmedString.min(1).max(120),
  website: nullableUrl,
  remark: nullableString
});

export const accountKeyPayloadSchema = z.object({
  title: trimmedString.min(1).max(120),
  content: trimmedString.min(1),
  expiresAt: nullableDateTime
});

export const accountBindingPayloadSchema = z.object({
  platformId: nullableInteger,
  platformAccount: trimmedString.min(1).max(255)
});

export const accountBindingBatchPayloadSchema = z.object({
  items: z.array(accountBindingPayloadSchema).min(1).max(20)
});

export const accountSecurityPayloadSchema = z.object({
  securityType: z.enum([
    'question',
    'two_factor',
    'contact',
    'emergency_email'
  ]),
  content: trimmedString.min(1)
});

export const accountSourceAssignmentPayloadSchema = z.object({
  sourceIds: z.array(z.coerce.number().int().positive()).default([])
});

export const accountPrimaryPlatformPayloadSchema = z.object({
  workspaceId: z.string().min(1),
  platformId: nullableInteger
});
