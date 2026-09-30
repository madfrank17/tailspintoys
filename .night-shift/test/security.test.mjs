import test from 'node:test';
import assert from 'node:assert/strict';
import { detectSecretPatterns } from '../lib/security.mjs';

test('secret pattern gate detects credential-shaped additions without printing values', () => {
  const githubHits = detectSecretPatterns('token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz"');
  assert.ok(githubHits.includes('GITHUB_TOKEN'));
  assert.deepEqual(detectSecretPatterns('const label = "benign";'), []);
  assert.deepEqual(detectSecretPatterns('-----BEGIN PRIVATE KEY-----'), ['PRIVATE_KEY']);
});
