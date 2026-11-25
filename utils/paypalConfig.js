const ApiError = require("./ApiError");

const PAYPAL_API_URLS = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

const parsePublicUrl = (value, name, isProduction) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(`${name} must be a valid absolute URL`, 500);
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    (isProduction && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    throw new ApiError(`${name} must be a secure public URL`, 500);
  }

  return url;
};

const getPayPalConfig = (env = process.env) => {
  const isProduction = env.NODE_ENV === "production";
  const environment =
    env.PAYPAL_ENVIRONMENT || (isProduction ? "" : "sandbox");

  if (!Object.hasOwn(PAYPAL_API_URLS, environment)) {
    throw new ApiError(
      "PAYPAL_ENVIRONMENT must be set to sandbox or live",
      500,
    );
  }
  if (isProduction && environment !== "live") {
    throw new ApiError("Production PayPal environment must be live", 500);
  }

  const credentialPrefix =
    environment === "live" ? "PAYPAL_LIVE" : "PAYPAL_SANDBOX";
  const clientId = env[`${credentialPrefix}_CLIENT_ID`];
  const clientSecret = env[`${credentialPrefix}_CLIENT_SECRET`];
  const webhookId = env[`${credentialPrefix}_WEBHOOK_ID`];
  if (!clientId || !clientSecret) {
    throw new ApiError(
      `${credentialPrefix} client ID and client secret must be configured`,
      500,
    );
  }

  const clientUrl = parsePublicUrl(env.CLIENT_URL, "CLIENT_URL", isProduction);
  const webhookUrl = parsePublicUrl(
    env.PAYPAL_WEBHOOK_URL,
    "PAYPAL_WEBHOOK_URL",
    isProduction,
  );
  const requestTimeoutValue = env.PAYPAL_REQUEST_TIMEOUT_MS;
  let requestTimeoutMs = 10000;
  if (requestTimeoutValue !== undefined) {
    if (
      !/^[1-9]\d*$/.test(requestTimeoutValue) ||
      !Number.isSafeInteger(Number(requestTimeoutValue)) ||
      Number(requestTimeoutValue) > 120000
    ) {
      throw new ApiError(
        "PAYPAL_REQUEST_TIMEOUT_MS must be a positive integer no greater than 120000",
        500,
      );
    }
    requestTimeoutMs = Number(requestTimeoutValue);
  }
  const returnUrl = new URL("/checkout?paypal=return", clientUrl).toString();
  const cancelUrl = new URL("/checkout?paypal=cancel", clientUrl).toString();

  return {
    environment,
    apiBaseUrl: PAYPAL_API_URLS[environment],
    clientId,
    clientSecret,
    webhookId,
    currency: "USD",
    returnUrl,
    cancelUrl,
    webhookUrl: webhookUrl.toString(),
    requestTimeoutMs,
  };
};

module.exports = { getPayPalConfig };
