import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSendFingerprint, stableFingerprint, InMemoryIdempotencyStore } from "./idempotency.js";

test("computeSendFingerprint: mismo contenido produce el mismo fingerprint", () => {
  const a = computeSendFingerprint({ channel: "email", provider: "n8n-webhook", to: "x@y.com", subject: "Hola", body: "Texto" });
  const b = computeSendFingerprint({ channel: "email", provider: "n8n-webhook", to: "x@y.com", subject: "Hola", body: "Texto" });
  assert.equal(a, b);
});

test("computeSendFingerprint: distinto body produce distinto fingerprint", () => {
  const a = computeSendFingerprint({ channel: "email", provider: "n8n-webhook", to: "x@y.com", subject: "Hola", body: "Texto A" });
  const b = computeSendFingerprint({ channel: "email", provider: "n8n-webhook", to: "x@y.com", subject: "Hola", body: "Texto B" });
  assert.notEqual(a, b);
});

test("stableFingerprint: deterministico para el mismo objeto", () => {
  assert.equal(stableFingerprint({ a: 1, b: "x" }), stableFingerprint({ a: 1, b: "x" }));
});

test("InMemoryIdempotencyStore: get devuelve found=false cuando no existe", async () => {
  const store = new InMemoryIdempotencyStore();
  const result = await store.get({ organizationId: "org1", operation: "channel.send", idempotencyKey: "k1" });
  assert.equal(result.found, false);
});

test("InMemoryIdempotencyStore: record seguido de get devuelve lo guardado", async () => {
  const store = new InMemoryIdempotencyStore();
  const key = { organizationId: "org1", operation: "channel.send", idempotencyKey: "k1" };
  await store.record({ key, fingerprint: "fp1", resourceType: "channel_send", resourceId: "msg1", resourceSnapshot: { hello: "world" } });
  const result = await store.get(key);
  assert.equal(result.found, true);
  if (result.found) {
    assert.equal(result.fingerprint, "fp1");
    assert.equal(result.resourceId, "msg1");
    assert.deepEqual(result.resourceSnapshot, { hello: "world" });
  }
});

test("InMemoryIdempotencyStore: claves de distinta organizacion no colisionan", async () => {
  const store = new InMemoryIdempotencyStore();
  await store.record({
    key: { organizationId: "org1", operation: "channel.send", idempotencyKey: "k1" },
    fingerprint: "fp1",
    resourceType: "channel_send",
    resourceId: "msg1",
    resourceSnapshot: {},
  });
  const result = await store.get({ organizationId: "org2", operation: "channel.send", idempotencyKey: "k1" });
  assert.equal(result.found, false);
});
