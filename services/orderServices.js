const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.SECRER_KEY);

const ApiError = require("../utils/ApiError");
const ApiFeatures = require("../utils/ApiFeatures");
const Order = require("../models/orderModel");
const Cart = require("../models/cartModel");
const CheckoutAttempt = require("../models/checkoutAttemptModel");
const calcTotalCartPrice = require("../utils/calcTotalCartPrice");
const {
  toMinorUnits,
  toMajorUnits,
  buildStripeLineItems,
  validateCheckoutSession,
} = require("../utils/stripeCheckout");

const orderListQueryOptions = {
  filterFields: {
    user: { type: "objectId" },
    status: { type: "enum", values: ["pending", "paid", "failed"] },
    paymentMethodType: { type: "enum", values: ["card"] },
    isPaid: { type: "boolean" },
    isDelivered: { type: "boolean" },
    totalOrderPrice: {
      type: "number",
      min: 0,
      operators: ["gt", "gte", "lt", "lte"],
    },
    createdAt: {
      type: "date",
      operators: ["gt", "gte", "lt", "lte"],
    },
  },
  searchFields: [],
  sortFields: [
    "createdAt",
    "totalOrderPrice",
    "paidAt",
    "deliveredAt",
    "status",
  ],
  selectFields: [
    "user",
    "cartItems",
    "totalOrderPrice",
    "paymentMethodType",
    "isPaid",
    "paidAt",
    "isDelivered",
    "deliveredAt",
    "status",
    "createdAt",
    "updatedAt",
  ],
  defaultLimit: 50,
  maxLimit: 50,
  maxPage: 10000,
};

exports.filterOrderForLoggedUser = asyncHandler(async (req, res, next) => {
  if (req.user.role === "user") req.filterObj = { user: req.user._id };
  next();
});

exports.getAllOrder = asyncHandler(async (req, res) => {
  const filter = req.filterObj || {};
  const queryString = { ...req.query };

  if (req.user.role !== "admin") {
    delete queryString.user;
  }

  const apiFeatures = new ApiFeatures(
    Order.find(filter),
    queryString,
    orderListQueryOptions,
  );
  apiFeatures.validateQueryParams();

  const documentsCount = await Order.countDocuments(filter);
  apiFeatures
    .paginate(documentsCount)
    .filter()
    .search()
    .limitFields()
    .sort();

  const { mongooseQuery, paginationResult } = apiFeatures;
  const documents = await mongooseQuery;

  res.status(200).json({
    results: documents.length,
    paginationResult,
    data: documents,
  });
});
exports.getOrder = asyncHandler(async (req, res, next) => {
  const filter = { _id: req.params.id };
  if (req.user.role !== "admin") filter.user = req.user._id;

  const order = await Order.findOne(filter);
  if (!order) {
    return next(new ApiError("الطلب المطلوب غير موجود", 404));
  }

  res.status(200).json({ data: order });
});

exports.updateOrderDelivered = asyncHandler(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(
      new ApiError("الطلب المطلوب غير موجود", 404),
    );
  }

  order.isDelivered = true;
  order.deliveredAt = Date.now();

  const updateOrder = await order.save();
  res.status(200).json({ status: "success", data: updateOrder });
});

const getClientBaseUrl = () => {
  const clientUrl =
    process.env.CLIENT_URL ||
    (process.env.NODE_ENV === "production" ? null : "http://localhost:5173");
  if (!clientUrl) {
    throw new ApiError("عنوان الواجهة غير مهيأ لإكمال عملية الدفع", 500);
  }

  let parsedClientUrl;
  try {
    parsedClientUrl = new URL(clientUrl);
  } catch {
    throw new ApiError("عنوان الواجهة غير صالح لإكمال عملية الدفع", 500);
  }
  if (!["http:", "https:"].includes(parsedClientUrl.protocol)) {
    throw new ApiError("عنوان الواجهة غير صالح لإكمال عملية الدفع", 500);
  }

  return clientUrl.replace(/\/+$/, "");
};

const getSnapshotItems = (cart) => {
  let priceChanged = false;
  let subtotalAmountMinor = 0;
  const cartItems = cart.cartItems.map((item) => {
    const service = item.service;
    const quantity = Number(item.quantity);
    const minQuantity = Number(service?.minQuantity);
    if (
      !service?._id ||
      !Number.isSafeInteger(quantity) ||
      !Number.isInteger(minQuantity) ||
      minQuantity < 1 ||
      quantity < minQuantity
    ) {
      throw new ApiError("توجد خدمة أو كمية غير صالحة في السلة", 409);
    }

    const unitAmountMinor = toMinorUnits(service.price);
    const cartUnitAmountMinor = toMinorUnits(item.price);
    if (unitAmountMinor !== cartUnitAmountMinor) {
      item.price = Number(service.price);
      priceChanged = true;
    }

    const totalItemAmountMinor = unitAmountMinor * quantity;
    if (!Number.isSafeInteger(totalItemAmountMinor)) {
      throw new ApiError("قيمة أحد عناصر السلة خارج النطاق المسموح", 400);
    }
    subtotalAmountMinor += totalItemAmountMinor;
    if (!Number.isSafeInteger(subtotalAmountMinor)) {
      throw new ApiError("إجمالي السلة خارج النطاق المسموح", 400);
    }

    return {
      service: service._id,
      serviceName: service.name,
      serviceImage: service.image || "",
      price: toMajorUnits(unitAmountMinor),
      unitAmountMinor,
      minQuantity,
      quantity,
      totalItemPrice: toMajorUnits(totalItemAmountMinor),
      totalItemAmountMinor,
    };
  });

  return { cartItems, priceChanged, subtotalAmountMinor };
};

const getAttemptForCheckout = async (attempt, req) => {
  if (attempt.cartId.toString() !== req.params.cartId) {
    throw new ApiError("مفتاح الدفع مستخدم لمحاولة أخرى", 409);
  }
  if (attempt.status === "open" && attempt.checkoutUrl) {
    if (attempt.expiresAt && attempt.expiresAt <= new Date()) {
      const currentSession = await stripe.checkout.sessions.retrieve(
        attempt.stripeSessionId,
      );
      validateCheckoutSession(currentSession, attempt);

      if (
        currentSession.status === "complete" &&
        currentSession.payment_status === "paid"
      ) {
        await createPaidOrder(currentSession);
        return {
          id: currentSession.id,
          url: `${getClientBaseUrl()}/dashpord/orders`,
        };
      }

      if (currentSession.status === "expired") {
        await markAttemptTerminal(currentSession, null, "expired");
        throw new ApiError("انتهت صلاحية جلسة الدفع؛ أعد المحاولة", 409);
      }

      throw new ApiError(
        "جلسة الدفع قيد المعالجة؛ انتظر تأكيد Stripe قبل إعادة المحاولة",
        409,
      );
    }

    return {
      id: attempt.stripeSessionId,
      url: attempt.checkoutUrl,
    };
  }
  if (attempt.status !== "creating_session") {
    throw new ApiError("محاولة الدفع هذه لم تعد نشطة", 409);
  }

  const clientBaseUrl = getClientBaseUrl();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: buildStripeLineItems(attempt.cartItems, attempt.currency),
      success_url: `${clientBaseUrl}/dashpord/orders`,
      cancel_url: `${clientBaseUrl}/cart`,
      customer_email: req.user.email,
      client_reference_id: attempt._id.toString(),
      metadata: {
        checkoutAttemptId: attempt._id.toString(),
      },
      expires_at: expiresAt,
    },
    { idempotencyKey: `checkout-attempt-${attempt._id}` },
  );
  validateCheckoutSession(session, attempt);
  if (!session.url) {
    throw new ApiError("لم يُرجع Stripe رابط إتمام الدفع", 502);
  }

  const allowedSessionIds = [
    { stripeSessionId: { $exists: false } },
    { stripeSessionId: null },
    { stripeSessionId: session.id },
  ];
  const linkedAttempt = await CheckoutAttempt.findOneAndUpdate(
    { _id: attempt._id, $or: allowedSessionIds },
    {
      $set: {
        stripeSessionId: session.id,
        checkoutUrl: session.url,
        expiresAt: new Date(session.expires_at * 1000),
      },
    },
    { new: true, runValidators: true },
  );
  if (!linkedAttempt) {
    throw new ApiError("تعذر ربط جلسة Stripe بمحاولة الدفع", 409);
  }

  await CheckoutAttempt.updateOne(
    { _id: attempt._id, status: "creating_session" },
    { $set: { status: "open", isActive: true } },
  );

  const latestAttempt = await CheckoutAttempt.findById(attempt._id);
  if (latestAttempt?.stripeSessionId !== session.id) {
    throw new ApiError("جلسة Stripe لا تطابق محاولة الدفع", 409);
  }

  return { id: session.id, url: session.url };
};

exports.checkoutSession = asyncHandler(async (req, res) => {
  let idempotencyKey = req.get("Idempotency-Key");
  if (!idempotencyKey && req.method === "GET") {
    const cart = await Cart.findOne({
      _id: req.params.cartId,
      user: req.user._id,
    }).select("revision");
    if (!cart) {
      throw new ApiError("السلة المطلوبة غير موجودة", 404);
    }

    const activeAttempt = await CheckoutAttempt.findOne({
      user: req.user._id,
      cartId: cart._id,
      cartRevision: cart.revision || 0,
      isActive: true,
    });
    idempotencyKey =
      activeAttempt?.idempotencyKey || crypto.randomUUID();
  }

  if (
    typeof idempotencyKey !== "string" ||
    !/^[A-Za-z0-9._:-]{1,128}$/.test(idempotencyKey)
  ) {
    throw new ApiError("مفتاح محاولة الدفع غير صالح", 400);
  }
  if (!mongoose.isValidObjectId(req.params.cartId)) {
    throw new ApiError("معرف السلة غير صالح", 400);
  }

  let attempt = await CheckoutAttempt.findOne({
    user: req.user._id,
    idempotencyKey,
  });
  if (attempt) {
    const session = await getAttemptForCheckout(attempt, req);
    return res.status(200).json({ status: "success", session });
  }

  const cart = await Cart.findOne({
    _id: req.params.cartId,
    user: req.user._id,
  }).populate({
    path: "cartItems.service",
    select: "name image price minQuantity",
  });
  if (!cart) {
    throw new ApiError("السلة المطلوبة غير موجودة", 404);
  }
  if (cart.cartItems.length === 0) {
    throw new ApiError("السلة فارغة", 400);
  }

  const { cartItems, priceChanged, subtotalAmountMinor } =
    getSnapshotItems(cart);
  const cartTotalAmountMinor = Math.round(Number(cart.totalCartPrice) * 100);
  if (
    priceChanged ||
    !Number.isSafeInteger(cartTotalAmountMinor) ||
    cartTotalAmountMinor !== subtotalAmountMinor
  ) {
    cart.revision = (cart.revision || 0) + 1;
    cart.totalCartPrice = toMajorUnits(subtotalAmountMinor);
    await cart.save();
    throw new ApiError(
      "تغيرت أسعار السلة أو إجماليها؛ تم تحديثها، راجع الإجمالي ثم أعد المحاولة",
      409,
    );
  }
  if (subtotalAmountMinor <= 0) {
    throw new ApiError("يجب أن يكون إجمالي الدفع أكبر من صفر", 400);
  }

  const attemptData = {
    user: req.user._id,
    cartId: cart._id,
    cartRevision: cart.revision || 0,
    idempotencyKey,
    cartItems,
    currency: "usd",
    subtotalAmountMinor,
    discountAmountMinor: 0,
    taxAmountMinor: 0,
    shippingAmountMinor: 0,
    totalAmountMinor: subtotalAmountMinor,
    status: "creating_session",
    isActive: true,
  };

  try {
    attempt = await CheckoutAttempt.create(attemptData);
  } catch (error) {
    if (error.code !== 11000) throw error;

    attempt =
      (await CheckoutAttempt.findOne({
        user: req.user._id,
        idempotencyKey,
      })) ||
      (await CheckoutAttempt.findOne({
        user: req.user._id,
        cartId: cart._id,
        cartRevision: cart.revision || 0,
        isActive: true,
      }));
    if (!attempt) throw error;
  }

  const session = await getAttemptForCheckout(attempt, req);
  res.status(200).json({ status: "success", session });
});

const findAttemptForSession = async (session) => {
  const attemptId = session.metadata?.checkoutAttemptId;
  if (
    !mongoose.isValidObjectId(attemptId) ||
    session.client_reference_id !== attemptId
  ) {
    throw new ApiError("جلسة Stripe لا تحتوي مرجع محاولة صالحًا", 400);
  }

  const attempt = await CheckoutAttempt.findById(attemptId);
  if (!attempt) {
    throw new ApiError("محاولة الدفع المرتبطة بالجلسة غير موجودة", 404);
  }
  validateCheckoutSession(session, attempt);

  if (attempt.stripeSessionId && attempt.stripeSessionId !== session.id) {
    throw new ApiError("جلسة Stripe لا تطابق محاولة الدفع", 400);
  }

  if (!attempt.stripeSessionId) {
    const linkedAttempt = await CheckoutAttempt.findOneAndUpdate(
      {
        _id: attempt._id,
        $or: [
          { stripeSessionId: { $exists: false } },
          { stripeSessionId: null },
          { stripeSessionId: session.id },
        ],
      },
      {
        $set: {
          stripeSessionId: session.id,
          ...(session.url ? { checkoutUrl: session.url } : {}),
          ...(session.expires_at
            ? { expiresAt: new Date(session.expires_at * 1000) }
            : {}),
        },
      },
      { new: true, runValidators: true },
    );
    if (!linkedAttempt) {
      throw new ApiError("تعذر ربط جلسة Stripe بمحاولة الدفع", 409);
    }
    return linkedAttempt;
  }

  return attempt;
};

const clearCartIfUnchanged = async (attempt) => {
  await Cart.deleteOne({
    _id: attempt.cartId,
    user: attempt.user,
    revision: attempt.cartRevision,
  });
};

const createPaidOrder = async (session, eventId) => {
  if (session.payment_status !== "paid") {
    throw new ApiError("Stripe لم يؤكد اكتمال الدفع", 400);
  }
  const attempt = await findAttemptForSession(session);
  const dbSession = await mongoose.startSession();

  try {
    await dbSession.withTransaction(async () => {
      const existingOrder = await Order.findOne({
        checkoutAttempt: attempt._id,
      })
        .select("_id")
        .session(dbSession)
        .lean();
      if (existingOrder) {
        const update = {
          $set: {
            status: "paid",
            isActive: false,
            order: existingOrder._id,
            paidAt: attempt.paidAt || new Date(),
          },
        };
        if (eventId) update.$addToSet = { processedEventIds: eventId };
        await CheckoutAttempt.updateOne(
          { _id: attempt._id },
          update,
          { session: dbSession },
        );
        return;
      }

      const currentAttempt = await CheckoutAttempt.findById(attempt._id)
        .session(dbSession);
      if (!currentAttempt) {
        throw new ApiError("محاولة الدفع المرتبطة بالجلسة غير موجودة", 404);
      }
      validateCheckoutSession(session, currentAttempt);

      const [order] = await Order.create(
        [
          {
            stripeSessionId: session.id,
            checkoutAttempt: currentAttempt._id,
            user: currentAttempt.user,
            cartItems: currentAttempt.cartItems.map((item) => ({
              service: item.service,
              serviceName: item.serviceName,
              serviceImage: item.serviceImage,
              price: item.price,
              minQuantity: item.minQuantity,
              quantity: item.quantity,
              totalItemPrice: item.totalItemPrice,
            })),
            totalOrderPrice: toMajorUnits(currentAttempt.totalAmountMinor),
            totalAmountMinor: currentAttempt.totalAmountMinor,
            currency: currentAttempt.currency,
            isPaid: true,
            paidAt: new Date(),
            paymentMethodType: "card",
            status: "paid",
          },
        ],
        { session: dbSession },
      );

      currentAttempt.status = "paid";
      currentAttempt.isActive = false;
      currentAttempt.order = order._id;
      currentAttempt.paidAt = new Date();
      if (eventId) currentAttempt.processedEventIds.addToSet(eventId);
      await currentAttempt.save({ session: dbSession });
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existingOrder = await Order.findOne({
      checkoutAttempt: attempt._id,
    })
      .select("_id")
      .lean();
    if (!existingOrder) throw error;
  } finally {
    await dbSession.endSession();
  }

  await clearCartIfUnchanged(attempt);
};

const markAttemptTerminal = async (session, eventId, status) => {
  const attempt = await findAttemptForSession(session);
  const update = { $set: { status, isActive: false } };
  if (eventId) update.$addToSet = { processedEventIds: eventId };
  await CheckoutAttempt.updateOne(
    { _id: attempt._id, status: { $ne: "paid" } },
    update,
  );
};

exports.webhookCheckout = asyncHandler(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const attempt = await findAttemptForSession(session);
    if (session.payment_status === "paid") {
      await createPaidOrder(session, event.id);
    } else if (event.id) {
      await CheckoutAttempt.updateOne(
        { _id: attempt._id, status: { $ne: "paid" } },
        { $addToSet: { processedEventIds: event.id } },
      );
    }
  } else if (event.type === "checkout.session.async_payment_succeeded") {
    await createPaidOrder(event.data.object, event.id);
  } else if (event.type === "checkout.session.async_payment_failed") {
    await markAttemptTerminal(event.data.object, event.id, "failed");
  } else if (event.type === "checkout.session.expired") {
    await markAttemptTerminal(event.data.object, event.id, "expired");
  }

  res.status(200).json({ received: true });
});
