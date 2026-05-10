// Modules
const express = require("express")
const cors = require("cors")
const multer = require("multer")
require("dotenv").config()

// Routes
const productRoutes = require("./routes/product")
const shopRoutes = require("./routes/shop")
const userRoutes = require("./routes/user")
const orderRoutes = require("./routes/order")

// Middleware
const app = express()
app.use(cors())
app.use(express.json())

// Routes
app.get("/", (req, res) => {
	res.send("Hello World")
})
app.use("/api/products", productRoutes)
app.use("/api/shops", shopRoutes)
app.use("/api/users", userRoutes)
app.use("/api/orders", orderRoutes)

// Upload Error Handler
app.use((err, req, res, next) => {
	if (err instanceof multer.MulterError || err.message?.includes("images are allowed")) {
		return res.status(400).json({ message: err.message })
	}

	next(err)
})

// Global Error Handler
app.use((err, req, res, next) => {
	console.error(err.stack)
	res.status(500).send("Something broke!")
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`)
})

// Export
module.exports = app
