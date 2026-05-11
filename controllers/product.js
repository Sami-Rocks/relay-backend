// Modules
const { deleteImage, uploadImage } = require("../lib/cloudinary")
const prisma = require("../lib/prisma")
const { hasOwn, parseAmount, parseId, parseList } = require("../utils/request")

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

const productSorts = {
	newest: { createdAt: "desc" },
	oldest: { createdAt: "asc" },
	price_asc: { price: "asc" },
	price_desc: { price: "desc" },
	rating_desc: { rating: "desc" }
}

// Function: Build Product Filters
function buildProductFilters (query) {
	const categories = parseList(query.category || query.categories)
	const genders = parseList(query.gender || query.genders)
	const audiences = parseList(query.audience || query.audiences)
	const sizes = parseList(query.size || query.sizes)
	const shopId = parseId(query.shopId)
	const minPrice = hasOwn(query, "minPrice") ? parseAmount(query.minPrice) : undefined
	const maxPrice = hasOwn(query, "maxPrice") ? parseAmount(query.maxPrice) : undefined
	const minRating = hasOwn(query, "minRating") ? parseAmount(query.minRating) : undefined
	const search = query.search || query.q
	const where = {
		AND: []
	}

	if (search) {
		where.AND.push({
			OR: [
				{ name: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } },
				{ shop: { name: { contains: search, mode: "insensitive" } } }
			]
		})
	}

	if (categories.length) {
		where.AND.push({
			OR: categories.map((category) => ({
				category: {
					equals: category,
					mode: "insensitive"
				}
			}))
		})
	}

	if (genders.length) {
		where.AND.push({
			OR: genders.map((gender) => ({
				gender: {
					equals: gender,
					mode: "insensitive"
				}
			}))
		})
	}

	if (audiences.length) {
		where.AND.push({
			OR: audiences.map((audience) => ({
				audience: {
					equals: audience,
					mode: "insensitive"
				}
			}))
		})
	}

	if (sizes.length) {
		where.sizes = { hasSome: sizes }
	}

	if (shopId) {
		where.shopId = shopId
	}

	if (minPrice !== undefined || maxPrice !== undefined) {
		where.price = {}
		if (minPrice !== undefined) where.price.gte = minPrice
		if (maxPrice !== undefined) where.price.lte = maxPrice
	}

	if (minRating !== undefined) {
		where.rating = { gte: minRating }
	}

	if (!where.AND.length) {
		delete where.AND
	}

	return {
		maxPrice,
		minPrice,
		minRating,
		where
	}
}

// Controller: Get Products
async function getProducts (req, res) {
	try {
		const { maxPrice, minPrice, minRating, where } = buildProductFilters(req.query)
		const sort = productSorts[req.query.sort] || productSorts.newest
		const page = parseId(req.query.page) || 1
		const limit = parseId(req.query.limit) || 20

		if (minPrice === null || maxPrice === null || minRating === null) {
			return res.status(400).json({ message: "Invalid product filter values" })
		}

		const products = await prisma.product.findMany({
			where,
			include: productWithShop,
			orderBy: sort,
			skip: (page - 1) * limit,
			take: Math.min(limit, 100)
		})

		if (req.query.withMeta === "true") {
			const total = await prisma.product.count({ where })

			return res.json({
				data: products,
				meta: {
					page,
					limit,
					total,
					totalPages: Math.ceil(total / limit)
				}
			})
		}

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
		const { name, description, category, gender, audience, price, rating, shopId } = req.body
		const userId = req.user.userId
		const parsedShopId = parseId(shopId)
		const parsedPrice = parseAmount(price)
		const parsedRating = hasOwn(req.body, "rating") ? parseAmount(rating) : 0
		const sizes = parseList(req.body.sizes)

		if (!name || !parsedShopId || parsedPrice === null || parsedRating === null) {
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
				category,
				gender,
				audience,
				sizes,
				rating: parsedRating,
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
		const { name, description, category, gender, audience, price, rating } = req.body
		const userId = req.user.userId
		const productId = parseId(id)
		const parsedPrice = hasOwn(req.body, "price") ? parseAmount(price) : undefined
		const parsedRating = hasOwn(req.body, "rating") ? parseAmount(rating) : undefined
		const sizes = hasOwn(req.body, "sizes") ? parseList(req.body.sizes) : undefined

		if (!productId || parsedPrice === null || parsedRating === null) {
			return res.status(400).json({ message: "Invalid product id, price, or rating" })
		}

		if (
			!hasOwn(req.body, "name")
			&& !hasOwn(req.body, "description")
			&& !hasOwn(req.body, "category")
			&& !hasOwn(req.body, "gender")
			&& !hasOwn(req.body, "audience")
			&& !hasOwn(req.body, "sizes")
			&& !hasOwn(req.body, "rating")
			&& !hasOwn(req.body, "price")
		) {
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
				category: hasOwn(req.body, "category") ? category : undefined,
				gender: hasOwn(req.body, "gender") ? gender : undefined,
				audience: hasOwn(req.body, "audience") ? audience : undefined,
				sizes,
				rating: parsedRating,
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
