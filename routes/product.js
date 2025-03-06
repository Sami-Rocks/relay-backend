// Modules
const express = require("express")
const router = express.Router()

// Controllers
const productController = require("../controllers/product")

// Middleware
const auth = require("../middleware/auth")

// Public Routes
router.get("/", productController.getProducts)
router.get("/:id", productController.getProduct)

// Protected Routes
router.post("/", auth, productController.createProduct)
router.put("/:id", auth, productController.updateProduct)
router.delete("/:id", auth, productController.deleteProduct)

// Export
module.exports = router
