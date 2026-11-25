const test = require("node:test");
const assert = require("node:assert/strict");
const {
  toMinorUnits,
  toMajorUnits,
  buildStripeLineItems,
  validateCheckoutSession,
  getStripeCheckoutStatus,
} = require("../utils/stripeCheckout");
const CheckoutAttempt = require("../models/checkoutAttemptModel");
const Order = require("../models/orderModel");
const { validateCheckoutAttemptRequest } = require("../utils/checkoutAttempt");

test("converts supported USD prices to integer cents", () => {
  assert.equal(toMinorUnits(12), 1200);
  assert.equal(toMinorUnits(12.3), 1230);
  assert.equal(toMinorUnits(12.34), 1234);
  assert.equal(toMajorUnits(1234), 12.34);
});

test("rejects amounts that cannot be represented exactly in USD cents", () => {
  assert.throws(() => toMinorUnits(1.001), /منزلتين عشريتين/);
  assert.throws(() => toMinorUnits(-1), /منزلتين عشريتين/);
  assert.throws(() => toMinorUnits(Number.MAX_SAFE_INTEGER), /خارج النطاق/);
  assert.throws(() => toMinorUnits(10, "jod"), /غير مدعومة/);
});

test("builds Stripe line items from the immutable snapshot", () => {
  assert.deepEqual(
    buildStripeLineItems(
      [
        {
          serviceName: "Service A",
          unitAmountMinor: 1250,
          quantity: 2,
        },
      ],
      "usd",
    ),
    [
      {
        price_data: {
          currency: "usd",
          unit_amount: 1250,
          product_data: { name: "Service A" },
        },
        quantity: 2,
      },
    ],
  );
});

test("accepts only a matching Stripe session, amount, and currency", () => {
  const attempt = {
    _id: "attempt_123",
    stripeSessionId: "cs_test_123",
    paymentMethodType: "card",
    totalAmountMinor: 2500,
    currency: "usd",
  };
  const session = {
    id: "cs_test_123",
    client_reference_id: "attempt_123",
    metadata: { checkoutAttemptId: "attempt_123" },
    mode: "payment",
    amount_total: 2500,
    currency: "usd",
  };

  assert.doesNotThrow(() => validateCheckoutSession(session, attempt));
  assert.throws(
    () =>
      validateCheckoutSession(
        { ...session, amount_total: 2499 },
        attempt,
      ),
    /لا تطابق Snapshot/,
  );
  assert.throws(
    () =>
      validateCheckoutSession(
        { ...session, currency: "eur" },
        attempt,
      ),
    /لا تطابق Snapshot/,
  );
  assert.throws(
    () =>
      validateCheckoutSession(
        { ...session, id: "cs_test_other" },
        attempt,
      ),
    /لا تطابق محاولة الدفع/,
  );
  assert.throws(
    () =>
      validateCheckoutSession(
        { ...session, client_reference_id: "attempt_other" },
        attempt,
      ),
    /لا تطابق محاولة الدفع/,
  );
  assert.throws(
    () =>
      validateCheckoutSession(
        { ...session, metadata: { checkoutAttemptId: "attempt_other" } },
        attempt,
      ),
    /لا تطابق محاولة الدفع/,
  );
  assert.throws(
    () =>
      validateCheckoutSession(session, {
        ...attempt,
        paymentMethodType: "paypal",
      }),
    /لا تطابق محاولة الدفع/,
  );
});

test("reuses a checkout attempt only for its cart and payment method", () => {
  const attempt = {
    cartId: { toString: () => "cart_123" },
    paymentMethodType: "card",
  };

  assert.doesNotThrow(() =>
    validateCheckoutAttemptRequest(attempt, {
      cartId: "cart_123",
      paymentMethod: "card",
    }),
  );
  assert.throws(
    () =>
      validateCheckoutAttemptRequest(attempt, {
        cartId: "cart_456",
        paymentMethod: "card",
      }),
    /مفتاح الدفع مستخدم لمحاولة أخرى/,
  );
  assert.throws(
    () =>
      validateCheckoutAttemptRequest(attempt, {
        cartId: "cart_123",
        paymentMethod: "paypal",
      }),
    /مرتبط بوسيلة دفع أخرى/,
  );
});

test("maps Stripe checkout returns to authoritative payment states", () => {
  assert.equal(
    getStripeCheckoutStatus(
      { status: "complete", payment_status: "paid" },
      "open",
    ),
    "paid",
  );
  assert.equal(
    getStripeCheckoutStatus(
      { status: "complete", payment_status: "unpaid" },
      "open",
    ),
    "pending",
  );
  assert.equal(
    getStripeCheckoutStatus(
      { status: "complete", payment_status: "unpaid" },
      "failed",
    ),
    "failed",
  );
  assert.equal(
    getStripeCheckoutStatus({ status: "expired", payment_status: "unpaid" }, "open"),
    "expired",
  );
});

test("declares database uniqueness for attempts and their orders", () => {
  const attemptIndexes = CheckoutAttempt.schema.indexes();
  const orderIndexes = Order.schema.indexes();

  assert.ok(
    attemptIndexes.some(
      ([fields, options]) =>
        fields.user === 1 &&
        fields.idempotencyKey === 1 &&
        options.unique === true,
    ),
  );
  assert.ok(
    attemptIndexes.some(
      ([fields, options]) =>
        fields.user === 1 &&
        fields.cartId === 1 &&
        fields.cartRevision === 1 &&
        options.unique === true &&
        options.partialFilterExpression?.isActive === true,
    ),
  );
  assert.ok(
    orderIndexes.some(
      ([fields, options]) =>
        fields.checkoutAttempt === 1 &&
        options.unique === true &&
        options.sparse === true,
    ),
  );
  assert.ok(
    orderIndexes.some(
      ([fields, options]) =>
        fields.stripeSessionId === 1 &&
        options.unique === true &&
        options.sparse === true,
    ),
  );
});

test("allows PayPal in checkout attempt and order payment method enums", () => {
  const attemptPaymentTypes =
    CheckoutAttempt.schema.path("paymentMethodType").enumValues;
  const orderPaymentTypes =
    Order.schema.path("paymentMethodType").enumValues;

  assert.ok(attemptPaymentTypes.includes("paypal"));
  assert.ok(attemptPaymentTypes.includes("card"));
  assert.ok(orderPaymentTypes.includes("paypal"));
});
