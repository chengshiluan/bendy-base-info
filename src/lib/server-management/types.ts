import type {
  opsServerAuthTypeValues,
  opsServerStatusValues
} from '@/lib/db/schema';

export type OpsServerStatus = (typeof opsServerStatusValues)[number];
export type OpsServerAuthType = (typeof opsServerAuthTypeValues)[number];

export interface OpsServerDiskEntry {
  filesystem: string;
  type: string;
  size: string;
  used: string;
  available: string;
  usePercent: string;
  mountedOn: string;
}

export interface OpsServerNetworkInterface {
  name: string;
  mac: string | null;
  addresses: string[];
}

export interface OpsServerServiceEntry {
  name: string;
  load: string;
  active: string;
  sub: string;
  description: string;
}

export interface OpsServerFactsSummary {
  id: number;
  serverId: number;
  collectedAt: string;
  osName: string | null;
  osVersion: string | null;
  kernel: string | null;
  arch: string | null;
  cpuModel: string | null;
  cpuCores: number | null;
  memoryTotalMb: number | null;
  memoryUsedMb: number | null;
  uptimeSeconds: number | null;
  disks: OpsServerDiskEntry[];
  networks: OpsServerNetworkInterface[];
  services: OpsServerServiceEntry[];
  raw: Record<string, unknown>;
}

export interface OpsServerSummary {
  id: number;
  workspaceId: string;
  name: string;
  hostname: string | null;
  ip: string;
  sshPort: number;
  sshUser: string;
  authType: OpsServerAuthType;
  status: OpsServerStatus;
  hasSecret: boolean;
  hasPassphrase: boolean;
  lastCollectedAt: string | null;
  lastFactsId: number | null;
  collectError: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpsServerDetail extends OpsServerSummary {
  latestFacts: OpsServerFactsSummary | null;
}
