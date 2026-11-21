const path = require("path");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config({ path: path.resolve(__dirname, "..", "config.env") });

const normalizeService = (legacy) => {
  const description = [
    legacy.description,
    legacy.shortDescription,
    legacy.details,
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim())
    .filter((value, index, values) => values.indexOf(value) === index)
    .join("\n\n");
  const price = Number(
    legacy.unitPrice ??
      legacy.price ??
      legacy.discountedPrice ??
      legacy.originalPrice,
  );
  const minQuantity = Number(legacy.minQuantity ?? 1);

  if (
    !legacy._id ||
    typeof legacy.name !== "string" ||
    !legacy.name.trim() ||
    !description ||
    typeof legacy.image !== "string" ||
    !legacy.image.trim() ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(minQuantity) ||
    minQuantity < 1
  ) {
    return null;
  }

  return {
    _id: legacy._id,
    name: legacy.name.trim(),
    description,
    image: legacy.image,
    minQuantity,
    price,
    ...(legacy.createdAt ? { createdAt: legacy.createdAt } : {}),
    ...(legacy.updatedAt ? { updatedAt: legacy.updatedAt } : {}),
  };
};

const referenceId = (value) => value?._id || value;

const migrateCartItems = async (collection, apply) => {
  let updated = 0;
  const cursor = collection.find({ "cartItems.product": { $exists: true } });
  for await (const document of cursor) {
    const cartItems = document.cartItems.map((item) => {
      const service = referenceId(item.service || item.product);
      if (!service) {
        throw new Error(
          `Cart ${document._id} contains an item without a service reference.`,
        );
      }
      return {
        ...(item._id ? { _id: item._id } : {}),
        service,
        quantity: item.quantity,
        price: item.price,
      };
    });
    if (apply) {
      await collection.updateOne(
        { _id: document._id },
        { $set: { cartItems } },
      );
    }
    updated += 1;
  }
  return updated;
};

const migrateOrderItems = async (collection, servicesById, apply) => {
  let updated = 0;
  const cursor = collection.find({
    $or: [
      { "cartItems.product": { $exists: true } },
      { "cartItems.serviceId": { $exists: true } },
    ],
  });
  for await (const document of cursor) {
    const cartItems = document.cartItems.map((item) => {
      const serviceId = referenceId(
        item.service || item.product || item.serviceId,
      );
      if (!serviceId) {
        throw new Error(`Order ${document._id} contains an item without a service reference.`);
      }

      const legacyService = servicesById.get(serviceId.toString());
      const serviceName =
        item.serviceName || legacyService?.name || "خدمة محذوفة";
      const price = Number(item.price ?? item.unitPrice ?? legacyService?.price);
      const quantity = Number(item.quantity);
      const minQuantity = Number(
        item.minQuantity ?? legacyService?.minQuantity ?? 1,
      );
      if (
        !Number.isFinite(price) ||
        price < 0 ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        !Number.isInteger(minQuantity) ||
        minQuantity < 1
      ) {
        throw new Error(
          `Order ${document._id} contains invalid service price or quantity data.`,
        );
      }

      return {
        ...(item._id ? { _id: item._id } : {}),
        service: serviceId,
        serviceName,
        serviceImage: item.serviceImage || legacyService?.image || "",
        price,
        minQuantity,
        quantity,
        totalItemPrice: Number(item.totalItemPrice ?? price * quantity),
      };
    });
    if (apply) {
      const updates = { cartItems };
      if (!document.stripeSessionId) {
        updates.paymentMethodType = "legacy";
      }
      await collection.updateOne(
        { _id: document._id },
        { $set: updates },
      );
    }
    updated += 1;
  }
  return updated;
};

const migrateReviewReferences = async (collection, apply) => {
  const count = await collection.countDocuments({
    product: { $exists: true },
  });
  if (apply && count > 0) {
    const cursor = collection.find({ product: { $exists: true } });
    for await (const review of cursor) {
      await collection.updateOne(
        { _id: review._id },
        {
          $set: { service: review.service || review.product },
          $unset: { product: "" },
        },
      );
    }
  }
  return count;
};

const assertNoInvalidServices = (legacyServices) => {
  const invalidCount = legacyServices.filter(
    (service) => !normalizeService(service),
  ).length;
  if (invalidCount > 0) {
    throw new Error(
      `${invalidCount} legacy service document(s) are missing required service data; no migration was applied.`,
    );
  }
};

const migrate = async (database, apply) => {
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  const names = new Set(collections.map((collection) => collection.name));
  const sourceName = names.has("products")
    ? "products"
    : names.has("legacy_products")
      ? "legacy_products"
      : null;
  if (!sourceName) {
    throw new Error("Neither products nor legacy_products collection exists.");
  }

  const source = database.collection(sourceName);
  const legacyServices = await source.find({ type: "service" }).toArray();
  assertNoInvalidServices(legacyServices);
  const normalizedServices = legacyServices.map(normalizeService);
  const servicesById = new Map(
    normalizedServices.map((service) => [service._id.toString(), service]),
  );

  const target = database.collection("services");
  const servicesToInsert = [];
  for (const service of normalizedServices) {
    const existing = await target.findOne({ _id: service._id });
    if (existing) {
      const sameValues =
        existing.name === service.name &&
        existing.description === service.description &&
        existing.image === service.image &&
        Number(existing.price) === service.price &&
        Number(existing.minQuantity) === service.minQuantity;
      if (!sameValues) {
        throw new Error(
          `Service ${service._id} already exists with different values; migration stopped without overwriting it.`,
        );
      }
    } else {
      servicesToInsert.push(service);
    }
  }

  const [cartCount, orderCount, reviewCount] = await Promise.all([
    migrateCartItems(database.collection("carts"), false),
    migrateOrderItems(database.collection("orders"), servicesById, false),
    migrateReviewReferences(database.collection("reviews"), false),
  ]);
  if (apply) {
    let insertedServices = 0;
    for (const service of servicesToInsert) {
      await target.insertOne(service);
      insertedServices += 1;
    }

    if (names.has("reviews")) {
      const reviews = database.collection("reviews");
      const indexes = await reviews.listIndexes().toArray();
      if (indexes.some((index) => index.name === "user_1_product_1")) {
        await reviews.dropIndex("user_1_product_1");
      }
    }
    await migrateCartItems(database.collection("carts"), true);
    await migrateOrderItems(database.collection("orders"), servicesById, true);
    await migrateReviewReferences(database.collection("reviews"), true);

    if (names.has("reviews")) {
      await database.collection("reviews").createIndex(
        { user: 1, service: 1 },
        { unique: true, name: "user_1_service_1" },
      );
    }

    if (
      sourceName === "products" &&
      !names.has("legacy_products")
    ) {
      await source.rename("legacy_products");
    }
  }

  return {
    mode: apply ? "apply" : "dry-run",
    sourceCollection: sourceName,
    serviceDocuments: normalizedServices.length,
    servicesToInsert: servicesToInsert.length,
    cartsToUpdate: cartCount,
    ordersToUpdate: orderCount,
    reviewsToUpdate: reviewCount,
    archivedLegacyCollection:
      apply && sourceName === "products" && !names.has("legacy_products"),
  };
};

const main = async () => {
  if (!process.env.DB_URL) {
    throw new Error("DB_URL is not configured.");
  }

  const apply = process.argv.includes("--apply");
  const client = new MongoClient(process.env.DB_URL);
  await client.connect();
  try {
    const result = await migrate(client.db(), apply);
    console.log(JSON.stringify(result, null, 2));
    if (!apply) {
      console.log("Dry run only. Re-run with --apply after backing up the database.");
    }
  } finally {
    await client.close();
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`Service migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { migrate, normalizeService };
