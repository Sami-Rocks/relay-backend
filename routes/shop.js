// Modules
const express = require("express")
const router = express.Router()

// Controllers
const shopController = require("../controllers/shop")

// Middleware
const auth = require("../middleware/auth")

// Public Routes
router.get("/", shopController.getShops)
router.get("/:id", shopController.getShop)

// Protected Routes
router.get("/user/shops", auth, shopController.getUserShops)
router.post("/", auth, shopController.createShop)
router.put("/:id", auth, shopController.updateShop)
router.delete("/:id", auth, shopController.deleteShop)

// Export
module.exports = router 