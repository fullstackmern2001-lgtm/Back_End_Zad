const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPayPalOrderPayload,
  createPayPalOrder,
  capturePayPalOrder,
  validatePayPalCapture,
  validatePayPalWebhookCapture,
  verifyPayPalWebhook,
} = require("../utils/paypalCheckout");

test("builds a PayPal order from the immutable checkout snapshot", () => {
  const attempt = {
    _id: { toString: () => "attempt_123" },
    totalAmountMinor: 1234,
  };
  const config = {
    currency: "USD",
    returnUrl: "https://store.example/checkout?paypal=return",
    cancelUrl: "https://store.example/checkout?paypal=cancel",
  };

  const payload = buildPayPalOrderPayload({ attempt, config });

  assert.equal(payload.intent, "CAPTURE");
  assert.equal(payload.purchase_units.length, 1);
  assert.deepEqual(payload.purchase_units[0].amount, {
    currency_code: "USD",
    value: "12.34",
  });
  assert.equal(payload.purchase_units[0].custom_id, "attempt_123");
  assert.equal(payload.purchase_units[0].reference_id, "attempt_123");
  assert.equal(
    payload.application_context.return_url,
    "https://store.example/checkout?paypal=return",
  );
  assert.equal(
    payload.application_context.cancel_url,
    "https://store.example/checkout?paypal=cancel",
  );
});

test("accepts only a completed PayPal capture matching attempt amount and currency", () => {
  const attempt = {
    _id: { toString: () => "attempt_123" },
    totalAmountMinor: 1234,
    currency: "usd",
  };
  const capture = {
    status: "COMPLETED",
    purchase_units: [
      {
        reference_id: "attempt_123",
        amount: { currency_code: "USD", value: "12.34" },
        payments: {
          captures: [{ id: "capture_123", status: "COMPLETED" }],
        },
      },
    ],
  };

  assert.equal(validatePayPalCapture(capture, attempt), "capture_123");
  assert.throws(
    () =>
      validatePayPalCapture(
        {
          ...capture,
          purchase_units: [
            {
              ...capture.purchase_units[0],
              amount: { currency_code: "USD", value: "12.33" },
            },
          ],
        },
        attempt,
      ),
    /لا تطابق محاولة الدفع/,
  );
  assert.throws(
    () =>
      validatePayPalCapture(
        {
          ...capture,
          purchase_units: [
            {
              ...capture.purchase_units[0],
              amount: { currency_code: "EUR", value: "12.34" },
            },
          ],
        },
        attempt,
      ),
    /لا تطابق محاولة الدفع/,
  );
  assert.throws(
    () => validatePayPalCapture({ ...capture, status: "PENDING" }, attempt),
    /لم تؤكد PayPal/,
  );
});

test("reads the captured amount from the capture record when purchase amount is absent", () => {
  const attempt = {
    _id: { toString: () => "attempt_123" },
    totalAmountMinor: 1234,
    currency: "usd",
  };
  const capture = {
    status: "COMPLETED",
    purchase_units: [
      {
        reference_id: "attempt_123",
        payments: {
          captures: [
            {
              id: "capture_123",
              status: "COMPLETED",
              amount: { currency_code: "USD", value: "12.34" },
            },
          ],
        },
      },
    ],
  };

  assert.equal(validatePayPalCapture(capture, attempt), "capture_123");
});

test("rejects capture-record amount when it differs from the attempt", () => {
  const attempt = {
    _id: { toString: () => "attempt_123" },
    totalAmountMinor: 1234,
    currency: "usd",
  };
  const capture = {
    status: "COMPLETED",
    purchase_units: [
      {
        reference_id: "attempt_123",
        amount: { currency_code: "USD", value: "12.34" },
        payments: {
          captures: [
            {
              id: "capture_123",
              status: "COMPLETED",
              amount: { currency_code: "USD", value: "12.33" },
            },
          ],
        },
      },
    ],
  };

  assert.throws(
    () => validatePayPalCapture(capture, attempt),
    /لا تطابق محاولة الدفع/,
  );
});

test("validates completed PayPal webhook captures without a purchase_units wrapper", () => {
  const attempt = {
    _id: { toString: () => "attempt_123" },
    totalAmountMinor: 1234,
    currency: "usd",
  };
  const resource = {
    id: "capture_456",
    status: "COMPLETED",
    custom_id: "attempt_123",
    amount: { currency_code: "USD", value: "12.34" },
  };

  assert.equal(
    validatePayPalWebhookCapture(resource, attempt),
    "capture_456",
  );
  assert.throws(
    () =>
      validatePayPalWebhookCapture(
        { ...resource, amount: { currency_code: "USD", value: "1.00" } },
        attempt,
      ),
    /لا تطابق محاولة الدفع/,
  );
});

test("simulates PayPal Sandbox create, capture, and repeated capture behavior", async (t) => {
  const originalFetch = global.fetch;
  const requests = [];
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(
        JSON.stringify({ access_token: "sandbox-access-token" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.endsWith("/v2/checkout/orders")) {
      return new Response(
        JSON.stringify({
          id: "PAYPAL-SANDBOX-ORDER-123",
          links: [
            {
              rel: "approve",
              href: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-SANDBOX-ORDER-123",
            },
          ],
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.endsWith("/capture")) {
      return new Response(
        JSON.stringify({
          id: "PAYPAL-SANDBOX-ORDER-123",
          status: "COMPLETED",
          purchase_units: [
            {
              reference_id: "attempt_123",
              amount: { currency_code: "USD", value: "12.34" },
              payments: {
                captures: [
                  { id: "capture_123", status: "COMPLETED" },
                ],
              },
            },
          ],
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`Unexpected PayPal Sandbox URL: ${url}`);
  };

  const attempt = {
    _id: { toString: () => "attempt_123" },
    totalAmountMinor: 1234,
    currency: "usd",
  };
  const config = {
    apiBaseUrl: "https://api-m.sandbox.paypal.com",
    clientId: "sandbox-client",
    clientSecret: "sandbox-secret",
    webhookId: "sandbox-webhook",
    currency: "USD",
    returnUrl: "https://store.example/checkout?paypal=return",
    cancelUrl: "https://store.example/checkout?paypal=cancel",
  };

  const order = await createPayPalOrder({ attempt, config });
  assert.equal(order.orderId, "PAYPAL-SANDBOX-ORDER-123");
  assert.match(order.approvalUrl, /sandbox\.paypal\.com/);

  const firstCapture = await capturePayPalOrder({
    orderId: order.orderId,
    config,
  });
  const repeatedCapture = await capturePayPalOrder({
    orderId: order.orderId,
    config,
  });
  assert.equal(
    validatePayPalCapture(firstCapture, attempt),
    "capture_123",
  );
  assert.equal(
    validatePayPalCapture(repeatedCapture, attempt),
    "capture_123",
  );
  assert.ok(requests.some(({ url }) => url.endsWith("/v2/checkout/orders")));
  assert.ok(requests.filter(({ url }) => url.endsWith("/capture")).length === 2);
  const createRequest = requests.find(({ url }) =>
    url.endsWith("/v2/checkout/orders"),
  );
  assert.equal(
    createRequest.options.headers["PayPal-Request-Id"],
    "create-paypal-attempt_123",
  );
  const captureRequest = requests.find(({ url }) => url.endsWith("/capture"));
  assert.equal(
    captureRequest.options.headers["PayPal-Request-Id"],
    "capture-paypal-PAYPAL-SANDBOX-ORDER-123",
  );
});

test("verifies PayPal Sandbox webhook success and rejects unverified notifications", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  let verificationStatus = "SUCCESS";
  global.fetch = async (url, options) => {
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(
        JSON.stringify({ access_token: "sandbox-access-token" }),
        { status: 200 },
      );
    }
    if (url.endsWith("/v1/notifications/verify-webhook-signature")) {
      return new Response(
        JSON.stringify({ verification_status: verificationStatus }),
        { status: 200 },
      );
    }
    throw new Error(`Unexpected PayPal URL: ${url}`);
  };

  const config = {
    apiBaseUrl: "https://api-m.sandbox.paypal.com",
    clientId: "sandbox-client",
    clientSecret: "sandbox-secret",
    webhookId: "sandbox-webhook",
  };
  const headers = {
    "paypal-transmission-id": "transmission-id",
    "paypal-transmission-time": "2026-11-25T10:00:00Z",
    "paypal-cert-url": "https://api-m.sandbox.paypal.com/cert",
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-transmission-sig": "sandbox-signature",
  };
  const body = {
    id: "event-123",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
  };

  assert.equal(
    await verifyPayPalWebhook({ config, headers, body }),
    true,
  );
  verificationStatus = "FAILURE";
  assert.equal(
    await verifyPayPalWebhook({ config, headers, body }),
    false,
  );
});

test("rejects webhook verification when webhook ID is not configured", async () => {
  await assert.rejects(
    () =>
      verifyPayPalWebhook({
        config: {
          apiBaseUrl: "https://api-m.sandbox.paypal.com",
          clientId: "sandbox-client",
          clientSecret: "sandbox-secret",
          webhookId: undefined,
        },
        headers: {},
        body: {},
      }),
    /معرّف webhook الخاص بـ PayPal غير مهيأ/,
  );
});

test("returns a stable 502 for PayPal network failures", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async () => {
    throw new Error("network disconnected");
  };

  await assert.rejects(
    () =>
      createPayPalOrder({
        attempt: {
          _id: { toString: () => "attempt_123" },
          totalAmountMinor: 1234,
        },
        config: {
          apiBaseUrl: "https://api-m.sandbox.paypal.com",
          clientId: "sandbox-client",
          clientSecret: "sandbox-secret",
          currency: "USD",
          returnUrl: "https://store.example/checkout",
          cancelUrl: "https://store.example/cart",
          requestTimeoutMs: 100,
        },
      }),
    (error) => error.statusCode === 502,
  );
});

test("returns a 504 when PayPal exceeds the request timeout", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (_url, options) => {
    await new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
      setTimeout(resolve, 1000);
    });
  };

  await assert.rejects(
    () =>
      createPayPalOrder({
        attempt: {
          _id: { toString: () => "attempt_123" },
          totalAmountMinor: 1234,
        },
        config: {
          apiBaseUrl: "https://api-m.sandbox.paypal.com",
          clientId: "sandbox-client",
          clientSecret: "sandbox-secret",
          currency: "USD",
          returnUrl: "https://store.example/checkout",
          cancelUrl: "https://store.example/cart",
          requestTimeoutMs: 10,
        },
      }),
    (error) => error.statusCode === 504,
  );
});
