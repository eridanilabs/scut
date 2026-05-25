import type { Migration } from '../migrate.js';
import m001 from './001-replicants-port.js';
import m002 from './002-replicant-tokens.js';
import m004 from './004-harness-enum.js';

export const migrations: Migration[] = [m001, m002, m004];

export default migrations;
