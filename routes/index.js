const express = require("express");
const router = express.Router();
const roomsRoutes = require("./roomsRoutes");
const invoiceRoutes = require("./invoice");

router.use("/rooms", roomsRoutes);
router.use("/invoice", invoiceRoutes);

module.exports = router;
