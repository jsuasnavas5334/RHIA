import { test } from "node:test";
import assert from "node:assert/strict";
import { ChannelGateway } from "./gateway.js";
import { InMemoryIdempotencyStore } from "./idempotency.js";
import { FakeTransport } from "./testing/fake-transport.js";
import { createN8nWebhookAdapter } from "./adapters/n8n-webhook.js";
import type { ChannelSendRequest } from "./contracts.js";

const baseRequest: ChannelSendRequest = {
  idempotencyKey: "touch-1",
  organizationId: "org1",
  channel: "email",
  provider: "n8n-webhook",
  to: "prospecto@empresa.com",
  subject: "Hola",
  body: "Texto del mensaje",
  metadata: {},
};

function makeGateway(transport: FakeTransport) {
  const adapter = createN8nWebhookAdapter({ webhookUrl: "https://n8n.local/webhook/send" });
  const idempotency = new InMemoryIdempotencyStore();
  const gateway = new ChannelGateway([adapter], transport, idempotency);
  return { gateway, idempotency };
}

test("send: caso base -- SUCCEEDED con deduplicated=false", async () => {
  const transport = new FakeTransport([{ kind: "respond", status: 200, body: { providerMessageId: "prov-1", status: "sent" } }]);
  const { gateway } = makeGateway(transport);
  const result = await gateway.send(baseRequest, { timeoutMs: 5000 });
  assert.equal(result.status, "SUCCEEDED");
  if (result.status === "SUCCEEDED") {
    assert.equal(result.deduplicated, false);
    assert.equal(result.providerMessageId, "prov-1");
  }
  assert.equal(transport.requests.length, 1);
});

// Criterio de aceptacion "Retry no duplica" + prueba requerida "Duplicate retry".
test("send: retry con la misma idempotencyKey y el mismo contenido no vuelve a llamar al proveedor", async () => {
  const transport = new FakeTransport([{ kind: "respond", status: 200, body: { providerMessageId: "prov-1", status: "sent" } }]);
  const { gateway } = makeGateway(transport);

  const first = await gateway.send(baseRequest, { timeoutMs: 5000 });
  const second = await gateway.send(baseRequest, { timeoutMs: 5000 });

  assert.equal(first.status, "SUCCEEDED");
  assert.equal(second.status, "SUCCEEDED");
  if (second.status === "SUCCEEDED") {
    assert.equal(second.deduplicated, true);
    assert.equal(second.providerMessageId, "prov-1");
  }
  // Solo una llamada real al transporte -- el segundo intento fue deduplicado.
  assert.equal(transport.requests.length, 1);
});

test("send: misma idempotencyKey con contenido distinto -> RHIA_CHANNEL_IDEMPOTENCY_CONFLICT, no llama al proveedor", async () => {
  const transport = new FakeTransport([{ kind: "respond", status: 200, body: { providerMessageId: "prov-1", status: "sent" } }]);
  const { gateway } = makeGateway(transport);

  await gateway.send(baseRequest, { timeoutMs: 5000 });
  const conflicting = await gateway.send({ ...baseRequest, body: "Texto completamente distinto" }, { timeoutMs: 5000 });

  assert.equal(conflicting.status, "FAILED");
  if (conflicting.status === "FAILED") {
    assert.equal(conflicting.error.code, "RHIA_CHANNEL_IDEMPOTENCY_CONFLICT");
  }
  // Sigue habiendo solo 1 llamada real (la del primer envio) -- el conflicto se detecta antes de llamar al adapter.
  assert.equal(transport.requests.length, 1);
});

test("send: un intento FAILED no se registra -- un retry posterior si reintenta contra el proveedor", async () => {
  const transport = new FakeTransport([
    { kind: "respond", status: 503, body: {} },
    { kind: "respond", status: 200, body: { providerMessageId: "prov-2", status: "sent" } },
  ]);
  const { gateway } = makeGateway(transport);

  const first = await gateway.send(baseRequest, { timeoutMs: 5000 });
  assert.equal(first.status, "FAILED");
  if (first.status === "FAILED") assert.equal(first.error.retryable, true);

  const second = await gateway.send(baseRequest, { timeoutMs: 5000 });
  assert.equal(second.status, "SUCCEEDED");
  if (second.status === "SUCCEEDED") assert.equal(second.deduplicated, false);

  // Dos llamadas reales: el FAILED no bloqueo el retry real.
  assert.equal(transport.requests.length, 2);
});

// Prueba requerida "Provider timeout".
test("send: el proveedor cuelga (hang) -> RHIA_CHANNEL_TIMEOUT tras timeoutMs, sin dejar la promesa colgada", async () => {
  const transport = new FakeTransport([{ kind: "hang" }]);
  const { gateway } = makeGateway(transport);

  const startedAt = Date.now();
  const result = await gateway.send(baseRequest, { timeoutMs: 50 });
  const elapsedMs = Date.now() - startedAt;

  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.equal(result.error.code, "RHIA_CHANNEL_TIMEOUT");
    assert.equal(result.error.retryable, true);
  }
  // Debe resolver cerca del timeout configurado, no colgarse indefinidamente.
  assert.ok(elapsedMs < 2000, `se esperaba que resolviera cerca de 50ms, tardo ${elapsedMs}ms`);
});

test("send: proveedor no registrado -> RHIA_CHANNEL_PROVIDER_UNAVAILABLE sin tocar el transporte", async () => {
  const transport = new FakeTransport([]);
  const { gateway } = makeGateway(transport);
  const result = await gateway.send({ ...baseRequest, provider: "otro-proveedor" }, { timeoutMs: 5000 });
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") assert.equal(result.error.code, "RHIA_CHANNEL_PROVIDER_UNAVAILABLE");
  assert.equal(transport.requests.length, 0);
});

// Accion "Delivery callbacks" + prueba requerida "Webhook duplicate".
test("handleWebhookEvent: procesa un evento nuevo", async () => {
  const transport = new FakeTransport([]);
  const { gateway } = makeGateway(transport);
  const result = await gateway.handleWebhookEvent({
    organizationId: "org1",
    provider: "n8n-webhook",
    rawPayload: { providerEventId: "evt-1", providerMessageId: "prov-1", status: "delivered", occurredAt: "2026-09-07T10:00:00.000Z" },
  });
  assert.equal(result.outcome, "PROCESSED");
  assert.equal(result.event.deliveryStatus, "DELIVERED");
});

test("handleWebhookEvent: el mismo evento reentregado (mismo providerEventId) se ignora la segunda vez", async () => {
  const transport = new FakeTransport([]);
  const { gateway } = makeGateway(transport);
  const payload = { providerEventId: "evt-dup", providerMessageId: "prov-1", status: "delivered", occurredAt: "2026-09-07T10:00:00.000Z" };

  const first = await gateway.handleWebhookEvent({ organizationId: "org1", provider: "n8n-webhook", rawPayload: payload });
  const second = await gateway.handleWebhookEvent({ organizationId: "org1", provider: "n8n-webhook", rawPayload: payload });

  assert.equal(first.outcome, "PROCESSED");
  assert.equal(second.outcome, "DUPLICATE_IGNORED");
});

test("handleWebhookEvent: providerEventId igual pero de otra organizacion no colisiona", async () => {
  const transport = new FakeTransport([]);
  const { gateway } = makeGateway(transport);
  const payload = { providerEventId: "evt-shared", providerMessageId: "prov-1", status: "delivered", occurredAt: "2026-09-07T10:00:00.000Z" };

  const first = await gateway.handleWebhookEvent({ organizationId: "org1", provider: "n8n-webhook", rawPayload: payload });
  const second = await gateway.handleWebhookEvent({ organizationId: "org2", provider: "n8n-webhook", rawPayload: payload });

  assert.equal(first.outcome, "PROCESSED");
  assert.equal(second.outcome, "PROCESSED");
});
