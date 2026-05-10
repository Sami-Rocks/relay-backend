// Modules
const multer = require("multer")

// Variables
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"]

// Storage
const storage = multer.memoryStorage()

// Middleware: Upload Image
const uploadImage = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024
	},
	fileFilter: (req, file, cb) => {
		if (!allowedImageTypes.includes(file.mimetype)) {
			return cb(new Error("Only JPEG, PNG, and WEBP images are allowed"))
		}

		cb(null, true)
	}
})

// Export
module.exports = {
	uploadImage
}
