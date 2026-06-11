// Modules
const express = require("express")
const router = express.Router()

// Controllers
const formController = require("../controllers/form")
const submissionController = require("../controllers/submission")

// Middleware
const auth = require("../middleware/auth")
const optionalAuth = require("../middleware/optional-auth")
const { uploadImage } = require("../middleware/upload")

// Public Routes
router.get("/public", formController.getPublicForms)
router.get("/public/:id", formController.getPublicForm)
router.post("/:formId/submissions", optionalAuth, submissionController.submitForm)

// Protected Routes
router.get("/", auth, formController.getForms)
router.post("/:id/cover", auth, uploadImage.single("image"), formController.uploadFormCover)
router.delete("/:id/cover", auth, formController.deleteFormCover)
router.get("/:id", auth, formController.getForm)
router.get("/:formId/submissions", auth, submissionController.getFormSubmissions)
router.post("/", auth, formController.createForm)
router.put("/:id", auth, formController.updateForm)
router.delete("/:id", auth, formController.deleteForm)

// Export
module.exports = router
