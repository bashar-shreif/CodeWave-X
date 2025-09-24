export const redact = (s: string): string => {
  let t = s;

  t = t.replace(
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/g,
    '[redacted private key]',
  );

  t = t.replace(/\bsk-[A-Za-z0-9_\-]{16,}\b/g, '[redacted-token]');
  t = t.replace(/\bghp_[A-Za-z0-9]{20,}\b/g, '[redacted-token]');
  t = t.replace(/\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, '[redacted-aws-key]');
  t = t.replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '[redacted-token]');

  t = t.replace(/\b[A-Za-z0-9+\/=]{32,}\b/g, '[redacted]');

  t = t.replace(/(?:[A-Za-z]:\\|\/)[^\s)]+/g, (p) => maskPath(p));

  t = t.replace(/^([A-Z0-9_]{3,})=(.+)$/gm, (_m, k) => `${k}=[redacted]`);

  return t;
};

const maskPath = (p: string) => {
  const parts = p.replace(/\\/g, '/').split('/');
  const tail = parts[parts.length - 1] || '';
  return tail ? `…/${tail}` : '…/';
};
