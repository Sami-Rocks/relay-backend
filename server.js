// Modules
const express = require("express")
const cors = require("cors")
const { PrismaClient } = require("@prisma/client")
require("dotenv").config()

// Routes
const productRoutes = require("./routes/product")
const userRoutes = require("./routes/user")
const orderRoutes = require("./routes/order")

// Middleware
const app = express()
const prisma = new PrismaClient()
app.use(cors())
app.use(express.json())


// Routes
app.get("/", (req, res) => {
	res.send("Hello World")
})
app.use("/api/products", productRoutes)
app.use("/api/users", userRoutes)
app.use("/api/orders", orderRoutes)

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