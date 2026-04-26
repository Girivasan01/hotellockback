const express = require("express");
const router = express.Router();
const addonsController = require("../controllers/addonsController");

router.get("/", addonsController.getAddOns);
router.post("/", addonsController.createAddOn);
router.put("/:id", addonsController.updateAddOn);
router.delete("/:id", addonsController.deleteAddOn);

module.exports = router;
