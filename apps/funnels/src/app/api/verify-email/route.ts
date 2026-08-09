import { NextResponse } from 'next/server';

import { isBusinessEmail } from '@/utils/businessEmail';

const API_KEY = process.env.MILLION_VERIFIER_API_KEY;

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  if (!isBusinessEmail(email)) {
    return NextResponse.json({ valid: false, result: 'non_business_email' });
  }

  if (!API_KEY) {
    // Skip verification when no API key is set (e.g. local testing)
    return NextResponse.json({ valid: true, result: 'skipped' });
  }

  try {
    const res = await fetch(
      `https://api.millionverifier.com/api/v3/?api=${API_KEY}&email=${encodeURIComponent(email)}&timeout=10`,
    );
    const data = await res.json();

    // MillionVerifier returns { result: "ok"|"catch_all"|"unknown"|"error"|"invalid"|"disposable", ... }
    const valid = data.result === 'ok' || data.result === 'catch_all';

    return NextResponse.json({ valid, result: data.result });
  } catch {
    // If verification service is down, don't block the user
    return NextResponse.json({ valid: true, result: 'error' });
  }
}
