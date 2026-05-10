// Modules
const prisma = require("../lib/prisma")
const {
	hasDuplicates,
	hasOwn,
	parseAmount,
	parseId,
	parseIdArray
} = require("../utils/request")

// Controller: Create Order
exports.createOrder = async (req, res) => {
	try {
		const { shopId, total, productIds } = req.body
		const userId = req.user.userId
		const parsedShopId = parseId(shopId)
		const parsedTotal = parseAmount(total)
		const parsedProductIds = parseIdArray(productIds)

		if (!parsedShopId || parsedTotal === null || !parsedProductIds || hasDuplicates(parsedProductIds)) {
			return res.status(400).json({ message: "Valid shopId, total, and unique productIds are required" })
		}

		// Verify shop exists
		const shop = await prisma.shop.findUnique({
			where: { id: parsedShopId },
			select: {
				id: true
			}
		})
		if (!shop) {
			return res.status(404).json({ message: "Shop not found" })
		}

		// Verify products belong to shop
		const productCount = await prisma.product.count({
			where: {
				id: { in: parsedProductIds },
				shopId: parsedShopId
			}
		})
		if (productCount !== parsedProductIds.length) {
			return res.status(400).json({ message: "Invalid products for this shop" })
		}

		const order = await prisma.order.create({
			data: {
				total: parsedTotal,
				userId,
				shopId: parsedShopId,
				products: {
					connect: parsedProductIds.map((id) => ({ id }))
				}
			},
			include: {
				user: {
					select: {
						email: true
					}
				},
				shop: {
					select: {
						name: true
					}
				},
				products: true
			}
		})
		res.status(201).json(order)
	} catch (error) {
		res.status(500).json({ message: "Error creating order", error: error.message })
	}
}

// Controller: Get User Orders
exports.getUserOrders = async (req, res) => {
	try {
		const userId = req.user.userId
		const orders = await prisma.order.findMany({
			where: {
				userId
			},
			include: {
				shop: {
					select: {
						name: true
					}
				},
				products: true
			},
			orderBy: {
				createdAt: "desc"
			}
		})
		res.json(orders)
	} catch (error) {
		res.status(500).json({ message: "Error fetching orders", error: error.message })
	}
}

// Controller: Get Shop Orders
exports.getShopOrders = async (req, res) => {
	try {
		const userId = req.user.userId
		const { shopId } = req.params
		const parsedShopId = parseId(shopId)

		if (!parsedShopId) {
			return res.status(400).json({ message: "Invalid shop id" })
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

		const orders = await prisma.order.findMany({
			where: {
				shopId: parsedShopId
			},
			include: {
				user: {
					select: {
						email: true
					}
				},
				products: true
			},
			orderBy: {
				createdAt: "desc"
			}
		})
		res.json(orders)
	} catch (error) {
		res.status(500).json({ message: "Error fetching shop orders", error: error.message })
	}
}

// Controller: Get Order
exports.getOrder = async (req, res) => {
	try {
		const { id } = req.params
		const userId = req.user.userId
		const orderId = parseId(id)

		if (!orderId) {
			return res.status(400).json({ message: "Invalid order id" })
		}

		const order = await prisma.order.findFirst({
			where: {
				id: orderId,
				OR: [
					{ userId },
					{
						shop: {
							userId
						}
					}
				]
			},
			include: {
				user: {
					select: {
						email: true
					}
				},
				shop: {
					select: {
						name: true
					}
				},
				products: true
			}
		})
		if (!order) {
			return res.status(404).json({ message: "Order not found or unauthorized" })
		}
		res.json(order)
	} catch (error) {
		res.status(500).json({ message: "Error fetching order", error: error.message })
	}
}

// Controller: Update Order
exports.updateOrder = async (req, res) => {
	try {
		const { id } = req.params
		const { total, productIds } = req.body
		const userId = req.user.userId
		const orderId = parseId(id)
		const parsedTotal = hasOwn(req.body, "total") ? parseAmount(total) : undefined
		const parsedProductIds = hasOwn(req.body, "productIds") ? parseIdArray(productIds) : undefined

		if (!orderId || parsedTotal === null || parsedProductIds === null || (parsedProductIds && hasDuplicates(parsedProductIds))) {
			return res.status(400).json({ message: "Invalid order id, total, or productIds" })
		}

		if (!hasOwn(req.body, "total") && !hasOwn(req.body, "productIds")) {
			return res.status(400).json({ message: "No order changes provided" })
		}

		// Verify order ownership through shop
		const order = await prisma.order.findFirst({
			where: {
				id: orderId,
				shop: {
					userId
				}
			},
			select: {
				id: true,
				shopId: true
			}
		})
		if (!order) {
			return res.status(404).json({ message: "Order not found or unauthorized" })
		}

		// Verify products belong to shop
		if (parsedProductIds) {
			const productCount = await prisma.product.count({
				where: {
					id: { in: parsedProductIds },
					shopId: order.shopId
				}
			})
			if (productCount !== parsedProductIds.length) {
				return res.status(400).json({ message: "Invalid products for this shop" })
			}
		}

		const updatedOrder = await prisma.order.update({
			where: { id: orderId },
			data: {
				total: parsedTotal,
				products: parsedProductIds ? {
					set: parsedProductIds.map((id) => ({ id }))
				} : undefined
			},
			include: {
				user: {
					select: {
						email: true
					}
				},
				shop: {
					select: {
						name: true
					}
				},
				products: true
			}
		})
		res.json(updatedOrder)
	} catch (error) {
		res.status(500).json({ message: "Error updating order", error: error.message })
	}
}

// Controller: Delete Order
exports.deleteOrder = async (req, res) => {
	try {
		const { id } = req.params
		const userId = req.user.userId
		const orderId = parseId(id)

		if (!orderId) {
			return res.status(400).json({ message: "Invalid order id" })
		}

		// Verify order ownership through shop
		const order = await prisma.order.findFirst({
			where: {
				id: orderId,
				shop: {
					userId
				}
			},
			select: {
				id: true
			}
		})
		if (!order) {
			return res.status(404).json({ message: "Order not found or unauthorized" })
		}

		await prisma.order.delete({
			where: { id: orderId }
		})
		res.json({ message: "Order deleted successfully" })
	} catch (error) {
		res.status(500).json({ message: "Error deleting order", error: error.message })
	}
}
