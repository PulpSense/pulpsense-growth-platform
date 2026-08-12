type DurableObjectTransaction = {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
};

type DurableObjectStorage = {
  deleteAll(): Promise<void>;
  setAlarm(scheduledTime: number): Promise<void>;
  transaction<T>(
    closure: (txn: DurableObjectTransaction) => Promise<T>,
  ): Promise<T>;
};

type DurableObjectState = { storage: DurableObjectStorage };

type DurableObjectStub = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type SoftphoneSecurityEnv = {
  SOFTPHONE_SECURITY: {
    get(id: unknown): DurableObjectStub;
    idFromName(name: string): unknown;
  };
};

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const privateResponse = (status: number) =>
  new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

const parseConsumeRequest = async (request: Request) => {
  try {
    const value = (await request.json()) as { exp?: unknown; nonce?: unknown };
    if (
      typeof value.exp !== "number" ||
      !Number.isInteger(value.exp) ||
      typeof value.nonce !== "string" ||
      !UUID_V4.test(value.nonce)
    ) {
      return undefined;
    }
    return { exp: value.exp, nonce: value.nonce };
  } catch {
    return undefined;
  }
};

export class SoftphoneSecurity {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request) {
    const path = new URL(request.url).pathname;
    if (request.method !== "POST") return privateResponse(405);

    if (path === "/consume") {
      const { exp } = (await request.json()) as { exp: number };
      const accepted = await this.state.storage.transaction(async (txn) => {
        if (await txn.get<boolean>("consumed")) return false;
        await txn.put("consumed", true);
        return true;
      });
      if (!accepted) return privateResponse(409);
      await this.state.storage.setAlarm(Math.max(exp * 1000, Date.now()));
      return privateResponse(204);
    }

    if (path === "/limit") {
      const now = Date.now();
      const accepted = await this.state.storage.transaction(async (txn) => {
        const attempts = (await txn.get<number[]>("attempts")) ?? [];
        const activeAttempts = attempts.filter(
          (timestamp) => timestamp > now - RATE_WINDOW_MS,
        );
        if (activeAttempts.length >= RATE_LIMIT) return false;
        await txn.put("attempts", [...activeAttempts, now]);
        return true;
      });
      await this.state.storage.setAlarm(now + RATE_WINDOW_MS);
      return privateResponse(accepted ? 204 : 429);
    }

    return privateResponse(404);
  }

  async alarm() {
    await this.state.storage.deleteAll();
  }
}

const worker = {
  async fetch(request: Request, env: SoftphoneSecurityEnv) {
    if (request.method !== "POST") return privateResponse(405);
    const path = new URL(request.url).pathname;

    if (path === "/limit") {
      const key = await request.text();
      if (!/^[0-9a-f]{64}$/u.test(key)) return privateResponse(400);
      const id = env.SOFTPHONE_SECURITY.idFromName(`rate:${key}`);
      return env.SOFTPHONE_SECURITY.get(id).fetch(
        "https://softphone-security/limit",
        { method: "POST" },
      );
    }

    if (path === "/consume") {
      const handoff = await parseConsumeRequest(request);
      if (!handoff || handoff.exp <= Math.floor(Date.now() / 1000)) {
        return privateResponse(400);
      }
      const id = env.SOFTPHONE_SECURITY.idFromName(`nonce:${handoff.nonce}`);
      return env.SOFTPHONE_SECURITY.get(id).fetch(
        "https://softphone-security/consume",
        { method: "POST", body: JSON.stringify({ exp: handoff.exp }) },
      );
    }

    return privateResponse(404);
  },
};

export default worker;
