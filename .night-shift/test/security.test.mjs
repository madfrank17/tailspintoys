import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSecretPatterns } from '../lib/security.mjs';

test('secret pattern gate detects credential-shaped additions without printing values', () => {
  assert.deepEqual(detectSecretPatterns('token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz"'), ['GITHUB_TOKEN']);
  assert.deepEqual(detectSecretPatterns('const label = "benign";'), []);
  assert.deepEqual(detectSecretPatterns('-----BEGIN PRIVATE KEY-----'), ['PRIVATE_KEY']);
});
