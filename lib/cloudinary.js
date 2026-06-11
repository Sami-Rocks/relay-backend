// Modules
const { v2: cloudinary } = require("cloudinary")

// Config
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
})

// Function: Check Config
function hasCloudinaryConfig () {
	return Boolean(
		process.env.CLOUDINARY_CLOUD_NAME
		&& process.env.CLOUDINARY_API_KEY
		&& process.env.CLOUDINARY_API_SECRET
	)
}

// Function: Upload Image
function uploadImage (file, folder) {
	if (!hasCloudinaryConfig()) {
		throw new Error("Cloudinary environment variables are missing")
	}

	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{
				folder,
				resource_type: "image"
			},
			(error, result) => {
				if (error) return reject(error)
				resolve(result)
			}
		)

		stream.end(file.buffer)
	})
}

// Function: Delete Image
async function deleteImage (publicId) {
	if (!publicId) return null
	return cloudinary.uploader.destroy(publicId)
}

// Export
module.exports = {
	deleteImage,
	uploadImage
}
