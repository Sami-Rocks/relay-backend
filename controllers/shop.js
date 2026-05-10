// Modules
const { deleteImage, uploadImage } = require("../lib/cloudinary")
const prisma = require("../lib/prisma")
const { hasOwn, parseId } = require("../utils/request")

// Controller: Get Shops
async function getShops (req, res) {
	try {
		const shops = await prisma.shop.findMany({
			include: {
				products: true
			},
			orderBy: {
				createdAt: "desc"
			}
		})
		res.json(shops)
	} catch (error) {
		res.status(500).json({ message: "Error fetching shops", error: error.message })
	}
}

// Controller: Get Shop
async function getShop (req, res) {
	try {
		const { id } = req.params
		const shopId = parseId(id)

		if (!shopId) {
			return res.status(400).json({ message: "Invalid shop id" })
		}

		const shop = await prisma.shop.findUnique({
			where: { id: shopId },
			include: {
				products: true
			}
		})
		if (!shop) {
			return res.status(404).json({ message: "Shop not found" })
		}
		res.json(shop)
	} catch (error) {
		res.status(500).json({ message: "Error fetching shop", error: error.message })
	}
}

// Controller: Get User Shops
async function getUserShops (req, res) {
	try {
		const userId = req.user.userId
		const shops = await prisma.shop.findMany({
			where: { userId },
			include: {
				products: true
			},
			orderBy: {
				createdAt: "desc"
			}
		})
		res.json(shops)
	} catch (error) {
		res.status(500).json({ message: "Error fetching user shops", error: error.message })
	}
}

// Controller: Create Shop
async function createShop (req, res) {
	try {
		const { name, description } = req.body
		const userId = req.user.userId

		if (!name) {
			return res.status(400).json({ message: "Name is required" })
		}

		const shop = await prisma.shop.create({
			data: {
				name,
				description,
				userId
			},
			include: {
				products: true
			}
		})
		res.status(201).json(shop)
	} catch (error) {
		res.status(500).json({ message: "Error creating shop", error: error.message })
	}
}

// Controller: Update Shop
async function updateShop (req, res) {
	try {
		const { id } = req.params
		const { name, description } = req.body
		const userId = req.user.userId
		const shopId = parseId(id)

		if (!shopId) {
			return res.status(400).json({ message: "Invalid shop id" })
		}

		if (!hasOwn(req.body, "name") && !hasOwn(req.body, "description")) {
			return res.status(400).json({ message: "No shop changes provided" })
		}

		const shop = await prisma.shop.findFirst({
			where: {
				id: shopId,
				userId
			},
			select: {
				id: true
			}
		})
		if (!shop) {
			return res.status(404).json({ message: "Shop not found" })
		}
		const updatedShop = await prisma.shop.update({
			where: { id: shopId },
			data: {
				name: hasOwn(req.body, "name") ? name : undefined,
				description: hasOwn(req.body, "description") ? description : undefined
			},
			include: {
				products: true
			}
		})
		res.json(updatedShop)
	} catch (error) {
		res.status(500).json({ message: "Error updating shop", error: error.message })
	}
}

// Controller: Delete Shop
async function deleteShop (req, res) {
	try {
		const { id } = req.params
		const userId = req.user.userId
		const shopId = parseId(id)

		if (!shopId) {
			return res.status(400).json({ message: "Invalid shop id" })
		}

		const shop = await prisma.shop.findFirst({
			where: {
				id: shopId,
				userId
			},
			select: {
				id: true,
				imagePublicId: true
			}
		})
		if (!shop) {
			return res.status(404).json({ message: "Shop not found" })
		}
		await prisma.shop.delete({
			where: { id: shopId }
		})
		await deleteImage(shop.imagePublicId)
		res.json({ message: "Shop deleted successfully" })
	} catch (error) {
		res.status(500).json({ message: "Error deleting shop", error: error.message })
	}
}

// Controller: Upload Shop Image
async function uploadShopImage (req, res) {
	try {
		const { id } = req.params
		const userId = req.user.userId
		const shopId = parseId(id)

		if (!shopId) {
			return res.status(400).json({ message: "Invalid shop id" })
		}

		if (!req.file) {
			return res.status(400).json({ message: "Image file is required" })
		}

		// Verify shop ownership
		const shop = await prisma.shop.findFirst({
			where: {
				id: shopId,
				userId
			},
			select: {
				id: true,
				imagePublicId: true
			}
		})
		if (!shop) {
			return res.status(404).json({ message: "Shop not found" })
		}

		const uploadedImage = await uploadImage(req.file, "style-mart/shops")
		const updatedShop = await prisma.shop.update({
			where: { id: shopId },
			data: {
				imageUrl: uploadedImage.secure_url,
				imagePublicId: uploadedImage.public_id
			},
			include: {
				products: true
			}
		})

		await deleteImage(shop.imagePublicId)
		res.json(updatedShop)
	} catch (error) {
		res.status(500).json({ message: "Error uploading shop image", error: error.message })
	}
}

// Controller: Delete Shop Image
async function deleteShopImage (req, res) {
	try {
		const { id } = req.params
		const userId = req.user.userId
		const shopId = parseId(id)

		if (!shopId) {
			return res.status(400).json({ message: "Invalid shop id" })
		}

		// Verify shop ownership
		const shop = await prisma.shop.findFirst({
			where: {
				id: shopId,
				userId
			},
			select: {
				id: true,
				imagePublicId: true
			}
		})
		if (!shop) {
			return res.status(404).json({ message: "Shop not found" })
		}

		const updatedShop = await prisma.shop.update({
			where: { id: shopId },
			data: {
				imageUrl: null,
				imagePublicId: null
			},
			include: {
				products: true
			}
		})

		await deleteImage(shop.imagePublicId)
		res.json(updatedShop)
	} catch (error) {
		res.status(500).json({ message: "Error deleting shop image", error: error.message })
	}
}

// Export
module.exports = {
	getShops,
	getShop,
	getUserShops,
	createShop,
	updateShop,
	deleteShop,
	uploadShopImage,
	deleteShopImage
}
