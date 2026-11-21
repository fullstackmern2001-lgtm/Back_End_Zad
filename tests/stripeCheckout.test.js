const test = require("node:test");
const assert = require("node:assert/strict");
const {
  toMinorUnits,
  toMajorUnits,
  buildStripeLineItems,
  validateCheckoutSession,
} = require("../utils/stripeCheckout");
const CheckoutAttempt = require("../models/checkoutAttemptModel");
const Order = require("../models/orderModel");

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
    stripeSessionId: "cs_test_123",
    totalAmountMinor: 2500,
    currency: "usd",
  };
  const session = {
    id: "cs_test_123",
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
