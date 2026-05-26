export type AcpTcpDialConfig = {
  mode: 'dial';
  host: string; // must be loopback: '127.0.0.1' | '::1' | 'localhost'
  port: number;
};

export type AcpTcpSpawnConfig = {
  mode: 'spawn';
  command: string; // executable, default 'copilot'
  args?: string[]; // default ['--acp', '--port', '0']
  cwd?: string; // default process.cwd()
  env?: Record<string, string>;
};

export type AcpStdioConfig = {
  mode: 'stdio';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
};

export type AcpTransportConfig =
  | (AcpTcpDialConfig & { transport: 'tcp' })
  | (AcpTcpSpawnConfig & { transport: 'tcp' })
  | (AcpStdioConfig & { transport: 'stdio' });

// Parsed shape of replicants.config when harness === 'acp'.
export type AcpReplicantConfig = {
  transport?: 'tcp' | 'stdio';
  tcp?: {
    mode?: 'dial' | 'spawn';
    host?: string;
    port?: number;
    command?: string;
    args?: string[];
    cwd?: string;
  };
  stdio?: {
    command?: string;
    args?: string[];
    cwd?: string;
  };
  clientInfo?: { name?: string; version?: string };
};

export type DispatchEventRow = {
  id: string;
  dispatch_id: string;
  sequence: number;
  kind: string;
  payload: string;
  created_at: string;
};

// connector_handle persisted in comment_dispatches.connector_handle.
// Encoded as JSON; opaque to the rest of SCUT per sec 10.3.
export type AcpSessionHandleData = {
  sessionId: string;
  promptIndex: number;
  replicantId: string;
};
