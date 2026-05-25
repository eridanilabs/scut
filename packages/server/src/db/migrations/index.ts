import type { Migration } from '../migrate.js';
import m001 from './001-replicants-port.js';

export const migrations: Migration[] = [m001];

export default migrations;
