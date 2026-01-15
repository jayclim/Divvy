// filepath: jest.setup.js
import '@testing-library/jest-dom'

// Polyfill setImmediate for postgres/drizzle
if (!global.setImmediate) {
  global.setImmediate = setTimeout;
  global.clearImmediate = clearTimeout;
}

if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

import { client } from '@/lib/db';

afterAll(async () => {
  await client.end();
});