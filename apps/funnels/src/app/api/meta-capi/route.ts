import { createHash } from 'crypto';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PIXEL_ID = process.env.META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const API_VERSION = 'v22.0';

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

interface CAPIRequestBody {
  event_name: string;
  event_id: string;
  event_source_url: string;
  user_email?: string;
  user_phone?: string;
  fbc?: string;
  fbp?: string;
  custom_data?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return NextResponse.json({ error: 'Meta CAPI not configured' }, { status: 500 });
  }

  const body: CAPIRequestBody = await request.json();

  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const clientUserAgent = request.headers.get('user-agent') || '';

  const userData: Record<string, unknown> = {
    client_ip_address: clientIp,
    client_user_agent: clientUserAgent,
  };

  if (body.user_email) userData.em = [sha256(body.user_email)];
  if (body.user_phone) userData.ph = [sha256(body.user_phone)];
  if (body.fbc) userData.fbc = body.fbc;
  if (body.fbp) userData.fbp = body.fbp;

  const payload = {
    data: [
      {
        event_name: body.event_name,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website' as const,
        event_source_url: body.event_source_url,
        event_id: body.event_id,
        user_data: userData,
        ...(body.custom_data ? { custom_data: body.custom_data } : {}),
      },
    ],
  };

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

  const metaRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await metaRes.json();

  if (!metaRes.ok) {
    console.error('Meta CAPI error:', result);
    return NextResponse.json({ error: result }, { status: metaRes.status });
  }

  return NextResponse.json({ success: true, events_received: result.events_received });
}
