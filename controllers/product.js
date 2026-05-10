// Modules
const { deleteImage, uploadImage } = require("../lib/cloudinary")
const prisma = require("../lib/prisma")
const { hasOwn, parseAmount, parseId } = require("../utils/request")

// Variables
const shopSummary = {
	id: true,
	name: true
}

const productWithShop = {
	shop: {
		select: shopSummary
	}
}

// Controller: Get Products
async function getProducts (req, res) {
	try {
		const products = await prisma.product.findMany({
			include: productWithShop,
			orderBy: {
				createdAt: "desc"
			}
		})
		res.json(products)
	} catch (error) {
		res.status(500).json({ message: "Error fetching products", error: error.message })
	}
}

// Controller: Get Product
async function getProduct (req, res) {
	try {
		const { id } = req.params
		const productId = parseId(id)

		if (!productId) {
			return res.status(400).json({ message: "Invalid product id" })
		}

		const product = await prisma.product.findUnique({
			where: { id: productId },
			include: productWithShop
		})
		if (!product) {
			return res.status(404).json({ message: "Product not found" })
		}
		res.json(product)
	} catch (error) {
		res.status(500).json({ message: "Error fetching product", error: error.message })
	}
}

// Controller: Create Product
async function createProduct (req, res) {
	try {
		const { name, description, price, shopId } = req.body
		const userId = req.user.userId
		const parsedShopId = parseId(shopId)
		const parsedPrice = parseAmount(price)

		if (!name || !parsedShopId || parsedPrice === null) {
			return res.status(400).json({ message: "Name, valid price, and valid shopId are required" })
		}

		// Verify shop ownership
		const shop = await prisma.shop.findFirst({
			where: {
				id: parsedShopId,
				userId
			},
			select: {
				id: true
			}
		})
		if (!shop) {
			return res.status(404).json({ message: "Shop not found or unauthorized" })
		}

		const product = await prisma.product.create({
			data: {
				name,
				description,
				price: parsedPrice,
				shopId: parsedShopId
			},
			include: productWithShop
		})
		res.status(201).json(product)
	} catch (error) {
		res.status(500).json({ message: "Error creating product", error: error.message })
	}
}

// Controller: Update Product
async function updateProduct (req, res) {
	try {
		const { id } = req.params
		const { name, description, price } = req.body
		const userId = req.user.userId
		const productId = parseId(id)
		const parsedPrice = hasOwn(req.body, "price") ? parseAmount(price) : undefined

		if (!productId || parsedPrice === null) {
			return res.status(400).json({ message: "Invalid product id or price" })
		}

		if (!hasOwn(req.body, "name") && !hasOwn(req.body, "description") && !hasOwn(req.body, "price")) {
			return res.status(400).json({ message: "No product changes provided" })
		}

		// Verify product ownership through shop
		const product = await prisma.product.findFirst({
			where: {
				id: productId,
				shop: {
					userId
				}
			},
			select: {
				id: true
			}
		})
		if (!product) {
			return res.status(404).json({ message: "Product not found or unauthorized" })
		}

		const updatedProduct = await prisma.product.update({
			where: { id: productId },
			data: {
				name: hasOwn(req.body, "name") ? name : undefined,
				description: hasOwn(req.body, "description") ? description : undefined,
				price: parsedPrice
			},
			include: productWithShop
		})
		res.json(updatedProduct)
	} catch (error) {
		res.status(500).json({ message: "Error updating product", error: error.message })
	}
}

// Controller: Delete Product
async function deleteProduct (req, res) {
	try {
		const { id } = req.params
		const userId = req.user.userId
		const productId = parseId(id)

		if (!productId) {
			return res.status(400).json({ message: "Invalid product id" })
		}

		// Verify product ownership through shop
		const product = await prisma.product.findFirst({
			where: {
				id: productId,
				shop: {
					userId
				}
			},
			select: {
				id: true,
				imagePublicId: true
			}
		})
		if (!product) {
			return res.status(404).json({ message: "Product not found or unauthorized" })
		}

		await prisma.product.delete({
			where: { id: productId }
		})
		await deleteImage(product.imagePublicId)
		res.json({ message: "Product deleted successfully" })
	} catch (error) {
		res.status(500).json({ message: "Error deleting product", error: error.message })
	}
}

// Controller: Upload Product Image
async function uploadProductImage (req, res) {
	try {
		const { id } = req.params
		const userId = req.user.userId
		const productId = parseId(id)

		if (!productId) {
			return res.status(400).json({ message: "Invalid product id" })
		}

		if (!req.file) {
			return res.status(400).json({ message: "Image file is required" })
		}

		// Verify product ownership through shop
		const product = await prisma.product.findFirst({
			where: {
				id: productId,
				shop: {
					userId
				}
			},
			select: {
				id: true,
				imagePublicId: true
			}
		})
		if (!product) {
			return res.status(404).json({ message: "Product not found or unauthorized" })
		}

		const uploadedImage = await uploadImage(req.file, "style-mart/products")
		const updatedProduct = await prisma.product.update({
			where: { id: productId },
			data: {
				imageUrl: uploadedImage.secure_url,
				imagePublicId: uploadedImage.public_id
			},
			include: productWithShop
		})

		await deleteImage(product.imagePublicId)
		res.json(updatedProduct)
	} catch (error) {
		res.status(500).json({ message: "Error uploading product image", error: error.message })
	}
}

// Controller: Delete Product Image
async function deleteProductImage (req, res) {
	try {
		const { id } = req.params
		const userId = req.user.userId
		const productId = parseId(id)

		if (!productId) {
			return res.status(400).json({ message: "Invalid product id" })
		}

		// Verify product ownership through shop
		const product = await prisma.product.findFirst({
			where: {
				id: productId,
				shop: {
					userId
				}
			},
			select: {
				id: true,
				imagePublicId: true
			}
		})
		if (!product) {
			return res.status(404).json({ message: "Product not found or unauthorized" })
		}

		const updatedProduct = await prisma.product.update({
			where: { id: productId },
			data: {
				imageUrl: null,
				imagePublicId: null
			},
			include: productWithShop
		})

		await deleteImage(product.imagePublicId)
		res.json(updatedProduct)
	} catch (error) {
		res.status(500).json({ message: "Error deleting product image", error: error.message })
	}
}

// Export
module.exports = {
	getProducts,
	getProduct,
	createProduct,
	updateProduct,
	deleteProduct,
	uploadProductImage,
	deleteProductImage
}
