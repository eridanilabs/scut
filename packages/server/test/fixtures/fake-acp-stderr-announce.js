#!/usr/bin/env node
// Test fixture: listens on an OS-assigned loopback port (no --port
// passed in) and announces it ONLY on stderr in the format that
// parsePortFromStdout recognizes. Proves stderr lines can satisfy
// readiness in the no-expectedPort fallback path.
import { createServer } from 'node:net';

const server = createServer((socket) => {
  socket.on('error', () => { /* ignore */ });
});
server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (addr && typeof addr === 'object') {
    process.stderr.write(`listening on 127.0.0.1:${addr.port}\n`);
  }
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}
