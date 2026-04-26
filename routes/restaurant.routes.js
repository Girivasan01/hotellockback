const express = require("express");
const router = express.Router();
const restaurantController = require("../controllers/restaurant.controller");

// Get all restaurant orders (with optional table_number filter)
// GET /api/restaurant/orders?table_number=5
router.get("/orders", restaurantController.getRestaurantOrders);

// Create a new restaurant order
// POST /api/restaurant/orders
// Body: { table_number, item_id, quantity }
router.post("/orders", restaurantController.createRestaurantOrder);

// Update order status
// PUT /api/restaurant/orders/:id
// Body: { status: "Pending" | "Preparing" | "Served" | "Settled" }
router.put("/orders/:id", restaurantController.updateRestaurantOrderStatus);

// Delete an order (only if not served/settled)
// DELETE /api/restaurant/orders/:id
router.delete(
  "/orders/table/:table_number", restaurantController.deleteRestaurantOrdersByTable
);

router.delete("/orders/:id", restaurantController.deleteRestaurantOrder);


// Generate bill for a table (marks all served orders as settled)
// POST /api/restaurant/generate-bill
// Body: { table_number }
router.post("/generate-bill", restaurantController.generateRestaurantBill);

// Get orders grouped by table (for billing overview)
// GET /api/restaurant/orders-by-table
router.get("/orders-by-table", restaurantController.getOrdersByTable);

module.exports = router;