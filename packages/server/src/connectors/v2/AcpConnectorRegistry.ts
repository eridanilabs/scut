import type { IReplicantConnectorV2 } from './IReplicantConnectorV2.js';

const registry = new Map<string, IReplicantConnectorV2>();

export function registerAcpConnector(
  replicantId: string,
  connector: IReplicantConnectorV2
): void {
  registry.set(replicantId, connector);
}

export function getAcpConnector(
  replicantId: string
): IReplicantConnectorV2 | undefined {
  return registry.get(replicantId);
}

export function removeAcpConnector(replicantId: string): void {
  registry.delete(replicantId);
}

export function listAcpConnectorIds(): string[] {
  return Array.from(registry.keys());
}
