const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'gmx.com',
  'mail.com',
  'zoho.com',
  'yandex.com',
]);

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isBusinessEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) return false;

  const domain = normalized.split('@').at(1);
  return !!domain && !FREE_EMAIL_DOMAINS.has(domain);
}
