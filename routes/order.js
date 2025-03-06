// Modules
const express = require("express")
const router = express.Router()

// Controllers
const orderController = require("../controllers/order")

// Middleware
const auth = require("../middleware/auth")

// Protected Routes
router.use(auth)
router.post("/", orderController.createOrder)
router.get("/user", orderController.getUserOrders)
router.get("/shop/:shopId", orderController.getShopOrders)
router.get("/:id", orderController.getOrder)
router.put("/:id", orderController.updateOrder)
router.delete("/:id", orderController.deleteOrder)

// Export
module.exports = router
