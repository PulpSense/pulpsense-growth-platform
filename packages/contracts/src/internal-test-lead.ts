const internalTestLeadEmails = new Set([
  "santi@pulpsense.com",
  "me@santileoni.com",
]);

export const isInternalTestLeadEmail = (email: string) =>
  internalTestLeadEmails.has(email.trim().toLowerCase());
