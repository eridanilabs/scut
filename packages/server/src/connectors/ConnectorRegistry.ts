import { IReplicantConnector } from './IReplicantConnector.js';

const registry = new Map<string, IReplicantConnector>();

export function registerConnector(bobId: string, connector: IReplicantConnector): void {
  registry.set(bobId, connector);
}

export function getConnector(bobId: string): IReplicantConnector | undefined {
  return registry.get(bobId);
}

export function removeConnector(bobId: string): void {
  registry.delete(bobId);
}

export function listConnectors(): string[] {
  return Array.from(registry.keys());
}
