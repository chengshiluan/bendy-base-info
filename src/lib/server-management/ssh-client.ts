import { Client, type ClientChannel, type ConnectConfig } from 'ssh2';

export interface SshExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
  durationMs: number;
}

export interface SshConnectOptions {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'private_key';
  secret: string;
  passphrase?: string | null;
  connectTimeoutMs?: number;
  readyTimeoutMs?: number;
}

export class SshClient {
  private client: Client;
  private ready: Promise<void>;

  constructor(private options: SshConnectOptions) {
    this.client = new Client();
    this.ready = this.connect();
  }

  private connect() {
    const {
      host,
      port,
      username,
      authType,
      secret,
      passphrase,
      connectTimeoutMs = 8000,
      readyTimeoutMs = 8000
    } = this.options;

    const config: ConnectConfig = {
      host,
      port,
      username,
      readyTimeout: readyTimeoutMs,
      timeout: connectTimeoutMs,
      keepaliveInterval: 0,
      algorithms: {
        serverHostKey: [
          'ssh-ed25519',
          'ecdsa-sha2-nistp256',
          'ecdsa-sha2-nistp384',
          'ecdsa-sha2-nistp521',
          'rsa-sha2-512',
          'rsa-sha2-256',
          'ssh-rsa'
        ]
      }
    };

    if (authType === 'password') {
      config.password = secret;
    } else {
      config.privateKey = secret;
      if (passphrase) {
        config.passphrase = passphrase;
      }
    }

    return new Promise<void>((resolve, reject) => {
      this.client.once('ready', () => resolve());
      this.client.once('error', (err) => reject(err));
      try {
        this.client.connect(config);
      } catch (error) {
        reject(error);
      }
    });
  }

  async waitReady() {
    await this.ready;
  }

  async exec(command: string, timeoutMs = 8000): Promise<SshExecResult> {
    await this.ready;

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      let stdout = '';
      let stderr = '';
      let finished = false;

      const timer = setTimeout(() => {
        if (finished) {
          return;
        }
        finished = true;
        reject(new Error(`exec timeout after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      this.client.exec(command, (err, stream: ClientChannel) => {
        if (err) {
          if (finished) {
            return;
          }
          finished = true;
          clearTimeout(timer);
          reject(err);
          return;
        }

        stream.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8');
        });
        stream.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8');
        });
        stream.on('close', (code: number | null) => {
          if (finished) {
            return;
          }
          finished = true;
          clearTimeout(timer);
          resolve({
            stdout,
            stderr,
            code,
            durationMs: Date.now() - startedAt
          });
        });
        stream.on('error', (streamErr: Error) => {
          if (finished) {
            return;
          }
          finished = true;
          clearTimeout(timer);
          reject(streamErr);
        });
      });
    });
  }

  dispose() {
    try {
      this.client.end();
    } catch (_error) {
      // swallow; socket may already be closed
    }
  }
}
