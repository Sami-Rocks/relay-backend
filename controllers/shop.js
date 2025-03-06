// Modules
const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

// Get Shops
async function getShops(req, res) {
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

// Get Shop
async function getShop(req, res) {
	try {
		const { id } = req.params
		const shop = await prisma.shop.findUnique({
			where: { id: parseInt(id) },
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

// Get User Shops
async function getUserShops(req, res) {
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

// Create Shop
async function createShop(req, res) {
	try {
		const { name, description } = req.body
		const userId = req.user.userId
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

// Update Shop
async function updateShop(req, res) {
	try {
		const { id } = req.params
		const { name, description } = req.body
		const userId = req.user.userId
		const shop = await prisma.shop.findFirst({
			where: {
				id: parseInt(id),
				userId
			}
		})
		if (!shop) {
			return res.status(404).json({ message: "Shop not found" })
		}
		const updatedShop = await prisma.shop.update({
			where: { id: parseInt(id) },
			data: {
				name: name || shop.name,
				description: description || shop.description
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

// Delete Shop
async function deleteShop(req, res) {
	try {
		const { id } = req.params
		const userId = req.user.userId
		const shop = await prisma.shop.findFirst({
			where: {
				id: parseInt(id),
				userId
			}
		})
		if (!shop) {
			return res.status(404).json({ message: "Shop not found" })
		}
		await prisma.shop.delete({
			where: { id: parseInt(id) }
		})
		res.json({ message: "Shop deleted successfully" })
	} catch (error) {
		res.status(500).json({ message: "Error deleting shop", error: error.message })
	}
}

// Export
module.exports = {
	getShops,
	getShop,
	getUserShops,
	createShop,
	updateShop,
	deleteShop
} 