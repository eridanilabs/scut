#!/usr/bin/env node
// Test fixture: listens on a static loopback port supplied via
// `--port <n>` AND continuously floods stderr with ~2 MiB of data.
// If the parent process does not drain stderr the child will block
// on a full pipe buffer (typically ~64 KiB on Linux) and the test
// will time out, proving the stderr-drain fix in process.ts.
import { createServer } from 'node:net';

const argv = process.argv.slice(2);
const portIdx = argv.indexOf('--port');
const port = portIdx >= 0 ? Number(argv[portIdx + 1]) : NaN;
if (!Number.isFinite(port) || port <= 0) {
  process.stderr.write('fake-acp-noisy-stderr: requires --port <n>\n');
  process.exit(1);
}

const server = createServer((socket) => {
  socket.on('error', () => { /* ignore */ });
});
server.listen(port, '127.0.0.1', () => {
  const chunk = 'X'.repeat(1024) + '\n';
  let written = 0;
  const TARGET = 2 * 1024 * 1024; // 2 MiB
  const id = setInterval(() => {
    process.stderr.write(chunk);
    written += chunk.length;
    if (written >= TARGET) clearInterval(id);
  }, 1);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}
