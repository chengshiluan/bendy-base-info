import type {
  OpsServerDiskEntry,
  OpsServerNetworkInterface,
  OpsServerServiceEntry
} from './types';
import { SshClient } from './ssh-client';

export interface CollectedFacts {
  osName: string | null;
  osVersion: string | null;
  kernel: string | null;
  arch: string | null;
  cpuModel: string | null;
  cpuCores: number | null;
  memoryTotalMb: number | null;
  memoryUsedMb: number | null;
  uptimeSeconds: number | null;
  hostname: string | null;
  disks: OpsServerDiskEntry[];
  networks: OpsServerNetworkInterface[];
  services: OpsServerServiceEntry[];
  raw: Record<string, unknown>;
}

interface CommandOutcome {
  stdout: string;
  stderr: string;
  code: number | null;
  error?: string;
}

async function safeExec(
  ssh: SshClient,
  command: string,
  timeoutMs = 8000
): Promise<CommandOutcome> {
  try {
    const result = await ssh.exec(command, timeoutMs);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code
    };
  } catch (error) {
    return {
      stdout: '',
      stderr: '',
      code: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function parseOsRelease(text: string) {
  const map = new Map<string, string>();
  text.split('\n').forEach((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) {
      return;
    }
    const value = match[2].trim().replace(/^"|"$/g, '');
    map.set(match[1], value);
  });
  return {
    osName: map.get('NAME') ?? map.get('ID') ?? null,
    osVersion: map.get('VERSION_ID') ?? map.get('VERSION') ?? null
  };
}

function parseUname(text: string) {
  const parts = text.trim().split(/\s+/);
  return {
    kernel: parts[1] ?? null,
    arch: parts[2] ?? null
  };
}

function parseMeminfo(text: string) {
  let totalKb: number | null = null;
  let availableKb: number | null = null;
  text.split('\n').forEach((line) => {
    const totalMatch = line.match(/^MemTotal:\s+(\d+)\s*kB/);
    if (totalMatch) {
      totalKb = Number(totalMatch[1]);
    }
    const availMatch = line.match(/^MemAvailable:\s+(\d+)\s*kB/);
    if (availMatch) {
      availableKb = Number(availMatch[1]);
    }
  });
  const totalMb = totalKb != null ? Math.round(totalKb / 1024) : null;
  const usedMb =
    totalKb != null && availableKb != null
      ? Math.round((totalKb - availableKb) / 1024)
      : null;
  return { totalMb, usedMb };
}

function parseDiskDfPT(text: string): OpsServerDiskEntry[] {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }
  return lines
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((cols) => cols.length >= 7)
    .map((cols) => ({
      filesystem: cols[0],
      type: cols[1],
      size: cols[2],
      used: cols[3],
      available: cols[4],
      usePercent: cols[5],
      mountedOn: cols.slice(6).join(' ')
    }));
}

function parseIpAddrJson(text: string): OpsServerNetworkInterface[] {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry: Record<string, unknown>) => {
        const name = typeof entry.ifname === 'string' ? entry.ifname : null;
        if (!name) {
          return null;
        }
        const mac =
          typeof entry.address === 'string' ? entry.address : null;
        const addrInfo = Array.isArray(entry.addr_info) ? entry.addr_info : [];
        const addresses = addrInfo
          .map((addr: Record<string, unknown>) =>
            typeof addr.local === 'string' ? addr.local : null
          )
          .filter((value: string | null): value is string => Boolean(value));
        return { name, mac, addresses };
      })
      .filter(
        (value: OpsServerNetworkInterface | null): value is OpsServerNetworkInterface =>
          Boolean(value)
      );
  } catch (_error) {
    return [];
  }
}

function parseServices(text: string): OpsServerServiceEntry[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const cols = line.split(/\s+/);
      if (cols.length < 4) {
        return null;
      }
      return {
        name: cols[0],
        load: cols[1],
        active: cols[2],
        sub: cols[3],
        description: cols.slice(4).join(' ')
      };
    })
    .filter(
      (value): value is OpsServerServiceEntry => value !== null
    );
}

function parseUptime(text: string) {
  const first = text.trim().split(/\s+/)[0];
  const value = Number(first);
  return Number.isFinite(value) ? Math.round(value) : null;
}

function parseCpuCores(text: string) {
  const value = Number(text.trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseCpuModel(text: string) {
  const match = text.match(/model name\s*:\s*(.+)/);
  return match ? match[1].trim() : null;
}

export async function collectServerFacts(
  ssh: SshClient
): Promise<CollectedFacts> {
  await ssh.waitReady();

  const [
    osRelease,
    uname,
    nprocOut,
    cpuinfoOut,
    meminfoOut,
    dfOut,
    ipOut,
    servicesOut,
    uptimeOut,
    hostnameOut
  ] = await Promise.all([
    safeExec(ssh, 'cat /etc/os-release'),
    safeExec(ssh, 'uname -srm'),
    safeExec(ssh, 'nproc'),
    safeExec(ssh, "grep -m1 'model name' /proc/cpuinfo"),
    safeExec(ssh, 'cat /proc/meminfo'),
    safeExec(ssh, 'df -PT'),
    safeExec(ssh, 'ip -j addr'),
    safeExec(
      ssh,
      'systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null || true'
    ),
    safeExec(ssh, 'cat /proc/uptime'),
    safeExec(ssh, 'hostname')
  ]);

  const osInfo = osRelease.stdout ? parseOsRelease(osRelease.stdout) : {
    osName: null,
    osVersion: null
  };
  const unameInfo = uname.stdout
    ? parseUname(uname.stdout)
    : { kernel: null, arch: null };
  const memInfo = meminfoOut.stdout
    ? parseMeminfo(meminfoOut.stdout)
    : { totalMb: null, usedMb: null };
  const disks = dfOut.stdout ? parseDiskDfPT(dfOut.stdout) : [];
  const networks = ipOut.stdout ? parseIpAddrJson(ipOut.stdout) : [];
  const services = servicesOut.stdout ? parseServices(servicesOut.stdout) : [];

  const facts: CollectedFacts = {
    osName: osInfo.osName,
    osVersion: osInfo.osVersion,
    kernel: unameInfo.kernel,
    arch: unameInfo.arch,
    cpuModel: cpuinfoOut.stdout ? parseCpuModel(cpuinfoOut.stdout) : null,
    cpuCores: nprocOut.stdout ? parseCpuCores(nprocOut.stdout) : null,
    memoryTotalMb: memInfo.totalMb,
    memoryUsedMb: memInfo.usedMb,
    uptimeSeconds: uptimeOut.stdout ? parseUptime(uptimeOut.stdout) : null,
    hostname: hostnameOut.stdout ? hostnameOut.stdout.trim() || null : null,
    disks,
    networks,
    services,
    raw: {
      osRelease: osRelease.stdout,
      uname: uname.stdout,
      uptime: uptimeOut.stdout,
      errors: [
        osRelease,
        uname,
        nprocOut,
        cpuinfoOut,
        meminfoOut,
        dfOut,
        ipOut,
        servicesOut,
        uptimeOut,
        hostnameOut
      ]
        .map((outcome, index) =>
          outcome.error
            ? { step: index, error: outcome.error }
            : null
        )
        .filter((value) => value !== null)
    }
  };

  if (!facts.osName && !facts.kernel) {
    throw new Error('采集失败：无法读取 /etc/os-release 与 uname 输出。');
  }

  return facts;
}
