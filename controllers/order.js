const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const { shopId, total, productIds } = req.body;
    const userId = req.user.userId;

    // Verify shop exists
    const shop = await prisma.shop.findUnique({
      where: { id: parseInt(shopId) }
    });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }

    // Verify products belong to shop
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds.map(id => parseInt(id)) },
        shopId: parseInt(shopId)
      }
    });
    if (products.length !== productIds.length) {
      return res.status(400).json({ message: "Invalid products for this shop" });
    }

    const order = await prisma.order.create({
      data: {
        total,
        userId,
        shopId: parseInt(shopId),
        products: {
          connect: productIds.map(id => ({ id: parseInt(id) }))
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
    });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: "Error creating order", error: error.message });
  }
};

// Get all orders for a user
exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.userId;
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
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching orders", error: error.message });
  }
};

// Get shop orders
exports.getShopOrders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { shopId } = req.params;

    // Verify shop ownership
    const shop = await prisma.shop.findFirst({
      where: {
        id: parseInt(shopId),
        userId
      }
    });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found or unauthorized" });
    }

    const orders = await prisma.order.findMany({
      where: {
        shopId: parseInt(shopId)
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
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Error fetching shop orders", error: error.message });
  }
};

// Get a specific order
exports.getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const order = await prisma.order.findFirst({
      where: {
        id: parseInt(id),
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
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found or unauthorized" });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: "Error fetching order", error: error.message });
  }
};

// Update an order
exports.updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { total, productIds } = req.body;
    const userId = req.user.userId;

    // Verify order ownership through shop
    const order = await prisma.order.findFirst({
      where: {
        id: parseInt(id),
        shop: {
          userId
        }
      },
      include: {
        products: true
      }
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found or unauthorized" });
    }

    // Verify products belong to shop
    if (productIds) {
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds.map(id => parseInt(id)) },
          shopId: order.shopId
        }
      });
      if (products.length !== productIds.length) {
        return res.status(400).json({ message: "Invalid products for this shop" });
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        total: total || order.total,
        products: productIds ? {
          set: productIds.map(id => ({ id: parseInt(id) }))
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
    });
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: "Error updating order", error: error.message });
  }
};

// Delete an order
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verify order ownership through shop
    const order = await prisma.order.findFirst({
      where: {
        id: parseInt(id),
        shop: {
          userId
        }
      }
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found or unauthorized" });
    }

    await prisma.order.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting order", error: error.message });
  }
};
