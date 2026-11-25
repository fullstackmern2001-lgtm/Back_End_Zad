const ApiError = require("./ApiError");

const validateCheckoutAttemptRequest = (
  attempt,
  { cartId, paymentMethod },
) => {
  if (attempt.cartId.toString() !== cartId) {
    throw new ApiError("مفتاح الدفع مستخدم لمحاولة أخرى", 409);
  }

  if (paymentMethod && attempt.paymentMethodType !== paymentMethod) {
    throw new ApiError("مفتاح محاولة الدفع مرتبط بوسيلة دفع أخرى", 409);
  }
};

module.exports = { validateCheckoutAttemptRequest };
