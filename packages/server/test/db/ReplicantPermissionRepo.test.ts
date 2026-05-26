import '../setup.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { nanoid } from 'nanoid';
import db from '../../src/db/db.js';
import {
  normalizeToolKey,
  upsertReplicantPermission,
  getReplicantPermission,
  listReplicantPermissions,
  deleteReplicantPermission,
} from '../../src/db/ReplicantPermissionRepo.js';

function seedReplicant(name: string): string {
  const id = nanoid();
  db.prepare(
    "INSERT INTO replicants (id, name, harness, status) VALUES (?, ?, 'acp', 'unknown')"
  ).run(id, name);
  return id;
}

describe('normalizeToolKey', () => {
  it('lowercases, trims, and collapses whitespace to slash', () => {
    assert.equal(normalizeToolKey('  Read File  '), 'read/file');
  });
  it('preserves existing slash-separated keys and underscores', () => {
    assert.equal(normalizeToolKey('fs/read_text_file'), 'fs/read_text_file');
  });
  it('collapses multi-word names into slash-joined lower case', () => {
    assert.equal(normalizeToolKey('Terminal Execute'), 'terminal/execute');
  });
  it('collapses internal slash runs after whitespace replacement', () => {
    assert.equal(normalizeToolKey('fs/  readFile'), 'fs/readfile');
  });
  it('strips leading/trailing slashes and collapses surrounded whitespace', () => {
    assert.equal(normalizeToolKey('///Terminal   Execute///'), 'terminal/execute');
  });
});

describe('ReplicantPermissionRepo', () => {
  let replicantId: string;
  let otherReplicantId: string;

  before(() => {
    // The shared db module runs migrations on import; nothing else to do.
    replicantId = seedReplicant(`repo-test-${nanoid(6)}`);
    otherReplicantId = seedReplicant(`repo-test-other-${nanoid(6)}`);
  });

  it('upserts and reads back a scope=session permission', () => {
    const row = upsertReplicantPermission({
      replicantId,
      tool: 'fs/read_text_file',
      scope: 'session',
      decision: 'allow',
      acpSessionId: 'sess-1',
    });
    assert.equal(row.replicant_id, replicantId);
    assert.equal(row.tool, 'fs/read_text_file');
    assert.equal(row.scope, 'session');
    assert.equal(row.decision, 'allow');
    assert.equal(row.acp_session_id, 'sess-1');

    const fetched = getReplicantPermission({
      replicantId,
      tool: 'fs/read_text_file',
      scope: 'session',
      acpSessionId: 'sess-1',
    });
    assert.ok(fetched);
    assert.equal(fetched!.id, row.id);
  });

  it('upserts and reads back a scope=replicant permission', () => {
    const row = upsertReplicantPermission({
      replicantId,
      tool: 'Terminal Execute',
      scope: 'replicant',
      decision: 'deny',
    });
    assert.equal(row.tool, 'terminal/execute');
    assert.equal(row.scope, 'replicant');
    assert.equal(row.decision, 'deny');
    assert.equal(row.acp_session_id, null);

    const fetched = getReplicantPermission({
      replicantId,
      tool: 'terminal/execute',
      scope: 'replicant',
    });
    assert.ok(fetched);
    assert.equal(fetched!.id, row.id);
  });

  it('throws when scope=session is missing acpSessionId', () => {
    assert.throws(
      () =>
        upsertReplicantPermission({
          replicantId,
          tool: 'fs/write_text_file',
          scope: 'session',
          decision: 'allow',
        }),
      /scope=session requires acp_session_id/
    );
  });

  it('throws when scope=session is given empty-string acpSessionId', () => {
    assert.throws(
      () =>
        upsertReplicantPermission({
          replicantId,
          tool: 'fs/write_text_file',
          scope: 'session',
          decision: 'allow',
          acpSessionId: '',
        }),
      /scope=session requires acp_session_id/
    );
  });

  it('throws when scope=session is given whitespace-only acpSessionId', () => {
    assert.throws(
      () =>
        upsertReplicantPermission({
          replicantId,
          tool: 'fs/write_text_file',
          scope: 'session',
          decision: 'allow',
          acpSessionId: '   ',
        }),
      /scope=session requires acp_session_id/
    );
  });

  it('throws when scope=session is given null acpSessionId', () => {
    assert.throws(
      () =>
        upsertReplicantPermission({
          replicantId,
          tool: 'fs/write_text_file',
          scope: 'session',
          decision: 'allow',
          acpSessionId: null,
        }),
      /scope=session requires acp_session_id/
    );
  });

  it('throws when scope=replicant is given an acpSessionId', () => {
    assert.throws(
      () =>
        upsertReplicantPermission({
          replicantId,
          tool: 'fs/write_text_file',
          scope: 'replicant',
          decision: 'allow',
          acpSessionId: 'sess-x',
        }),
      /scope=replicant must not include acp_session_id/
    );
  });

  it('throws when normalized tool is empty (whitespace-only)', () => {
    assert.throws(
      () =>
        upsertReplicantPermission({
          replicantId,
          tool: '   ',
          scope: 'replicant',
          decision: 'allow',
        }),
      /tool must not be empty after normalization/
    );
  });

  it('getReplicantPermission returns undefined for missing rows', () => {
    const got = getReplicantPermission({
      replicantId,
      tool: 'nope/nada',
      scope: 'replicant',
    });
    assert.equal(got, undefined);
  });

  it('listReplicantPermissions returns all rows for a replicant_id', () => {
    const rid = seedReplicant(`repo-list-${nanoid(6)}`);
    upsertReplicantPermission({
      replicantId: rid,
      tool: 'a',
      scope: 'replicant',
      decision: 'allow',
    });
    upsertReplicantPermission({
      replicantId: rid,
      tool: 'b',
      scope: 'session',
      decision: 'deny',
      acpSessionId: 's-1',
    });
    const rows = listReplicantPermissions(rid);
    assert.equal(rows.length, 2);
    const tools = rows.map((r) => r.tool).sort();
    assert.deepEqual(tools, ['a', 'b']);
  });

  it('deleteReplicantPermission returns true then false for correct owner', () => {
    const row = upsertReplicantPermission({
      replicantId: otherReplicantId,
      tool: 'delete/me',
      scope: 'replicant',
      decision: 'allow',
    });
    assert.equal(deleteReplicantPermission(row.id, otherReplicantId), true);
    assert.equal(deleteReplicantPermission(row.id, otherReplicantId), false);
  });

  it('deleteReplicantPermission with replicantId scope does not delete foreign rows', () => {
    const row = upsertReplicantPermission({
      replicantId: otherReplicantId,
      tool: 'delete/scoped',
      scope: 'replicant',
      decision: 'allow',
    });
    // Wrong owner: should not delete.
    assert.equal(deleteReplicantPermission(row.id, replicantId), false);
    // Row still exists.
    const stillThere = getReplicantPermission({
      replicantId: otherReplicantId,
      tool: 'delete/scoped',
      scope: 'replicant',
    });
    assert.ok(stillThere);
    // Correct owner: deletes.
    assert.equal(deleteReplicantPermission(row.id, otherReplicantId), true);
  });

  it('upsert is idempotent on the normalized key and updates decision + created_at', () => {
    const rid = seedReplicant(`repo-idem-${nanoid(6)}`);
    // First insert.
    const first = upsertReplicantPermission({
      replicantId: rid,
      tool: '  Read File  ',
      scope: 'replicant',
      decision: 'allow',
    });
    assert.equal(first.tool, 'read/file');

    // Force created_at to a known older fixed timestamp to make the
    // bumped-timestamp assertion deterministic without sleeping.
    const FIXED_OLD = '2000-01-01 00:00:00';
    db.prepare('UPDATE replicant_permissions SET created_at = ? WHERE id = ?').run(
      FIXED_OLD,
      first.id
    );

    // Second upsert: same normalized key, different decision.
    const second = upsertReplicantPermission({
      replicantId: rid,
      tool: 'read/file',
      scope: 'replicant',
      decision: 'deny',
    });

    // Exactly one matching row.
    const all = db
      .prepare(
        "SELECT * FROM replicant_permissions WHERE replicant_id = ? AND tool = 'read/file' AND scope = 'replicant'"
      )
      .all(rid) as { id: string; decision: string; created_at: string }[];
    assert.equal(all.length, 1);

    // Decision updated.
    assert.equal(second.decision, 'deny');
    assert.equal(all[0].decision, 'deny');

    // created_at bumped off the fixed old value.
    assert.notEqual(second.created_at, FIXED_OLD);
    assert.notEqual(all[0].created_at, FIXED_OLD);
  });
});
