#!/usr/bin/env node
// Test fixture for bill-znj final-review MEDIUM.
//
// Immediately writes an unrelated `metrics port: 9090` line to
// stderr (which parsePortFromStdout matches) BEFORE binding the
// real ACP listener on the loopback port supplied via `--port`.
//
// Used to prove that spawnAcpServer({ expectedPort }) does not
// race-settle on the wrong parsed port.
import { createServer } from 'node:net';

const argv = process.argv.slice(2);
const portIdx = argv.indexOf('--port');
const port = portIdx >= 0 ? Number(argv[portIdx + 1]) : NaN;
if (!Number.isFinite(port) || port <= 0) {
  process.stderr.write('fake-acp-wrong-port-line: requires --port <n>\n');
  process.exit(1);
}

// Emit the bogus port line immediately. This must NOT be picked
// up by spawnAcpServer when expectedPort is set.
process.stderr.write('metrics port: 9090\n');

const server = createServer((socket) => {
  socket.on('error', () => { /* ignore */ });
});

// Delay binding slightly so the bogus line has a chance to reach
// the parent's readline parser before the loopback port is up.
setTimeout(() => {
  server.listen(port, '127.0.0.1', () => {
    process.stderr.write(`acp ready on 127.0.0.1:${port}\n`);
  });
}, 50);

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    try { server.close(() => process.exit(0)); } catch { process.exit(0); }
    setTimeout(() => process.exit(0), 250).unref();
  });
}
