const test = require("node:test");
const assert = require("node:assert/strict");

process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || "sk_test_handlers";
process.env.NODE_ENV = "development";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.PAYPAL_ENVIRONMENT = "sandbox";
process.env.PAYPAL_SANDBOX_CLIENT_ID = "sandbox-client-id";
process.env.PAYPAL_SANDBOX_CLIENT_SECRET = "sandbox-client-secret";
process.env.PAYPAL_SANDBOX_WEBHOOK_ID = "sandbox-webhook-id";
process.env.PAYPAL_WEBHOOK_URL =
  "http://localhost:5000/api/v1/order/paypal-webhook";

const mongoose = require("mongoose");
const CheckoutAttempt = require("../models/checkoutAttemptModel");
const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const {
  checkoutSession,
  capturePayPalCheckout,
  cancelPayPalCheckout,
  paypalWebhook,
} = require("../services/orderServices");

const invokeHandler = async (handler, reqOverrides = {}) => {
  let statusCode = 200;
  let body;
  const req = {
    method: "POST",
    params: {},
    query: {},
    body: {},
    headers: {},
    user: { _id: new mongoose.Types.ObjectId(), email: "buyer@example.com" },
    get(name) {
      return this.headers[name.toLowerCase()];
    },
    ...reqOverrides,
  };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  let capturedError = null;
  await handler(req, res, (err) => {
    capturedError = err;
  });

  return { statusCode, body, error: capturedError };
};

test("checkoutSession rejects empty cart with 400", async (t) => {
  const cartId = new mongoose.Types.ObjectId().toString();
  t.mock.method(CheckoutAttempt, "findOne", async () => null);
  t.mock.method(Cart, "findOne", () => ({
    populate: async () => ({
      _id: cartId,
      cartItems: [],
    }),
  }));

  const { error } = await invokeHandler(checkoutSession, {
    params: { cartId },
    headers: { "idempotency-key": "idem-empty-cart-1" },
    body: { paymentMethod: "card" },
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /السلة فارغة/);
});

test("checkoutSession rejects unsupported paymentMethod with 400", async () => {
  const cartId = new mongoose.Types.ObjectId().toString();
  const { error } = await invokeHandler(checkoutSession, {
    params: { cartId },
    headers: { "idempotency-key": "idem-bad-method-1" },
    body: { paymentMethod: "palpay" },
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /غير مدعومة/);
});

test("checkoutSession returns paypalOrderId when reusing an open PayPal attempt", async (t) => {
  const cartId = new mongoose.Types.ObjectId();
  const attempt = {
    _id: new mongoose.Types.ObjectId(),
    cartId,
    paymentMethodType: "paypal",
    paypalOrderId: "PAYPAL-ORDER-OPEN-1",
    checkoutUrl: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-OPEN-1",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    status: "open",
  };
  t.mock.method(CheckoutAttempt, "findOne", async () => attempt);

  const { statusCode, body, error } = await invokeHandler(checkoutSession, {
    params: { cartId: cartId.toString() },
    headers: { "idempotency-key": "idem-paypal-reuse-1" },
    body: { paymentMethod: "paypal" },
  });

  assert.equal(error, null);
  assert.equal(statusCode, 200);
  assert.equal(body.session.id, "PAYPAL-ORDER-OPEN-1");
  assert.equal(body.session.url, attempt.checkoutUrl);
});

test("checkoutSession expires an open PayPal attempt instead of reusing it", async (t) => {
  const cartId = new mongoose.Types.ObjectId();
  const attempt = {
    _id: new mongoose.Types.ObjectId(),
    cartId,
    paymentMethodType: "paypal",
    paypalOrderId: "PAYPAL-ORDER-EXPIRED-1",
    checkoutUrl: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-EXPIRED-1",
    expiresAt: new Date(Date.now() - 30 * 60 * 1000),
    status: "open",
    isActive: true,
    save: async function () {
      return this;
    },
  };
  t.mock.method(CheckoutAttempt, "findOne", async () => attempt);

  const { error } = await invokeHandler(checkoutSession, {
    params: { cartId: cartId.toString() },
    headers: { "idempotency-key": "idem-paypal-expired-1" },
    body: { paymentMethod: "paypal" },
  });

  assert.ok(error);
  assert.equal(error.statusCode, 409);
  assert.match(error.message, /انتهت صلاحية جلسة دفع PayPal/);
  assert.equal(attempt.status, "expired");
  assert.equal(attempt.isActive, false);
});

test("paypalWebhook rejects unverified webhook notifications with 400", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
    }
    if (url.endsWith("/v1/notifications/verify-webhook-signature")) {
      return new Response(JSON.stringify({ verification_status: "FAILURE" }), {
        status: 200,
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const { error } = await invokeHandler(paypalWebhook, {
    body: { id: "evt_1", event_type: "PAYMENT.CAPTURE.COMPLETED" },
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /توقيع إشعار PayPal غير صالح/);
});

test("paypalWebhook guards against overwriting a paid attempt to failed on DENIED", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
    }
    if (url.endsWith("/v1/notifications/verify-webhook-signature")) {
      return new Response(JSON.stringify({ verification_status: "SUCCESS" }), {
        status: 200,
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const attemptId = new mongoose.Types.ObjectId();
  t.mock.method(CheckoutAttempt, "findOne", async () => ({
    _id: attemptId,
    paymentMethodType: "paypal",
    paypalOrderId: "PAYPAL-ORDER-PAID-1",
    status: "paid",
  }));

  const updateCalls = [];
  t.mock.method(CheckoutAttempt, "updateOne", async (filter, update) => {
    updateCalls.push({ filter, update });
    return { modifiedCount: 0 };
  });

  const { statusCode, body, error } = await invokeHandler(paypalWebhook, {
    body: {
      id: "evt_denied_1",
      event_type: "PAYMENT.CAPTURE.DENIED",
      resource: {
        id: "cap_1",
        supplementary_data: {
          related_ids: { order_id: "PAYPAL-ORDER-PAID-1" },
        },
      },
    },
  });

  assert.equal(error, null);
  assert.equal(statusCode, 200);
  assert.deepEqual(body, { received: true, status: "processed" });
  assert.equal(updateCalls.length, 1);
  assert.deepEqual(updateCalls[0].filter, {
    _id: attemptId,
    status: { $ne: "paid" },
  });
});

test("paypalWebhook creates one paid order for repeated COMPLETED captures", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "tok" }), {
        status: 200,
      });
    }
    if (url.endsWith("/v1/notifications/verify-webhook-signature")) {
      return new Response(JSON.stringify({ verification_status: "SUCCESS" }), {
        status: 200,
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const attemptId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const cartId = new mongoose.Types.ObjectId();
  const attempt = {
    _id: attemptId,
    user: userId,
    cartId,
    cartRevision: 2,
    paymentMethodType: "paypal",
    paypalOrderId: "PAYPAL-WEBHOOK-ORDER-1",
    totalAmountMinor: 2500,
    currency: "usd",
    cartItems: [],
    status: "open",
    isActive: true,
    processedEventIds: [],
    save: async () => {},
  };
  attempt.processedEventIds.addToSet = (id) => {
    if (!attempt.processedEventIds.includes(id)) {
      attempt.processedEventIds.push(id);
    }
  };

  t.mock.method(CheckoutAttempt, "findOne", async () => attempt);
  t.mock.method(CheckoutAttempt, "findById", () => ({
    session: async () => attempt,
  }));
  t.mock.method(CheckoutAttempt, "updateOne", async () => ({
    modifiedCount: 1,
  }));

  let orderExists = false;
  let createOrderCalls = 0;
  t.mock.method(Order, "findOne", () => ({
    select() {
      return this;
    },
    session() {
      return this;
    },
    async lean() {
      return orderExists ? { _id: new mongoose.Types.ObjectId() } : null;
    },
  }));
  t.mock.method(Order, "create", async ([data]) => {
    createOrderCalls += 1;
    orderExists = true;
    return [{ ...data, _id: new mongoose.Types.ObjectId() }];
  });

  let cartDeleteCalls = 0;
  t.mock.method(Cart, "deleteOne", async () => {
    cartDeleteCalls += 1;
    return { deletedCount: 1 };
  });
  t.mock.method(mongoose, "startSession", async () => ({
    async withTransaction(cb) {
      await cb(this);
    },
    async endSession() {},
  }));

  const event = {
    id: "evt_completed_1",
    event_type: "PAYMENT.CAPTURE.COMPLETED",
    resource: {
      id: "capture_1",
      status: "COMPLETED",
      custom_id: attemptId.toString(),
      amount: { currency_code: "USD", value: "25.00" },
      supplementary_data: {
        related_ids: { order_id: "PAYPAL-WEBHOOK-ORDER-1" },
      },
    },
  };

  const first = await invokeHandler(paypalWebhook, { body: event });
  const repeated = await invokeHandler(paypalWebhook, { body: event });

  assert.equal(first.error, null);
  assert.equal(repeated.error, null);
  assert.equal(createOrderCalls, 1);
  assert.equal(cartDeleteCalls, 2);
});

test("paypalWebhook rejects a completed capture with mismatched amount", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "tok" }), {
        status: 200,
      });
    }
    if (url.endsWith("/v1/notifications/verify-webhook-signature")) {
      return new Response(JSON.stringify({ verification_status: "SUCCESS" }), {
        status: 200,
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const attemptId = new mongoose.Types.ObjectId();
  t.mock.method(CheckoutAttempt, "findOne", async () => ({
    _id: attemptId,
    paymentMethodType: "paypal",
    paypalOrderId: "PAYPAL-WEBHOOK-ORDER-2",
    totalAmountMinor: 2500,
    currency: "usd",
  }));

  const { error } = await invokeHandler(paypalWebhook, {
    body: {
      id: "evt_completed_mismatch",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "capture_mismatch",
        status: "COMPLETED",
        custom_id: attemptId.toString(),
        amount: { currency_code: "USD", value: "1.00" },
        supplementary_data: {
          related_ids: { order_id: "PAYPAL-WEBHOOK-ORDER-2" },
        },
      },
    },
  });

  assert.ok(error);
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /لا تطابق محاولة الدفع/);
});

test("cancelPayPalCheckout marks an open owned attempt failed", async (t) => {
  const attempt = {
    _id: new mongoose.Types.ObjectId(),
    paymentMethodType: "paypal",
    paypalOrderId: "PAYPAL-CANCEL-1",
    status: "open",
    isActive: true,
    save: async function () {
      return this;
    },
  };
  t.mock.method(CheckoutAttempt, "findOne", async () => attempt);

  const { statusCode, body, error } = await invokeHandler(
    cancelPayPalCheckout,
    {
      user: { _id: new mongoose.Types.ObjectId() },
      params: { paypalOrderId: "PAYPAL-CANCEL-1" },
    },
  );

  assert.equal(error, null);
  assert.equal(statusCode, 200);
  assert.deepEqual(body.data, { paymentStatus: "failed" });
  assert.equal(attempt.status, "failed");
  assert.equal(attempt.isActive, false);
});

test("cancelPayPalCheckout does not overwrite a paid attempt", async (t) => {
  const attempt = {
    _id: new mongoose.Types.ObjectId(),
    paymentMethodType: "paypal",
    paypalOrderId: "PAYPAL-PAID-1",
    status: "paid",
    isActive: false,
  };
  t.mock.method(CheckoutAttempt, "findOne", async () => attempt);

  const { error } = await invokeHandler(cancelPayPalCheckout, {
    user: { _id: new mongoose.Types.ObjectId() },
    params: { paypalOrderId: "PAYPAL-PAID-1" },
  });

  assert.equal(error, null);
  assert.equal(attempt.status, "paid");
  assert.equal(attempt.isActive, false);
});

test("capturePayPalCheckout marks a denied capture attempt failed", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "tok" }), {
        status: 200,
      });
    }
    if (url.endsWith("/capture")) {
      return new Response(
        JSON.stringify({ id: "PAYPAL-CAP-DENIED", status: "DECLINED" }),
        { status: 201 },
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const attempt = {
    _id: new mongoose.Types.ObjectId(),
    user: new mongoose.Types.ObjectId(),
    cartId: new mongoose.Types.ObjectId(),
    paymentMethodType: "paypal",
    paypalOrderId: "PAYPAL-CAP-DENIED",
    totalAmountMinor: 2500,
    currency: "usd",
    status: "open",
    isActive: true,
    save: async function () {
      return this;
    },
  };
  t.mock.method(CheckoutAttempt, "findOne", async () => attempt);

  const { statusCode, body, error } = await invokeHandler(
    capturePayPalCheckout,
    {
      user: { _id: attempt.user },
      params: { paypalOrderId: "PAYPAL-CAP-DENIED" },
    },
  );

  assert.equal(error, null);
  assert.equal(statusCode, 200);
  assert.deepEqual(body.data, { paymentStatus: "failed" });
  assert.equal(attempt.status, "failed");
  assert.equal(attempt.isActive, false);
});

test("capturePayPalCheckout creates a paid order and clears cart on COMPLETED capture", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  const attemptId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const cartId = new mongoose.Types.ObjectId();

  global.fetch = async (url) => {
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
    }
    if (url.endsWith("/capture")) {
      return new Response(
        JSON.stringify({
          id: "PAYPAL-CAP-ORDER-1",
          status: "COMPLETED",
          purchase_units: [
            {
              reference_id: attemptId.toString(),
              amount: { currency_code: "USD", value: "25.00" },
              payments: {
                captures: [{ id: "CAPTURE-999", status: "COMPLETED" }],
              },
            },
          ],
        }),
        { status: 201 },
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const attempt = {
    _id: attemptId,
    user: userId,
    cartId,
    cartRevision: 2,
    paymentMethodType: "paypal",
    paypalOrderId: "PAYPAL-CAP-ORDER-1",
    totalAmountMinor: 2500,
    currency: "usd",
    cartItems: [],
    status: "open",
    isActive: true,
    processedEventIds: [],
    save: async () => {},
  };
  attempt.processedEventIds.addToSet = (id) => {
    if (!attempt.processedEventIds.includes(id)) {
      attempt.processedEventIds.push(id);
    }
  };

  t.mock.method(CheckoutAttempt, "findOne", async () => attempt);
  t.mock.method(CheckoutAttempt, "findById", () => ({
    session: async () => attempt,
  }));
  t.mock.method(Order, "findOne", () => ({
    select() {
      return this;
    },
    session() {
      return this;
    },
    async lean() {
      return null;
    },
  }));
  let createdOrder = null;
  t.mock.method(Order, "create", async ([data]) => {
    createdOrder = { ...data, _id: new mongoose.Types.ObjectId() };
    return [createdOrder];
  });
  let cartDeleted = false;
  t.mock.method(Cart, "deleteOne", async () => {
    cartDeleted = true;
    return { deletedCount: 1 };
  });
  t.mock.method(mongoose, "startSession", async () => ({
    async withTransaction(cb) {
      await cb(this);
    },
    async endSession() {},
  }));

  const { statusCode, body, error } = await invokeHandler(capturePayPalCheckout, {
    user: { _id: userId },
    params: { paypalOrderId: "PAYPAL-CAP-ORDER-1" },
  });

  assert.equal(error, null);
  assert.equal(statusCode, 200);
  assert.deepEqual(body.data, {
    paymentStatus: "paid",
    captureId: "CAPTURE-999",
  });
  assert.equal(createdOrder.paymentMethodType, "paypal");
  assert.equal(createdOrder.isPaid, true);
  assert.equal(cartDeleted, true);
});

test("checkoutSession supersedes an open active attempt when switching paymentMethod", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = async (url) => {
    if (url.endsWith("/v1/oauth2/token")) {
      return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
    }
    if (url.endsWith("/v2/checkout/orders")) {
      return new Response(
        JSON.stringify({
          id: "PAYPAL-SWITCH-1",
          links: [
            {
              rel: "approve",
              href: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-SWITCH-1",
            },
          ],
        }),
        { status: 201 },
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const userId = new mongoose.Types.ObjectId();
  const cartId = new mongoose.Types.ObjectId();
  const serviceId = new mongoose.Types.ObjectId();
  const oldCardAttempt = {
    _id: new mongoose.Types.ObjectId(),
    cartId,
    paymentMethodType: "card",
    status: "open",
    isActive: true,
  };

  let findOneCall = 0;
  t.mock.method(CheckoutAttempt, "findOne", async () => {
    findOneCall += 1;
    if (findOneCall <= 2) return null;
    return oldCardAttempt;
  });

  t.mock.method(Cart, "findOne", () => ({
    populate: async () => ({
      _id: cartId,
      user: userId,
      revision: 1,
      totalCartPrice: 25,
      cartItems: [
        {
          service: { _id: serviceId, name: "Service", price: 25, minQuantity: 1 },
          quantity: 1,
          price: 25,
        },
      ],
    }),
  }));

  let createCall = 0;
  let newAttempt = null;
  t.mock.method(CheckoutAttempt, "create", async (data) => {
    createCall += 1;
    if (createCall === 1) {
      const dupErr = new Error("duplicate key");
      dupErr.code = 11000;
      throw dupErr;
    }
    newAttempt = {
      ...data,
      _id: new mongoose.Types.ObjectId(),
      save: async () => {},
    };
    return newAttempt;
  });

  const deactivated = [];
  t.mock.method(CheckoutAttempt, "updateOne", async (filter, update) => {
    deactivated.push({ filter, update });
    return { modifiedCount: 1 };
  });

  const { statusCode, body, error } = await invokeHandler(checkoutSession, {
    user: { _id: userId, email: "buyer@example.com" },
    params: { cartId: cartId.toString() },
    headers: { "idempotency-key": "idem-switch-paypal-1" },
    body: { paymentMethod: "paypal" },
  });

  assert.equal(error, null);
  assert.equal(statusCode, 200);
  assert.equal(body.session.id, "PAYPAL-SWITCH-1");
  assert.equal(deactivated.length, 1);
  assert.deepEqual(deactivated[0].update, {
    $set: { status: "expired", isActive: false },
  });
});
