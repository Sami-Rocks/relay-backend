// Modules
const express = require("express")
const router = express.Router()

// Controllers
const productController = require("../controllers/product")

// Middleware
const auth = require("../middleware/auth")
const { uploadImage } = require("../middleware/upload")

// Public Routes
router.get("/", productController.getProducts)
router.get("/:id", productController.getProduct)

// Protected Routes
router.post("/", auth, productController.createProduct)
router.post("/:id/image", auth, uploadImage.single("image"), productController.uploadProductImage)
router.put("/:id", auth, productController.updateProduct)
router.delete("/:id/image", auth, productController.deleteProductImage)
router.delete("/:id", auth, productController.deleteProduct)

// Export
module.exports = router
