const express = require("express");
const router = express.Router();
const kitchenController = require("../controllers/kitchenController");

// MENU ITEMS
router.get("/items", kitchenController.getMenuItems);
router.get("/items/:id", kitchenController.getMenuItemById);
router.post("/items", kitchenController.createMenuItem);
router.put("/items/:id", kitchenController.updateMenuItem);
router.delete("/items/:id", kitchenController.deleteMenuItem);

// CATEGORIES
router.get("/categories", kitchenController.getCategories);
router.post("/categories", kitchenController.createCategory);
router.delete("/categories/:id", kitchenController.deleteCategory);
// KITCHEN ORDERS
router.get("/orders", kitchenController.getKitchenOrders);
router.post("/orders", kitchenController.createKitchenOrder);
router.put("/orders/:id", kitchenController.updateKitchenOrderStatus);
router.post("/generate-bill", kitchenController.generateKitchenBill);
// Specific first
router.delete(
  "/orders/booking/:booking_id",
  kitchenController.deleteKitchenOrdersByBooking
);

// Generic after
router.delete(
  "/orders/:id",
  kitchenController.deleteKitchenOrder
);




module.exports = router;
