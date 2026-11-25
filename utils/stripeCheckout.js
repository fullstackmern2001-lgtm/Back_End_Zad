const ApiError = require("./ApiError");

const toMinorUnits = (value, currency = "usd") => {
  if (currency !== "usd") {
    throw new ApiError("عملة الدفع غير مدعومة", 400);
  }

  const amount = String(value);
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) {
    throw new ApiError("يجب أن يكون السعر موجبًا وبحد أقصى منزلتين عشريتين", 400);
  }

  const wholeUnits = Number(match[1]);
  const fractionalUnits = Number((match[2] || "").padEnd(2, "0"));
  const minorUnits = wholeUnits * 100 + fractionalUnits;
  if (!Number.isSafeInteger(minorUnits)) {
    throw new ApiError("قيمة الدفع خارج النطاق المسموح", 400);
  }

  return minorUnits;
};

const toMajorUnits = (minorUnits) => Number((minorUnits / 100).toFixed(2));

const buildStripeLineItems = (items, currency) =>
  items.map((item) => ({
    price_data: {
      currency,
      unit_amount: item.unitAmountMinor,
      product_data: { name: item.serviceName },
    },
    quantity: item.quantity,
  }));

const validateCheckoutSession = (session, attempt) => {
  if (!session?.id || !attempt) {
    throw new ApiError("بيانات جلسة الدفع غير مكتملة", 400);
  }
  const attemptId = attempt._id?.toString();
  if (
    attempt.paymentMethodType !== "card" ||
    !attemptId ||
    session.client_reference_id !== attemptId ||
    session.metadata?.checkoutAttemptId !== attemptId
  ) {
    throw new ApiError("جلسة Stripe لا تطابق محاولة الدفع", 400);
  }
  if (attempt.stripeSessionId && attempt.stripeSessionId !== session.id) {
    throw new ApiError("جلسة Stripe لا تطابق محاولة الدفع", 400);
  }
  if (
    session.mode !== "payment" ||
    !Number.isSafeInteger(session.amount_total) ||
    session.amount_total !== attempt.totalAmountMinor ||
    String(session.currency || "").toLowerCase() !== attempt.currency
  ) {
    throw new ApiError("مبلغ أو عملة جلسة Stripe لا تطابق Snapshot", 400);
  }
};

const getStripeCheckoutStatus = (session, attemptStatus) => {
  if (session.payment_status === "paid" || attemptStatus === "paid") {
    return "paid";
  }
  if (session.status === "expired" || attemptStatus === "expired") {
    return "expired";
  }
  if (attemptStatus === "failed") {
    return "failed";
  }
  return "pending";
};

module.exports = {
  toMinorUnits,
  toMajorUnits,
  buildStripeLineItems,
  validateCheckoutSession,
  getStripeCheckoutStatus,
};
