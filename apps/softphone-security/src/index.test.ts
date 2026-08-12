import { afterEach, describe, expect, it, vi } from "vitest";

import worker, { SoftphoneSecurity } from "./index";

class MemoryStorage {
  private readonly values = new Map<string, unknown>();

  async deleteAll() {
    this.values.clear();
  }

  async setAlarm() {}

  async transaction<T>(
    closure: (transaction: {
      get<V>(key: string): Promise<V | undefined>;
      put<V>(key: string, value: V): Promise<void>;
    }) => Promise<T>,
  ) {
    return closure({
      get: async <V>(key: string) => this.values.get(key) as V | undefined,
      put: async <V>(key: string, value: V) => {
        this.values.set(key, value);
      },
    });
  }
}

const createEnv = () => {
  const objects = new Map<string, SoftphoneSecurity>();
  return {
    SOFTPHONE_SECURITY: {
      idFromName: (name: string) => name,
      get: (id: unknown) => ({
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const key = String(id);
          let object = objects.get(key);
          if (!object) {
            object = new SoftphoneSecurity({
              storage: new MemoryStorage(),
            });
            objects.set(key, object);
          }
          return object.fetch(new Request(input, init));
        },
      }),
    },
  };
};

const consumeRequest = (nonce: string, exp = 1_786_470_120) =>
  new Request("https://security.example.com/consume", {
    method: "POST",
    body: JSON.stringify({ exp, nonce }),
  });

afterEach(() => vi.restoreAllMocks());

describe("softphone security service", () => {
  it("atomically refuses a second exchange of the same nonce", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_786_470_000_000);
    const env = createEnv();
    const nonce = "4a9dd9da-9316-4848-a849-ecb16e83eb53";

    expect((await worker.fetch(consumeRequest(nonce), env)).status).toBe(204);
    expect((await worker.fetch(consumeRequest(nonce), env)).status).toBe(409);
    expect(
      (
        await worker.fetch(
          consumeRequest("e3f2e0aa-6481-47da-a4f5-ddb4ca244497"),
          env,
        )
      ).status,
    ).toBe(204);
  });

  it("rejects malformed and expired nonce consumption requests", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_786_470_000_000);
    const env = createEnv();

    expect((await worker.fetch(consumeRequest("not-a-uuid"), env)).status).toBe(
      400,
    );
    expect(
      (
        await worker.fetch(
          consumeRequest("4a9dd9da-9316-4848-a849-ecb16e83eb53", 1_786_469_999),
          env,
        )
      ).status,
    ).toBe(400);
  });

  it("allows ten exchanges per client per minute and then returns 429", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_786_470_000_000);
    const env = createEnv();
    const request = () =>
      new Request("https://security.example.com/limit", {
        method: "POST",
        body: "a".repeat(64),
      });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await worker.fetch(request(), env)).status).toBe(204);
    }
    expect((await worker.fetch(request(), env)).status).toBe(429);
  });
});
