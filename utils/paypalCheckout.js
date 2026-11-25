const ApiError = require("./ApiError");

const DEFAULT_REQUEST_TIMEOUT_MS = 10000;

const fetchPayPalResponse = async (url, options = {}, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_REQUEST_TIMEOUT_MS,
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError("انتهت مهلة الاتصال بخدمة PayPal", 504);
    }
    throw new ApiError("تعذر الاتصال بخدمة PayPal", 502);
  } finally {
    clearTimeout(timer);
  }
};

const paypalRequest = async (config, path, options = {}) => {
  const auth = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
    "utf8",
  ).toString("base64");

  const tokenResponse = await fetchPayPalResponse(
    `${config.apiBaseUrl}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
    config.requestTimeoutMs,
  );
  if (!tokenResponse.ok) {
    throw new ApiError("تعذر الاتصال بخدمة PayPal", 502);
  }

  const token = await tokenResponse.json();
  if (!token.access_token) {
    throw new ApiError("تعذر تهيئة جلسة PayPal", 502);
  }

  const response = await fetchPayPalResponse(
    `${config.apiBaseUrl}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    },
    config.requestTimeoutMs,
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      payload?.message || "فشلت عملية PayPal",
      response.status === 422 ? 400 : 502,
    );
  }
  return payload;
};

const buildPayPalOrderPayload = ({ attempt, config }) => ({
  intent: "CAPTURE",
  purchase_units: [
    {
      reference_id: attempt._id.toString(),
      custom_id: attempt._id.toString(),
      invoice_id: `ZAD-PAYPAL-${attempt._id.toString()}`,
      amount: {
        currency_code: config.currency,
        value: (attempt.totalAmountMinor / 100).toFixed(2),
      },
      description: "ZAD checkout",
    },
  ],
  application_context: {
    brand_name: "ZAD",
    locale: "en-US",
    shipping_preference: "NO_SHIPPING",
    user_action: "PAY_NOW",
    return_url: config.returnUrl,
    cancel_url: config.cancelUrl,
  },
});

const createPayPalOrder = async ({ attempt, config }) => {
  const payload = await paypalRequest(config, "/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify(buildPayPalOrderPayload({ attempt, config })),
    headers: {
      "PayPal-Request-Id": `create-paypal-${attempt._id.toString()}`,
    },
  });
  if (!payload?.id) {
    throw new ApiError("لم تُرجع PayPal معرف الطلب", 502);
  }
  const approvalLink = payload.links?.find(
    (link) => link.rel === "approve",
  );
  if (!approvalLink?.href) {
    throw new ApiError("لم تُرجع PayPal رابط الموافقة", 502);
  }
  return { orderId: payload.id, approvalUrl: approvalLink.href };
};

const capturePayPalOrder = async ({ orderId, config }) =>
  paypalRequest(config, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    headers: {
      "PayPal-Request-Id": `capture-paypal-${orderId}`,
    },
  });

const verifyPayPalWebhook = async ({ config, headers, body }) => {
  if (!config.webhookId) {
    throw new ApiError("معرّف webhook الخاص بـ PayPal غير مهيأ", 500);
  }
  const payload = await paypalRequest(
    config,
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        transmission_id: headers["paypal-transmission-id"],
        transmission_time: headers["paypal-transmission-time"],
        cert_url: headers["paypal-cert-url"],
        auth_algo: headers["paypal-auth-algo"],
        transmission_sig: headers["paypal-transmission-sig"],
        webhook_id: config.webhookId,
        webhook_event: body,
      }),
    },
  );
  return payload?.verification_status === "SUCCESS";
};

const validatePayPalCapture = (capture, attempt) => {
  if (
    !capture ||
    capture.status !== "COMPLETED" ||
    !Array.isArray(capture.purchase_units)
  ) {
    throw new ApiError("لم تؤكد PayPal اكتمال الدفع", 400);
  }

  const purchase = capture.purchase_units.find(
    (unit) =>
      unit.reference_id === attempt._id.toString() ||
      unit.custom_id === attempt._id.toString(),
  );
  const captureDetails = purchase?.payments?.captures?.find(
    (item) => item.status === "COMPLETED",
  );
  const paidAmount = captureDetails?.amount || purchase?.amount;
  if (
    !purchase ||
    !captureDetails ||
    paidAmount?.currency_code !== attempt.currency.toUpperCase() ||
    Math.round(Number(paidAmount?.value) * 100) !==
      attempt.totalAmountMinor
  ) {
    throw new ApiError("مبلغ أو مرجع دفع PayPal لا تطابق محاولة الدفع", 400);
  }

  return captureDetails.id;
};

const validatePayPalWebhookCapture = (resource, attempt) => {
  if (resource?.status !== "COMPLETED") {
    throw new ApiError("لم تؤكد PayPal اكتمال الدفع", 400);
  }
  if (
    resource.amount?.currency_code !== attempt.currency.toUpperCase() ||
    Math.round(Number(resource.amount.value) * 100) !==
      attempt.totalAmountMinor ||
    (resource.custom_id &&
      resource.custom_id !== attempt._id.toString())
  ) {
    throw new ApiError("مبلغ أو مرجع دفع PayPal لا تطابق محاولة الدفع", 400);
  }
  return resource.id;
};

module.exports = {
  buildPayPalOrderPayload,
  createPayPalOrder,
  capturePayPalOrder,
  validatePayPalCapture,
  validatePayPalWebhookCapture,
  verifyPayPalWebhook,
};
