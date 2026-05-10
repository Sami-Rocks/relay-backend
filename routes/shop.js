// Modules
const express = require("express")
const router = express.Router()

// Controllers
const shopController = require("../controllers/shop")

// Middleware
const auth = require("../middleware/auth")
const { uploadImage } = require("../middleware/upload")

// Routes with static paths must be registered before /:id
router.get("/user/shops", auth, shopController.getUserShops)
router.get("/", shopController.getShops)
router.get("/:id", shopController.getShop)

// Protected Routes
router.post("/", auth, shopController.createShop)
router.post("/:id/image", auth, uploadImage.single("image"), shopController.uploadShopImage)
router.put("/:id", auth, shopController.updateShop)
router.delete("/:id/image", auth, shopController.deleteShopImage)
router.delete("/:id", auth, shopController.deleteShop)

// Export
module.exports = router
