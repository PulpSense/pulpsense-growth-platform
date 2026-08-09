import { isBusinessEmail } from '@/utils/businessEmail';

type FormEvent = 'contact_submitted' | 'application_submitted' | 'booking_completed';

type FormSubmitBody = {
  event?: string;
  data?: Record<string, unknown>;
  submittedAt?: string;
};

type CapiRequestBody = {
  event_name: string;
  event_id: string;
  event_source_url: string;
  user_email?: string;
  user_phone?: string;
  fbc?: string;
  fbp?: string;
  custom_data?: Record<string, unknown>;
};

export type FunnelEnv = {
  MILLION_VERIFIER_API_KEY?: string;
  PULPSENSE_TRIGGER_API_ORIGIN?: string;
  PULPSENSE_TRIGGER_SECRET_KEY?: string;
  CREATIVE_MULTIPLIER_SPRINT_CONTACT_TASK_ID?: string;
  CREATIVE_MULTIPLIER_SPRINT_APPLICATION_TASK_ID?: string;
  CREATIVE_MULTIPLIER_SPRINT_BOOKING_TASK_ID?: string;
  META_PIXEL_ID?: string;
  META_CAPI_ACCESS_TOKEN?: string;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

const parseJson = async <T>(request: Request): Promise<T | undefined> => {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
};

const isFormEvent = (event: string | undefined): event is FormEvent =>
  event === 'contact_submitted' ||
  event === 'application_submitted' ||
  event === 'booking_completed';

const taskIdFor = (env: FunnelEnv, funnelId: string, event: FormEvent) => {
  if (funnelId !== 'creative-multiplier-sprint') return undefined;

  return {
    contact_submitted: env.CREATIVE_MULTIPLIER_SPRINT_CONTACT_TASK_ID,
    application_submitted: env.CREATIVE_MULTIPLIER_SPRINT_APPLICATION_TASK_ID,
    booking_completed: env.CREATIVE_MULTIPLIER_SPRINT_BOOKING_TASK_ID,
  }[event];
};

export async function handleVerifyEmail(request: Request, env: FunnelEnv) {
  const body = await parseJson<{ email?: unknown }>(request);
  const email = body?.email;

  if (typeof email !== 'string' || !email) {
    return json({ error: 'Email is required' }, 400);
  }

  if (!isBusinessEmail(email)) {
    return json({ valid: false, result: 'non_business_email' });
  }

  if (!env.MILLION_VERIFIER_API_KEY) {
    return json({ valid: true, result: 'skipped' });
  }

  try {
    const response = await fetch(
      `https://api.millionverifier.com/api/v3/?api=${env.MILLION_VERIFIER_API_KEY}&email=${encodeURIComponent(email)}&timeout=10`,
    );
    const result = (await response.json()) as { result?: string };
    const valid = result.result === 'ok' || result.result === 'catch_all';

    return json({ valid, result: result.result });
  } catch {
    return json({ valid: true, result: 'error' });
  }
}

export async function handleFormSubmit(request: Request, env: FunnelEnv) {
  const body = await parseJson<FormSubmitBody>(request);

  if (!body || !isFormEvent(body.event)) {
    return json({ error: 'Unknown event' }, 400);
  }

  const data = body.data ?? {};
  const funnelId = typeof data.funnelId === 'string' ? data.funnelId : 'default';
  const taskId = taskIdFor(env, funnelId, body.event);

  if (!env.PULPSENSE_TRIGGER_SECRET_KEY || !taskId) {
    return json(
      { ok: false, skipped: true, reason: 'Trigger not configured' },
      202,
    );
  }

  const payload = {
    event: body.event,
    funnelId,
    data,
    submittedAt: body.submittedAt ?? new Date().toISOString(),
  };

  try {
    const response = await fetch(
      `${env.PULPSENSE_TRIGGER_API_ORIGIN ?? 'https://api.trigger.dev'}/api/v1/tasks/${encodeURIComponent(taskId)}/trigger`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.PULPSENSE_TRIGGER_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload }),
      },
    );

    if (!response.ok) {
      return json({ error: 'Trigger delivery failed' }, 502);
    }

    return json({ ok: true });
  } catch {
    return json({ error: 'Trigger delivery failed' }, 502);
  }
}

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
};

export async function handleMetaCapi(request: Request, env: FunnelEnv) {
  if (!env.META_PIXEL_ID || !env.META_CAPI_ACCESS_TOKEN) {
    return json({ error: 'Meta CAPI not configured' }, 500);
  }

  const body = await parseJson<CapiRequestBody>(request);
  if (!body?.event_name || !body.event_id || !body.event_source_url) {
    return json({ error: 'Invalid Meta CAPI event' }, 400);
  }

  const clientIp =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';
  const userData: Record<string, unknown> = {
    client_ip_address: clientIp,
    client_user_agent: request.headers.get('user-agent') ?? '',
  };

  if (body.user_email) userData.em = [await sha256(body.user_email)];
  if (body.user_phone) userData.ph = [await sha256(body.user_phone)];
  if (body.fbc) userData.fbc = body.fbc;
  if (body.fbp) userData.fbp = body.fbp;

  const payload = {
    data: [
      {
        event_name: body.event_name,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: body.event_source_url,
        event_id: body.event_id,
        user_data: userData,
        ...(body.custom_data ? { custom_data: body.custom_data } : {}),
      },
    ],
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${env.META_PIXEL_ID}/events?access_token=${env.META_CAPI_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json()) as {
      events_received?: number;
      error?: unknown;
    };

    if (!response.ok) {
      return json({ error: result.error ?? 'Meta CAPI delivery failed' }, response.status);
    }

    return json({ success: true, events_received: result.events_received });
  } catch {
    return json({ error: 'Meta CAPI delivery failed' }, 502);
  }
}
