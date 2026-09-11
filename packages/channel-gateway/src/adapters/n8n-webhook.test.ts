import { test } from "node:test";
import assert from "node:assert/strict";
import { createN8nWebhookAdapter } from "./n8n-webhook.js";
import { FakeTransport } from "../testing/fake-transport.js";
import type { ChannelSendRequest } from "../contracts.js";

const baseRequest: ChannelSendRequest = {
  idempotencyKey: "req-1",
  organizationId: "org1",
  channel: "email",
  provider: "n8n-webhook",
  to: "prospecto@empresa.com",
  subject: "Hola",
  body: "Texto del mensaje",
  metadata: {},
};

test("adapter n8n-webhook: 2xx con providerMessageId -> SUCCEEDED normalizado", async () => {
  const adapter = createN8nWebhookAdapter({ webhookUrl: "https://n8n.local/webhook/send" });
  const transport = new FakeTransport([{ kind: "respond", status: 200, body: { providerMessageId: "prov-123", status: "sent" } }]);
  const controller = new AbortController();

  const result = await adapter.send(baseRequest, transport, controller.signal);

  assert.equal(result.status, "SUCCEEDED");
  if (result.status === "SUCCEEDED") {
    assert.equal(result.providerMessageId, "prov-123");
    assert.equal(result.deliveryStatus, "SENT");
    assert.equal(result.deduplicated, false);
  }
  assert.equal(transport.requests.length, 1);
  assert.equal(transport.requests[0]?.url, "https://n8n.local/webhook/send");
});

test("adapter n8n-webhook: 401 -> RHIA_CHANNEL_AUTH_FAILED", async () => {
  const adapter = createN8nWebhookAdapter({ webhookUrl: "https://n8n.local/webhook/send" });
  const transport = new FakeTransport([{ kind: "respond", status: 401, body: { message: "unauthorized" } }]);
  const result = await adapter.send(baseRequest, transport, new AbortController().signal);
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") assert.equal(result.error.code, "RHIA_CHANNEL_AUTH_FAILED");
});

test("adapter n8n-webhook: 429 -> RHIA_CHANNEL_RATE_LIMITED (retryable)", async () => {
  const adapter = createN8nWebhookAdapter({ webhookUrl: "https://n8n.local/webhook/send" });
  const transport = new FakeTransport([{ kind: "respond", status: 429, body: {} }]);
  const result = await adapter.send(baseRequest, transport, new AbortController().signal);
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.equal(result.error.code, "RHIA_CHANNEL_RATE_LIMITED");
    assert.equal(result.error.retryable, true);
  }
});

test("adapter n8n-webhook: 503 -> RHIA_CHANNEL_PROVIDER_UNAVAILABLE (retryable)", async () => {
  const adapter = createN8nWebhookAdapter({ webhookUrl: "https://n8n.local/webhook/send" });
  const transport = new FakeTransport([{ kind: "respond", status: 503, body: {} }]);
  const result = await adapter.send(baseRequest, transport, new AbortController().signal);
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.equal(result.error.code, "RHIA_CHANNEL_PROVIDER_UNAVAILABLE");
    assert.equal(result.error.retryable, true);
  }
});

test("adapter n8n-webhook: 400 -> RHIA_CHANNEL_REJECTED (no retryable)", async () => {
  const adapter = createN8nWebhookAdapter({ webhookUrl: "https://n8n.local/webhook/send" });
  const transport = new FakeTransport([{ kind: "respond", status: 400, body: { message: "recipient invalido" } }]);
  const result = await adapter.send(baseRequest, transport, new AbortController().signal);
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") {
    assert.equal(result.error.code, "RHIA_CHANNEL_REJECTED");
    assert.equal(result.error.retryable, false);
  }
});

test("adapter n8n-webhook: 2xx sin providerMessageId -> RHIA_CHANNEL_UNEXPECTED_FAILURE", async () => {
  const adapter = createN8nWebhookAdapter({ webhookUrl: "https://n8n.local/webhook/send" });
  const transport = new FakeTransport([{ kind: "respond", status: 200, body: { status: "sent" } }]);
  const result = await adapter.send(baseRequest, transport, new AbortController().signal);
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") assert.equal(result.error.code, "RHIA_CHANNEL_UNEXPECTED_FAILURE");
});

test("adapter n8n-webhook: transporte lanza excepcion de red -> normalizado, nunca re-lanzado", async () => {
  const adapter = createN8nWebhookAdapter({ webhookUrl: "https://n8n.local/webhook/send" });
  const transport = new FakeTransport([{ kind: "throw", message: "ECONNRESET" }]);
  const result = await adapter.send(baseRequest, transport, new AbortController().signal);
  assert.equal(result.status, "FAILED");
  if (result.status === "FAILED") assert.equal(result.error.code, "RHIA_CHANNEL_UNEXPECTED_FAILURE");
});

test("adapter n8n-webhook: parseWebhookEvent normaliza un payload valido", () => {
  const adapter = createN8nWebhookAdapter({ webhookUrl: "https://n8n.local/webhook/send" });
  const event = adapter.parseWebhookEvent({
    providerEventId: "evt-1",
    providerMessageId: "prov-123",
    status: "delivered",
    occurredAt: "2026-09-07T10:00:00.000Z",
  });
  assert.equal(event.provider, "n8n-webhook");
  assert.equal(event.providerEventId, "evt-1");
  assert.equal(event.deliveryStatus, "DELIVERED");
});

test("adapter n8n-webhook: parseWebhookEvent lanza si falta providerEventId", () => {
  const adapter = createN8nWebhookAdapter({ webhookUrl: "https://n8n.local/webhook/send" });
  assert.throws(() => adapter.parseWebhookEvent({ providerMessageId: "prov-123" }));
});
