const express = require("express");
const router = express.Router();
const roomsController = require("../controllers/roomsController");

router.get("/active", roomsController.getActiveRooms);
router.get("/categories", roomsController.getRoomCategories);
router.post("/categories", roomsController.createRoomCategory);
router.put("/categories/:id", roomsController.updateRoomCategory);
router.delete("/categories/:id", roomsController.deleteRoomCategory);

router.get("/", roomsController.getAllRooms);
router.get("/:id", roomsController.getRoomById);
router.post("/", roomsController.createRoom);
router.put("/:id", roomsController.updateRoom);
router.delete("/:id", roomsController.deleteRoom);
// GET active rooms with guest info

module.exports = router;
