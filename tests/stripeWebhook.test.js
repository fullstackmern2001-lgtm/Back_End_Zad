const test = require("node:test");
const assert = require("node:assert/strict");

const stripeSecretKey = "sk_test_checkout_workflow";
const webhookSecret = "whsec_checkout_workflow";
process.env.STRIPE_SECRET_KEY = stripeSecretKey;
process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;

const Stripe = require("stripe");
const mongoose = require("mongoose");
const CheckoutAttempt = require("../models/checkoutAttemptModel");
const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const { webhookCheckout } = require("../services/orderServices");

const stripe = new Stripe(stripeSecretKey);

const createAttempt = () => {
  const attempt = {
    _id: new mongoose.Types.ObjectId(),
    user: new mongoose.Types.ObjectId(),
    cartId: new mongoose.Types.ObjectId(),
    cartRevision: 4,
    paymentMethodType: "card",
    stripeSessionId: "cs_test_checkout_workflow",
    totalAmountMinor: 2500,
    currency: "usd",
    cartItems: [],
    status: "open",
    isActive: true,
    processedEventIds: [],
    save: async () => {},
    session() {
      return Promise.resolve(this);
    },
  };
  attempt._idString = attempt._id.toString();
  attempt.processedEventIds.addToSet = (eventId) => {
    if (!attempt.processedEventIds.includes(eventId)) {
      attempt.processedEventIds.push(eventId);
    }
  };
  return attempt;
};

const createEvent = (attempt, type, paymentStatus, eventId) => ({
  id: eventId,
  object: "event",
  type,
  data: {
    object: {
      id: attempt.stripeSessionId,
      object: "checkout.session",
      client_reference_id: attempt._idString,
      metadata: { checkoutAttemptId: attempt._idString },
      mode: "payment",
      status: type === "checkout.session.expired" ? "expired" : "complete",
      payment_status: paymentStatus,
      amount_total: attempt.totalAmountMinor,
      currency: attempt.currency,
    },
  },
});

const deliverEvent = async (event) => {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });
  let responseStatus;
  let responseBody;

  await webhookCheckout(
    {
      body: Buffer.from(payload),
      headers: { "stripe-signature": signature },
    },
    {
      status(status) {
        responseStatus = status;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    },
    (error) => {
      if (error) throw error;
    },
  );

  return { responseStatus, responseBody };
};

const mockFindAttempt = (t, attempt) => {
  t.mock.method(CheckoutAttempt, "findById", () => attempt);
};

test("creates one paid order for repeated successful Stripe notifications", async (t) => {
  const attempt = createAttempt();
  let orderExists = false;
  let createOrderCalls = 0;
  const cartDeleteFilters = [];
  const attemptUpdates = [];
  mockFindAttempt(t, attempt);
  t.mock.method(CheckoutAttempt, "updateOne", async (filter, update) => {
    attemptUpdates.push({ filter, update });
    return { modifiedCount: 1 };
  });
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
  t.mock.method(Order, "create", async ([orderData]) => {
    createOrderCalls += 1;
    orderExists = true;
    return [{ ...orderData, _id: new mongoose.Types.ObjectId() }];
  });
  t.mock.method(Cart, "deleteOne", async (filter) => {
    cartDeleteFilters.push(filter);
    return { deletedCount: 1 };
  });
  t.mock.method(mongoose, "startSession", async () => ({
    async withTransaction(callback) {
      await callback(this);
    },
    async endSession() {},
  }));

  const event = createEvent(
    attempt,
    "checkout.session.completed",
    "paid",
    "evt_checkout_paid",
  );
  const firstResponse = await deliverEvent(event);
  const repeatedResponse = await deliverEvent(event);

  assert.deepEqual(firstResponse.responseBody, { received: true });
  assert.deepEqual(repeatedResponse.responseBody, { received: true });
  assert.equal(createOrderCalls, 1);
  assert.equal(attemptUpdates.length, 1);
  assert.equal(cartDeleteFilters.length, 2);
  assert.deepEqual(
    cartDeleteFilters[0],
    {
      _id: attempt.cartId,
      user: attempt.user,
      revision: attempt.cartRevision,
    },
  );
  assert.deepEqual(cartDeleteFilters[1], cartDeleteFilters[0]);
});

test("does not create a paid order for declined or expired Stripe sessions", async (t) => {
  const attempt = createAttempt();
  const updates = [];
  let createOrderCalls = 0;
  let cartDeleteCalls = 0;
  mockFindAttempt(t, attempt);
  t.mock.method(CheckoutAttempt, "updateOne", async (filter, update) => {
    updates.push({ filter, update });
    return { modifiedCount: 1 };
  });
  t.mock.method(Order, "create", async () => {
    createOrderCalls += 1;
    return [];
  });
  t.mock.method(Cart, "deleteOne", async () => {
    cartDeleteCalls += 1;
    return { deletedCount: 1 };
  });

  await deliverEvent(
    createEvent(
      attempt,
      "checkout.session.async_payment_failed",
      "unpaid",
      "evt_checkout_failed",
    ),
  );
  await deliverEvent(
    createEvent(
      attempt,
      "checkout.session.expired",
      "unpaid",
      "evt_checkout_expired",
    ),
  );

  assert.equal(createOrderCalls, 0);
  assert.equal(cartDeleteCalls, 0);
  assert.deepEqual(
    updates.map(({ update }) => update.$set.status),
    ["failed", "expired"],
  );
  assert.ok(updates.every(({ filter }) => filter.status.$ne === "paid"));
});

test("keeps an unpaid completed Stripe session pending without creating an order", async (t) => {
  const attempt = createAttempt();
  const updates = [];
  let createOrderCalls = 0;
  mockFindAttempt(t, attempt);
  t.mock.method(CheckoutAttempt, "updateOne", async (filter, update) => {
    updates.push({ filter, update });
    return { modifiedCount: 1 };
  });
  t.mock.method(Order, "create", async () => {
    createOrderCalls += 1;
    return [];
  });

  const response = await deliverEvent(
    createEvent(
      attempt,
      "checkout.session.completed",
      "unpaid",
      "evt_checkout_pending",
    ),
  );

  assert.deepEqual(response.responseBody, { received: true });
  assert.equal(createOrderCalls, 0);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].update, {
    $addToSet: { processedEventIds: "evt_checkout_pending" },
  });
});
