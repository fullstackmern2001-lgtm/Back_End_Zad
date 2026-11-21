const mongoose = require("mongoose");

const Category = require("../models/categoryModel");
const Service = require("../models/serviceModel");
const User = require("../models/userModels");
const Review = require("../models/reviewModel");
const Order = require("../models/orderModel");
const News = require("../models/newsModel");
const Slider = require("../models/sliderModel");

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const testPassword = "ZadalDemo2026!";

const image = (seed) => `https://picsum.photos/seed/${seed}/1200/800`;
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const categoriesData = [
  { name: "تجريبي - حفر الآبار", image: image("zadal-wells") },
  { name: "تجريبي - الأضاحي", image: image("zadal-sacrifice") },
  { name: "تجريبي - سقيا الماء", image: image("zadal-water") },
  { name: "تجريبي - كفالة الأيتام", image: image("zadal-orphans") },
];

const servicesData = [
  {
    name: "تجريبي - حفر بئر ارتوازي",
    description: "مساهمة تجريبية لحفر بئر يوفر مصدر مياه مستدامًا للمجتمع.",
    price: 250,
    minQuantity: 1,
    categoryName: "تجريبي - حفر الآبار",
    image: image("zadal-well-service"),
  },
  {
    name: "تجريبي - صيانة بئر مياه",
    description: "مساهمة تجريبية لصيانة بئر وتحسين وصول الأهالي إلى المياه.",
    price: 75,
    minQuantity: 1,
    categoryName: "تجريبي - حفر الآبار",
    image: image("zadal-well-maintenance"),
  },
  {
    name: "تجريبي - أضحية العيد",
    description: "مساهمة تجريبية في مشروع الأضاحي وتوزيعها على الأسر المحتاجة.",
    price: 180,
    minQuantity: 1,
    categoryName: "تجريبي - الأضاحي",
    image: image("zadal-sacrifice-service"),
  },
  {
    name: "تجريبي - سقيا أسرة",
    description: "مساهمة تجريبية لتوفير مياه الشرب النظيفة للأسر.",
    price: 15,
    minQuantity: 5,
    categoryName: "تجريبي - سقيا الماء",
    image: image("zadal-water-service"),
  },
  {
    name: "تجريبي - دعم طالب يتيم",
    description: "مساهمة تجريبية لدعم تعليم طالب وتوفير احتياجاته المدرسية.",
    price: 30,
    minQuantity: 1,
    categoryName: "تجريبي - كفالة الأيتام",
    image: image("zadal-orphan-service"),
  },
];

const usersData = [
  {
    firstName: "ليان",
    lastName: "أحمد",
    email: "lian.demo@example.com",
    avatar: image("zadal-user-lian"),
  },
  {
    firstName: "عمر",
    lastName: "خالد",
    email: "omar.demo@example.com",
    avatar: image("zadal-user-omar"),
  },
  {
    firstName: "سارة",
    lastName: "محمود",
    email: "sara.demo@example.com",
    avatar: image("zadal-user-sara"),
  },
];

const reviewsData = [
  {
    email: "lian.demo@example.com",
    serviceName: "تجريبي - حفر بئر ارتوازي",
    rating: 5,
    title: "مبادرة رائعة وأثرها واضح في توفير المياه للمنطقة.",
  },
  {
    email: "omar.demo@example.com",
    serviceName: "تجريبي - أضحية العيد",
    rating: 5,
    title: "مشروع منظم ويساعد على إيصال الخير للأسر المحتاجة.",
  },
  {
    email: "sara.demo@example.com",
    serviceName: "تجريبي - سقيا أسرة",
    rating: 4,
    title: "خدمة مهمة، ونسأل الله أن يبارك بجهود القائمين عليها.",
  },
  {
    email: "lian.demo@example.com",
    serviceName: "تجريبي - دعم طالب يتيم",
    rating: 5,
    title: "التعليم باب أمل، بارك الله بكل من يساهم في هذا المشروع.",
  },
];

const newsData = [
  {
    title: "تجريبي - إطلاق مبادرة آبار الخير",
    description:
      "خبر تجريبي عن إطلاق مبادرة لحفر آبار مياه تخدم القرى والمجتمعات التي تعاني من شح المياه.",
    image: image("zadal-news-wells"),
    publishedAt: daysAgo(3),
  },
  {
    title: "تجريبي - حملة الأضاحي لهذا العام",
    description:
      "خبر تجريبي يوضح استعداد الفريق لتنظيم حملة الأضاحي وإيصالها إلى الأسر المستحقة.",
    image: image("zadal-news-sacrifice"),
    publishedAt: daysAgo(7),
  },
  {
    title: "تجريبي - استمرار مشاريع سقيا الماء",
    description:
      "خبر تجريبي عن استمرار مشاريع توفير مياه الشرب النظيفة ودعم المجتمعات المحلية.",
    image: image("zadal-news-water"),
    publishedAt: daysAgo(14),
  },
];

const slidersData = [
  {
    name: "تجريبي - آبار الخير",
    des: "ساهم معنا في توفير مصدر مياه مستدام للمجتمعات المحتاجة.",
    image: image("zadal-slider-wells"),
  },
  {
    name: "تجريبي - سقيا وأضاحي",
    des: "معًا نوصل الماء والخير إلى الأسر في مختلف المناطق.",
    image: image("zadal-slider-water"),
  },
];

const ensureDocument = async (Model, filter, data) => {
  const document = await Model.findOneAndUpdate(
    filter,
    { $setOnInsert: data },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return document;
};

const ensureUser = async (data) => {
  let user = await User.findOne({ email: data.email });
  if (!user) {
    user = await User.create({
      ...data,
      password: testPassword,
      role: "user",
      isActive: true,
    });
  }
  return user;
};

const createDummyData = async () => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dummy data cannot be seeded in production.");
  }

  const databaseUrl =
    process.env.DUMMY_DB_URL ||
    "mongodb://127.0.0.1:27017/zadalkhair_dummy";
  const parsedDatabaseUrl = new URL(databaseUrl);
  if (
    parsedDatabaseUrl.protocol !== "mongodb:" ||
    !localHosts.has(parsedDatabaseUrl.hostname.toLowerCase())
  ) {
    throw new Error(
      "Dummy data is restricted to localhost MongoDB. Check DUMMY_DB_URL before retrying.",
    );
  }

  await mongoose.connect(databaseUrl, {
    serverSelectionTimeoutMS: 10000,
  });
  if (!localHosts.has(mongoose.connection.host.toLowerCase())) {
    throw new Error("Connected database is not local; refusing to seed.");
  }

  const categoriesByName = new Map();
  for (const data of categoriesData) {
    const category = await ensureDocument(Category, { name: data.name }, data);
    categoriesByName.set(category.name, category);
  }

  const servicesByName = new Map();
  for (const data of servicesData) {
    const { categoryName, ...serviceData } = data;
    const category = categoriesByName.get(categoryName);
    const service = await ensureDocument(
      Service,
      { name: serviceData.name },
      { ...serviceData, category: category._id },
    );
    servicesByName.set(service.name, service);
  }

  const usersByEmail = new Map();
  for (const data of usersData) {
    const user = await ensureUser(data);
    usersByEmail.set(user.email, user);
  }

  for (const data of reviewsData) {
    const user = usersByEmail.get(data.email);
    const service = servicesByName.get(data.serviceName);
    await ensureDocument(
      Review,
      { user: user._id, service: service._id },
      {
        user: user._id,
        service: service._id,
        rating: data.rating,
        title: data.title,
      },
    );
  }

  for (const data of newsData) {
    await ensureDocument(News, { title: data.title }, data);
  }

  for (const data of slidersData) {
    await ensureDocument(Slider, { name: data.name }, data);
  }

  const orderData = [
    { email: "lian.demo@example.com", serviceName: "تجريبي - حفر بئر ارتوازي", quantity: 1 },
    { email: "omar.demo@example.com", serviceName: "تجريبي - أضحية العيد", quantity: 1 },
    { email: "sara.demo@example.com", serviceName: "تجريبي - سقيا أسرة", quantity: 5 },
  ];

  for (let index = 0; index < orderData.length; index += 1) {
    const data = orderData[index];
    const user = usersByEmail.get(data.email);
    const service = servicesByName.get(data.serviceName);
    const itemTotal = service.price * data.quantity;
    await ensureDocument(
      Order,
      { _id: new mongoose.Types.ObjectId(`66f00000000000000000000${index + 1}`) },
      {
        user: user._id,
        cartItems: [
          {
            service: service._id,
            serviceName: service.name,
            serviceImage: service.image,
            price: service.price,
            minQuantity: service.minQuantity,
            quantity: data.quantity,
            totalItemPrice: itemTotal,
          },
        ],
        totalOrderPrice: itemTotal,
        paymentMethodType: "card",
        isPaid: false,
        isDelivered: false,
        status: "pending",
      },
    );
  }

  console.log(`Dummy data seeded into local database "${mongoose.connection.name}".`);
  console.log(
    JSON.stringify({
      categories: categoriesData.length,
      services: servicesData.length,
      users: usersData.length,
      reviews: reviewsData.length,
      news: newsData.length,
      sliders: slidersData.length,
      orders: orderData.length,
    }),
  );
  console.log(`Demo user password for all seeded accounts: ${testPassword}`);
};

createDummyData()
  .catch((error) => {
    console.error("Dummy data seeding failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
