// Modules
const { verifyToken } = require("../utils/jwt")

// Middleware: Auth
module.exports = (req, res, next) => {
	try {
		const authHeader = req.headers.authorization
		const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

		if (!token) {
			return res.status(401).json({ message: "Authentication required" })
		}

		const decoded = verifyToken(token)
		req.user = decoded
		next()
	} catch (error) {
		res.status(401).json({ message: "Invalid or expired token" })
	}
}
