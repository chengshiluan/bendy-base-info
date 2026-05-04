import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { collectServerFacts, type CollectedFacts } from './collector';
import { decryptSecret } from './crypto';
import { SshClient } from './ssh-client';

const MAX_CONCURRENT = 5;
const OVERALL_TIMEOUT_MS = 20_000;

const runningByServer = new Map<number, Promise<void>>();
let activeCount = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot() {
  if (activeCount < MAX_CONCURRENT) {
    activeCount += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
  activeCount += 1;
}

function releaseSlot() {
  activeCount -= 1;
  const next = waitQueue.shift();
  if (next) {
    next();
  }
}

async function persistFacts(serverId: number, facts: CollectedFacts) {
  if (!db) return;
  const [inserted] = await db
    .insert(schema.opsServerFacts)
    .values({
      serverId,
      collectedAt: new Date(),
      osName: facts.osName,
      osVersion: facts.osVersion,
      kernel: facts.kernel,
      arch: facts.arch,
      cpuModel: facts.cpuModel,
      cpuCores: facts.cpuCores,
      memoryTotalMb: facts.memoryTotalMb,
      memoryUsedMb: facts.memoryUsedMb,
      uptimeSeconds: facts.uptimeSeconds,
      diskJson: facts.disks,
      networkJson: facts.networks,
      servicesJson: facts.services,
      rawJson: facts.raw
    })
    .returning({ id: schema.opsServerFacts.id });

  const patch: Record<string, unknown> = {
    status: 'healthy' as const,
    lastCollectedAt: new Date(),
    collectError: null,
    lastFactsId: inserted?.id ?? null,
    updatedAt: new Date()
  };
  if (facts.hostname) {
    patch.hostname = facts.hostname;
  }

  await db
    .update(schema.opsServers)
    .set(patch)
    .where(eq(schema.opsServers.id, serverId));
}

async function markUnreachable(serverId: number, error: unknown) {
  if (!db) return;
  const message = error instanceof Error ? error.message : String(error);
  await db
    .update(schema.opsServers)
    .set({
      status: 'unreachable',
      collectError: message.slice(0, 500),
      updatedAt: new Date()
    })
    .where(eq(schema.opsServers.id, serverId));
}

async function runCollectForServer(serverId: number) {
  if (!db) return;
  const [row] = await db
    .select()
    .from(schema.opsServers)
    .where(eq(schema.opsServers.id, serverId))
    .limit(1);
  if (!row) return;

  const secret = decryptSecret(row.secretCipher);
  if (!secret) {
    await db
      .update(schema.opsServers)
      .set({
        status: 'unreachable',
        collectError: '服务器凭据缺失或无法解密。',
        updatedAt: new Date()
      })
      .where(eq(schema.opsServers.id, serverId));
    return;
  }

  await db
    .update(schema.opsServers)
    .set({ status: 'collecting', updatedAt: new Date() })
    .where(eq(schema.opsServers.id, serverId));

  const ssh = new SshClient({
    host: row.ip,
    port: row.sshPort,
    username: row.sshUser,
    authType: row.authType,
    secret,
    passphrase: decryptSecret(row.secretPassphraseCipher)
  });

  try {
    const facts = await Promise.race<CollectedFacts>([
      collectServerFacts(ssh),
      new Promise<CollectedFacts>((_, reject) => {
        setTimeout(
          () => reject(new Error(`采集超时（超过 ${OVERALL_TIMEOUT_MS}ms）`)),
          OVERALL_TIMEOUT_MS
        );
      })
    ]);
    await persistFacts(serverId, facts);
  } catch (error) {
    await markUnreachable(serverId, error);
  } finally {
    ssh.dispose();
  }
}

export function dispatchCollect(serverId: number) {
  const existing = runningByServer.get(serverId);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    try {
      await acquireSlot();
      try {
        await runCollectForServer(serverId);
      } finally {
        releaseSlot();
      }
    } finally {
      runningByServer.delete(serverId);
    }
  })();

  runningByServer.set(serverId, task);
  task.catch(() => {
    // errors are captured and persisted inside runCollectForServer
  });
  return task;
}
