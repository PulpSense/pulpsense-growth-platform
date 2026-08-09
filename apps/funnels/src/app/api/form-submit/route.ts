import { NextResponse } from 'next/server';

type FormEvent = 'contact_submitted' | 'application_submitted' | 'booking_completed';

type FormSubmitBody = {
  event?: string;
  data?: Record<string, unknown>;
  submittedAt?: string;
};

const TRIGGER_API_ORIGIN = process.env.PULPSENSE_TRIGGER_API_ORIGIN ?? 'https://api.trigger.dev';
const TRIGGER_SECRET_KEY = process.env.PULPSENSE_TRIGGER_SECRET_KEY;

const FUNNEL_TASK_IDS: Record<string, Partial<Record<FormEvent, string | undefined>>> = {
  'creative-multiplier-sprint': {
    contact_submitted: process.env.CREATIVE_MULTIPLIER_SPRINT_CONTACT_TASK_ID,
    application_submitted: process.env.CREATIVE_MULTIPLIER_SPRINT_APPLICATION_TASK_ID,
    booking_completed: process.env.CREATIVE_MULTIPLIER_SPRINT_BOOKING_TASK_ID,
  },
};

function isFormEvent(event: string | undefined): event is FormEvent {
  return event === 'contact_submitted' || event === 'application_submitted' || event === 'booking_completed';
}

export async function POST(req: Request) {
  const { event, data = {}, submittedAt } = (await req.json()) as FormSubmitBody;

  if (!isFormEvent(event)) {
    return NextResponse.json({ error: 'Unknown event' }, { status: 400 });
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[webhook] event="${event}"`, JSON.stringify(data, null, 2));
  }

  const funnelId = typeof data.funnelId === 'string' ? data.funnelId : 'default';
  const taskId = FUNNEL_TASK_IDS[funnelId]?.[event];

  if (!TRIGGER_SECRET_KEY || !taskId) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[trigger] skipped funnel="${funnelId}" event="${event}" secretConfigured=${Boolean(TRIGGER_SECRET_KEY)} taskId="${taskId ?? ''}"`,
      );
    }
    return NextResponse.json({ ok: false, skipped: true, reason: 'Trigger not configured' }, { status: 202 });
  }

  const payload = {
    event,
    funnelId,
    data,
    submittedAt: submittedAt ?? new Date().toISOString(),
  };

  if (process.env.NODE_ENV === 'development') {
    console.log(`[trigger] → ${taskId}`, JSON.stringify(payload, null, 2));
  }

  try {
    const res = await fetch(`${TRIGGER_API_ORIGIN}/api/v1/tasks/${encodeURIComponent(taskId)}/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TRIGGER_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payload }),
    });

    if (process.env.NODE_ENV === 'development') {
      console.log(`[trigger] ← ${res.status} ${res.statusText}`);
    }

    if (!res.ok) {
      const responseText = await res.text();
      if (process.env.NODE_ENV === 'development') {
        console.error(`[trigger] FAILED ${res.status}`, responseText);
      }
      return NextResponse.json({ error: 'Trigger delivery failed' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[trigger] FAILED`, err);
    }
    return NextResponse.json({ error: 'Trigger delivery failed' }, { status: 502 });
  }
}
