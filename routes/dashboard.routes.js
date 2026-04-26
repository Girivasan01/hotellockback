const express = require("express");
const router = express.Router();
const dashboard = require("../controllers/dashboard.controller");

// KPI summary
router.get("/summary", dashboard.getSummary);

// Charts
router.get("/bookings-trend", dashboard.getBookingTrend);
router.get("/revenue-by-category", dashboard.getRevenueByCategory);
router.get("/top-menu-items", dashboard.getTopMenuItems);
router.get("/kitchen-status", dashboard.getKitchenStatus);
router.get("/occupancy-rate", dashboard.getOccupancyRate);

module.exports = router;
