#!/usr/bin/env node
// Test fixture: a silent ACP-like server that listens on the static
// port supplied via `--port <n>` and prints NOTHING to stdout/stderr.
// Models the observed behavior of the live `copilot --acp --port N`
// CLI which never announces its port.
//
// This fixture also records its argv (when SCUT_FIXTURE_ARGS_OUT is
// set) so callers can assert what flags the transport layer passed.
//
// `--bind <host>` or `--bind=<host>` is accepted and used as the
// listen host. This supports the bill-znj MEDIUM 2 defense-in-depth
// test where the transport injects `--bind 127.0.0.1` for
// non-Copilot harnesses.
import { createServer } from 'node:net';
import fs from 'node:fs';

const argv = process.argv.slice(2);

if (process.env.SCUT_FIXTURE_ARGS_OUT) {
  fs.writeFileSync(process.env.SCUT_FIXTURE_ARGS_OUT, JSON.stringify(argv));
}

const portIdx = argv.indexOf('--port');
const port = portIdx >= 0 ? Number(argv[portIdx + 1]) : NaN;
if (!Number.isFinite(port) || port <= 0) {
  process.stderr.write('fake-acp-static: requires --port <n>\n');
  process.exit(1);
}

let bindHost = '127.0.0.1';
const bindIdx = argv.indexOf('--bind');
if (bindIdx >= 0 && argv[bindIdx + 1]) {
  bindHost = argv[bindIdx + 1];
} else {
  const eq = argv.find((a) => a.startsWith('--bind='));
  if (eq) bindHost = eq.slice('--bind='.length);
}

const server = createServer((socket) => {
  socket.on('error', () => { /* ignore */ });
});
server.on('error', (err) => {
  process.stderr.write(`fake-acp-static: listen error: ${err.message}\n`);
  process.exit(1);
});
server.listen(port, bindHost, () => {
  // intentionally silent - no port announcement
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}
