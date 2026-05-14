import { IBobConnector } from './IBobConnector.js';

const registry = new Map<string, IBobConnector>();

export function registerConnector(bobId: string, connector: IBobConnector): void {
  registry.set(bobId, connector);
}

export function getConnector(bobId: string): IBobConnector | undefined {
  return registry.get(bobId);
}

export function removeConnector(bobId: string): void {
  registry.delete(bobId);
}

export function listConnectors(): string[] {
  return Array.from(registry.keys());
}
