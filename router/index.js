const express = require("express");

const AuthRouter = require("./authRouter");
const UserRouter = require("./userRouter");
const wishlistRoutes = require("./wishlistRouter");
const reviewRoutes = require("./reviewRouter");
const cartRoutes = require("./cartRoutes");
const sliderRoutes = require("./sliderRouter");
const orderRoutes = require("./orderRouter");
const serviceRoutes = require("./serviceRouter");
const categoryRoutes = require("./categoryRouter");
const newsRoutes = require("./newsRouter");
const proofRoutes = require("./proofRouter");
const contactRoutes = require("./contactRouter");
const router = express.Router();

router.use("/auth", AuthRouter);
router.use("/user", UserRouter);
router.use("/wishlist", wishlistRoutes);
router.use("/review", reviewRoutes);
router.use("/cart", cartRoutes);
router.use("/slider", sliderRoutes);
router.use("/order", orderRoutes);
router.use("/service", serviceRoutes);
router.use("/category", categoryRoutes);
router.use("/news", newsRoutes);
router.use("/proofs", proofRoutes);
router.use("/contact", contactRoutes);

module.exports = router;
