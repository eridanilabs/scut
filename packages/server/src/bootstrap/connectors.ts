import { listReplicants } from '../db/ReplicantRepo.js';
import { registerConnector } from '../connectors/ConnectorRegistry.js';
import { CopilotBridgeConnector } from '../connectors/CopilotBridgeConnector.js';
import { AcpConnector } from '../connectors/acp/AcpConnector.js';
import { registerAcpConnector } from '../connectors/v2/AcpConnectorRegistry.js';
import type {
  AcpReplicantConfig,
  AcpTransportConfig,
} from '../connectors/acp/types.js';
import db from '../db/db.js';

export function resolveAcpTransport(cfg: AcpReplicantConfig): AcpTransportConfig {
  const envDefault = process.env.SCUT_ACP_TRANSPORT_DEFAULT as
    | 'tcp'
    | 'stdio'
    | undefined;
  const transport = cfg.transport ?? envDefault ?? 'tcp';
  if (transport === 'stdio') {
    // Per bill-znj MEDIUM 1: do NOT bleed cfg.tcp.command into stdio
    // resolution. Each transport branch resolves its own command.
    const command =
      process.env.SCUT_ACP_COPILOT_PATH ?? cfg.stdio?.command ?? 'copilot';
    return {
      transport: 'stdio',
      mode: 'stdio',
      command,
      args: cfg.stdio?.args ?? ['--acp'],
      cwd: cfg.stdio?.cwd,
    };
  }
  const mode = cfg.tcp?.mode ?? 'spawn';
  if (mode === 'dial') {
    if (cfg.tcp?.port === undefined) {
      throw new Error(
        'AcpConnector: tcp.port is required when tcp.mode === "dial"'
      );
    }
    return {
      transport: 'tcp',
      mode: 'dial',
      host: cfg.tcp.host ?? '127.0.0.1',
      port: cfg.tcp.port,
    };
  }
  // Per bill-znj MEDIUM 1: do NOT bleed cfg.stdio.command into tcp
  // spawn resolution. Each transport branch resolves its own command.
  const command =
    process.env.SCUT_ACP_COPILOT_PATH ?? cfg.tcp?.command ?? 'copilot';
  return {
    transport: 'tcp',
    mode: 'spawn',
    command,
    args: cfg.tcp?.args ?? ['--acp', '--port', '0'],
    cwd: cfg.tcp?.cwd,
  };
}

export function bootstrapConnectors(): void {
  const replicants = listReplicants();
  let count = 0;
  let acpCount = 0;
  for (const replicant of replicants) {
    if (replicant.harness === 'copilot-bridge' && replicant.status === 'online') {
      let config: Record<string, unknown>;
      try {
        config = JSON.parse(replicant.config) as Record<string, unknown>;
      } catch {
        continue;
      }
      const webhookUrl = config.webhookUrl as string | undefined;
      const callbackUrl = (config.callbackUrl as string | undefined) ?? 'http://localhost:3000';
      const secret = config.secret as string | undefined;
      if (!webhookUrl) continue;
      registerConnector(replicant.id, new CopilotBridgeConnector({ webhookUrl, callbackUrl, secret }));
      count++;
    }
  }
  for (const replicant of replicants) {
    if (replicant.harness !== 'acp') continue;
    if (replicant.status !== 'online') continue;
    let cfg: AcpReplicantConfig;
    try {
      cfg = JSON.parse(replicant.config) as AcpReplicantConfig;
    } catch {
      continue;
    }
    let transport: AcpTransportConfig;
    try {
      transport = resolveAcpTransport(cfg);
    } catch (err) {
      console.warn(
        `bootstrapConnectors: skipping replicant ${replicant.id}: ${(err as Error).message}`
      );
      continue;
    }
    registerAcpConnector(
      replicant.id,
      new AcpConnector({
        replicantId: replicant.id,
        transport,
        db,
        clientInfo: cfg.clientInfo,
      })
    );
    acpCount++;
  }
  console.log(`bootstrapConnectors: registered ${count} connector(s)`);
  console.log(`bootstrapConnectors: registered ${acpCount} ACP connector(s)`);
}
