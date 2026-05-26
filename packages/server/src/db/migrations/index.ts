import type { Migration } from '../migrate.js';
import m001 from './001-replicants-port.js';
import m002 from './002-replicant-tokens.js';
import m004 from './004-harness-enum.js';
import m005 from './005-comment-dispatches.js';

// Note: there is a historical gap at version 003. The runner only requires
// versions to be monotonic and applied in ascending order, not contiguous.
export const migrations: Migration[] = [m001, m002, m004, m005];

export default migrations;
