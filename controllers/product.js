// Modules
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

// Get Products
async function getProducts(req, res) {
	try {
		const products = await prisma.product.findMany({
			include: {
				shop: {
					select: {
						id: true,
						name: true
					}
				}
			},
			orderBy: {
				createdAt: "desc"
			}
		})
		res.json(products)
	} catch (error) {
		res.status(500).json({ message: "Error fetching products", error: error.message })
	}
}

// Get Product
async function getProduct(req, res) {
	try {
		const { id } = req.params
		const product = await prisma.product.findUnique({
			where: { id: parseInt(id) },
			include: {
				shop: {
					select: {
						id: true,
						name: true
					}
				}
			}
		})
		if (!product) {
			return res.status(404).json({ message: "Product not found" })
		}
		res.json(product)
	} catch (error) {
		res.status(500).json({ message: "Error fetching product", error: error.message })
	}
}

// Create Product
async function createProduct(req, res) {
	try {
		const { name, description, price, shopId } = req.body
		const userId = req.user.userId
		
		// Verify shop ownership
		const shop = await prisma.shop.findFirst({
			where: {
				id: parseInt(shopId),
				userId
			}
		})
		if (!shop) {
			return res.status(404).json({ message: "Shop not found or unauthorized" })
		}
		
		const product = await prisma.product.create({
			data: {
				name,
				description,
				price: parseFloat(price),
				shopId: parseInt(shopId)
			},
			include: {
				shop: {
					select: {
						id: true,
						name: true
					}
				}
			}
		})
		res.status(201).json(product)
	} catch (error) {
		res.status(500).json({ message: "Error creating product", error: error.message })
	}
}

// Update Product
async function updateProduct(req, res) {
	try {
		const { id } = req.params
		const { name, description, price } = req.body
		const userId = req.user.userId
		
		// Verify product ownership through shop
		const product = await prisma.product.findFirst({
			where: {
				id: parseInt(id),
				shop: {
					userId
				}
			},
			include: {
				shop: true
			}
		})
		if (!product) {
			return res.status(404).json({ message: "Product not found or unauthorized" })
		}
		
		const updatedProduct = await prisma.product.update({
			where: { id: parseInt(id) },
			data: {
				name: name || product.name,
				description: description || product.description,
				price: price ? parseFloat(price) : product.price
			},
			include: {
				shop: {
					select: {
						id: true,
						name: true
					}
				}
			}
		})
		res.json(updatedProduct)
	} catch (error) {
		res.status(500).json({ message: "Error updating product", error: error.message })
	}
}

// Delete Product
async function deleteProduct(req, res) {
	try {
		const { id } = req.params
		const userId = req.user.userId
		
		// Verify product ownership through shop
		const product = await prisma.product.findFirst({
			where: {
				id: parseInt(id),
				shop: {
					userId
				}
			}
		})
		if (!product) {
			return res.status(404).json({ message: "Product not found or unauthorized" })
		}
		
		await prisma.product.delete({
			where: { id: parseInt(id) }
		})
		res.json({ message: "Product deleted successfully" })
	} catch (error) {
		res.status(500).json({ message: "Error deleting product", error: error.message })
	}
}

// Export
module.exports = {
	getProducts,
	getProduct,
	createProduct,
	updateProduct,
	deleteProduct
}
