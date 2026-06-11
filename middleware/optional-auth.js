// Modules
const prisma = require("../lib/prisma")
const { verifyToken } = require("../utils/jwt")

// Middleware: Optional Auth
module.exports = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization
		const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

		if (!token) return next()

		const decoded = verifyToken(token)
		const user = await prisma.user.findUnique({
			where: {
				id: decoded.userId
			},
			select: {
				id: true,
				email: true,
				firstName: true,
				lastName: true
			}
		})

		if (user) {
			req.user = {
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				userId: user.id
			}
		}

		next()
	} catch (error) {
		next()
	}
}
