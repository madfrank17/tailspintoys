export const secretRules = [
  { id: 'GITHUB_TOKEN', regex: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g },
  { id: 'AWS_ACCESS_KEY', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'SLACK_TOKEN', regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { id: 'PRIVATE_KEY', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { id: 'GENERIC_SECRET_ASSIGNMENT', regex: /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9_\-\/+=]{20,}["']?/gi }
];

export function detectSecretPatterns(text) {
  const hits = [];
  for (const rule of secretRules) {
    rule.regex.lastIndex = 0;
    if (rule.regex.test(text)) hits.push(rule.id);
  }
  return [...new Set(hits)];
}
