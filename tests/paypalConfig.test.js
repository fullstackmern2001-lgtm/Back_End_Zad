const test = require("node:test");
const assert = require("node:assert/strict");
const { getPayPalConfig } = require("../utils/paypalConfig");

const createEnv = (overrides = {}) => ({
  NODE_ENV: "development",
  CLIENT_URL: "http://localhost:5173",
  PAYPAL_WEBHOOK_URL:
    "http://localhost:5000/api/v1/order/paypal-webhook",
  PAYPAL_SANDBOX_CLIENT_ID: "sandbox-client-id",
  PAYPAL_SANDBOX_CLIENT_SECRET: "sandbox-client-secret",
  PAYPAL_SANDBOX_WEBHOOK_ID: "sandbox-webhook-id",
  PAYPAL_LIVE_CLIENT_ID: "live-client-id",
  PAYPAL_LIVE_CLIENT_SECRET: "live-client-secret",
  PAYPAL_LIVE_WEBHOOK_ID: "live-webhook-id",
  ...overrides,
});

test("builds sandbox config with USD and checkout return URLs", () => {
  const config = getPayPalConfig(createEnv());

  assert.equal(config.environment, "sandbox");
  assert.equal(
    config.apiBaseUrl,
    "https://api-m.sandbox.paypal.com",
  );
  assert.equal(config.clientId, "sandbox-client-id");
  assert.equal(config.clientSecret, "sandbox-client-secret");
  assert.equal(config.webhookId, "sandbox-webhook-id");
  assert.equal(config.currency, "USD");
  assert.equal(config.returnUrl, "http://localhost:5173/checkout?paypal=return");
  assert.equal(config.cancelUrl, "http://localhost:5173/checkout?paypal=cancel");
  assert.equal(
    config.webhookUrl,
    "http://localhost:5000/api/v1/order/paypal-webhook",
  );
});

test("selects live credentials and requires HTTPS for production URLs", () => {
  const config = getPayPalConfig(
    createEnv({
      NODE_ENV: "production",
      PAYPAL_ENVIRONMENT: "live",
      CLIENT_URL: "https://store.example",
      PAYPAL_WEBHOOK_URL: "https://api.example/api/v1/order/paypal-webhook",
    }),
  );

  assert.equal(config.environment, "live");
  assert.equal(config.apiBaseUrl, "https://api-m.paypal.com");
  assert.equal(config.clientId, "live-client-id");
  assert.equal(config.clientSecret, "live-client-secret");
  assert.equal(config.webhookId, "live-webhook-id");
  assert.equal(config.returnUrl, "https://store.example/checkout?paypal=return");
  assert.equal(
    config.webhookUrl,
    "https://api.example/api/v1/order/paypal-webhook",
  );
});

test("rejects production sandbox credentials", () => {
  assert.throws(
    () =>
      getPayPalConfig(
        createEnv({
          NODE_ENV: "production",
          PAYPAL_ENVIRONMENT: "sandbox",
          CLIENT_URL: "https://store.example",
          PAYPAL_WEBHOOK_URL: "https://api.example/webhook",
        }),
      ),
    /must be live/,
  );
});

test("rejects missing credentials, invalid environments, and insecure production URLs", () => {
  assert.throws(
    () =>
      getPayPalConfig(
        createEnv({ PAYPAL_SANDBOX_CLIENT_SECRET: undefined }),
      ),
    /client ID and client secret/,
  );
  assert.throws(
    () => getPayPalConfig(createEnv({ PAYPAL_ENVIRONMENT: "test" })),
    /sandbox or live/,
  );
  assert.throws(
    () =>
      getPayPalConfig(
        createEnv({
          NODE_ENV: "production",
          PAYPAL_ENVIRONMENT: "live",
          CLIENT_URL: "http://store.example",
          PAYPAL_WEBHOOK_URL: "https://api.example/webhook",
        }),
      ),
    /secure public URL/,
  );
});

test("allows order creation credentials without a webhook ID", () => {
  const config = getPayPalConfig(
    createEnv({ PAYPAL_SANDBOX_WEBHOOK_ID: undefined }),
  );

  assert.equal(config.webhookId, undefined);
  assert.equal(config.clientId, "sandbox-client-id");
});

test("uses a bounded PayPal request timeout", () => {
  const config = getPayPalConfig(
    createEnv({ PAYPAL_REQUEST_TIMEOUT_MS: "15000" }),
  );

  assert.equal(config.requestTimeoutMs, 15000);
  assert.throws(
    () =>
      getPayPalConfig(
        createEnv({ PAYPAL_REQUEST_TIMEOUT_MS: "120001" }),
      ),
    /positive integer no greater than 120000/,
  );
});
