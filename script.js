// Modules
const bcrypt = require("bcryptjs")
const prisma = require("./lib/prisma")

// Variables
const seedUser = {
	email: "tester@stylemart.com",
	password: "password123"
}

const seedShops = [
	{
		name: "Urban Thread",
		description: "Everyday streetwear, clean basics, and bold weekend pieces.",
		imageUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
		imagePublicId: "seed/urban-thread",
		products: [
			{
				name: "Relaxed Cotton Hoodie",
				description: "Soft heavyweight hoodie with a relaxed streetwear fit.",
				price: 89.99,
				imageUrl: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80",
				imagePublicId: "seed/relaxed-cotton-hoodie"
			},
			{
				name: "Boxy Denim Jacket",
				description: "Structured denim jacket with dropped shoulders.",
				price: 129.99,
				imageUrl: "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=80",
				imagePublicId: "seed/boxy-denim-jacket"
			},
			{
				name: "Classic White Tee",
				description: "Premium cotton tee with a clean crew neckline.",
				price: 34.99,
				imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80",
				imagePublicId: "seed/classic-white-tee"
			}
		]
	},
	{
		name: "Luxe Lane",
		description: "Polished occasionwear and refined wardrobe staples.",
		imageUrl: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=80",
		imagePublicId: "seed/luxe-lane",
		products: [
			{
				name: "Satin Slip Dress",
				description: "Minimal satin dress with an elegant drape.",
				price: 149.99,
				imageUrl: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=900&q=80",
				imagePublicId: "seed/satin-slip-dress"
			},
			{
				name: "Tailored Blazer",
				description: "Single-breasted blazer with a sharp modern cut.",
				price: 179.99,
				imageUrl: "https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=900&q=80",
				imagePublicId: "seed/tailored-blazer"
			},
			{
				name: "Pleated Wide-Leg Trouser",
				description: "High-rise trouser with soft pleats and a fluid leg.",
				price: 119.99,
				imageUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=900&q=80",
				imagePublicId: "seed/pleated-wide-leg-trouser"
			}
		]
	}
]

// Function: Reset Seed Data
async function resetSeedData (userId) {
	const shops = await prisma.shop.findMany({
		where: { userId },
		select: {
			id: true
		}
	})
	const shopIds = shops.map((shop) => shop.id)

	await prisma.order.deleteMany({
		where: {
			OR: [
				{ userId },
				{ shopId: { in: shopIds } }
			]
		}
	})
	await prisma.product.deleteMany({
		where: {
			shopId: { in: shopIds }
		}
	})
	await prisma.shop.deleteMany({
		where: { userId }
	})
}

// Function: Create Seed Shops
async function createSeedShops (userId) {
	const shops = []

	for (const shopData of seedShops) {
		const { products, ...shopDetails } = shopData
		const shop = await prisma.shop.create({
			data: {
				...shopDetails,
				userId,
				products: {
					create: products
				}
			},
			include: {
				products: true
			}
		})

		shops.push(shop)
	}

	return shops
}

// Function: Create Seed Orders
async function createSeedOrders (userId, shops) {
	for (const shop of shops) {
		const products = shop.products.slice(0, 2)
		const total = products.reduce((sum, product) => sum + product.price, 0)

		await prisma.order.create({
			data: {
				userId,
				shopId: shop.id,
				total,
				products: {
					connect: products.map((product) => ({ id: product.id }))
				}
			}
		})
	}
}

// Function: Seed Database
async function seedDatabase () {
	const hashedPassword = await bcrypt.hash(seedUser.password, 10)
	const user = await prisma.user.upsert({
		where: {
			email: seedUser.email
		},
		update: {
			password: hashedPassword
		},
		create: {
			email: seedUser.email,
			password: hashedPassword
		}
	})

	await resetSeedData(user.id)
	const shops = await createSeedShops(user.id)
	await createSeedOrders(user.id, shops)

	console.log("Seed complete")
	console.log(`Email: ${seedUser.email}`)
	console.log(`Password: ${seedUser.password}`)
	console.log(`Shops: ${shops.length}`)
	console.log(`Products: ${shops.reduce((count, shop) => count + shop.products.length, 0)}`)
	console.log(`Orders: ${shops.length}`)
}

// Run
seedDatabase()
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
