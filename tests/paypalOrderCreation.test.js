const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || "sk_test_paypal_order_creation";
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_paypal_order_creation";

const CheckoutAttempt = require("../models/checkoutAttemptModel");
const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const {
  createPaidOrderForPayPal,
} = require("../services/orderServices");
const { validatePayPalCapture } = require("../utils/paypalCheckout");

const createAttempt = () => {
  const attempt = {
    _id: new mongoose.Types.ObjectId(),
    user: new mongoose.Types.ObjectId(),
    cartId: new mongoose.Types.ObjectId(),
    cartRevision: 3,
    paypalOrderId: "PAYPAL-SANDBOX-ORDER-123",
    paymentMethodType: "paypal",
    totalAmountMinor: 1234,
    currency: "usd",
    cartItems: [
      {
        service: new mongoose.Types.ObjectId(),
        serviceName: "Service A",
        serviceImage: "",
        price: 12.34,
        minQuantity: 1,
        quantity: 1,
        totalItemPrice: 12.34,
      },
    ],
    status: "open",
    isActive: true,
    processedEventIds: [],
    save: async () => {},
  };
  attempt.processedEventIds.addToSet = (eventId) => {
    if (!attempt.processedEventIds.includes(eventId)) {
      attempt.processedEventIds.push(eventId);
    }
  };
  attempt.session = () => attempt;
  return attempt;
};

test("creates one PayPal order for repeated captures and only clears matching carts", async (t) => {
  const attempt = createAttempt();
  let orderExists = false;
  let createOrderCalls = 0;
  let cartDeleteCalls = 0;

  t.mock.method(CheckoutAttempt, "findById", (id) => {
    assert.equal(id.toString(), attempt._id.toString());
    return attempt;
  });
  t.mock.method(CheckoutAttempt, "updateOne", async () => ({
    modifiedCount: 1,
  }));
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
    cartDeleteCalls += 1;
    assert.deepEqual(filter, {
      _id: attempt.cartId,
      user: attempt.user,
      revision: attempt.cartRevision,
    });
    return { deletedCount: 1 };
  });
  t.mock.method(mongoose, "startSession", async () => ({
    async withTransaction(callback) {
      await callback(this);
    },
    async endSession() {},
  }));

  await createPaidOrderForPayPal(attempt, "capture_123", "event_123");
  await createPaidOrderForPayPal(attempt, "capture_123", "event_123");

  assert.equal(createOrderCalls, 1);
  assert.equal(cartDeleteCalls, 2);
});

test("does not create or clear a PayPal order for failed or mismatched captures", async (t) => {
  const attempt = createAttempt();
  let createOrderCalls = 0;
  let cartDeleteCalls = 0;

  t.mock.method(Order, "create", async () => {
    createOrderCalls += 1;
    return [];
  });
  t.mock.method(Cart, "deleteOne", async () => {
    cartDeleteCalls += 1;
    return { deletedCount: 1 };
  });

  assert.throws(
    () =>
      validatePayPalCapture(
        {
          status: "COMPLETED",
          purchase_units: [
            {
              reference_id: "attempt_123",
              amount: { currency_code: "USD", value: "1.00" },
              payments: {
                captures: [
                  { id: "capture_bad", status: "COMPLETED" },
                ],
              },
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
          status: "PENDING",
          purchase_units: [],
        },
        attempt,
      ),
    /لم تؤكد PayPal/,
  );

  assert.equal(createOrderCalls, 0);
  assert.equal(cartDeleteCalls, 0);
});
