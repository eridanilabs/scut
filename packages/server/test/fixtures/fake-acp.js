#!/usr/bin/env node
// Test fixture used by transport.test.ts. Starts a tiny TCP server on
// 127.0.0.1:0, announces its port to stdout in the format the
// production parsePortFromStdout regex expects, and then accepts and
// immediately closes any incoming connection. The fixture exits when
// it receives SIGTERM/SIGINT.
import { createServer } from 'node:net';

const server = createServer((socket) => {
  socket.on('error', () => { /* ignore */ });
  // Don't actually send any ACP frames; the transport test only
  // verifies the dial succeeds and cleanup works.
});

server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (addr && typeof addr === 'object') {
    process.stdout.write(`listening on 127.0.0.1:${addr.port}\n`);
  }
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 500).unref();
  });
}
