// Modules
const express = require("express")
const router = express.Router()

// Controllers
const userController = require("../controllers/user")

// Middleware
const auth = require("../middleware/auth")

// Public Routes
router.post("/register", userController.register)
router.post("/login", userController.login)

// Protected Routes
router.get("/profile", auth, userController.getProfile)
router.put("/profile", auth, userController.updateProfile)
router.delete("/account", auth, userController.deleteAccount)

// Export
module.exports = router
