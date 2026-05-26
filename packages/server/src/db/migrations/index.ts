import type { Migration } from '../migrate.js';
import m001 from './001-replicants-port.js';
import m002 from './002-replicant-tokens.js';
import m003 from './003-replicant-permissions.js';
import m004 from './004-harness-enum.js';
import m005 from './005-comment-dispatches.js';
import m006 from './006-dispatch-events.js';

export const migrations: Migration[] = [m001, m002, m003, m004, m005, m006];

export default migrations;
