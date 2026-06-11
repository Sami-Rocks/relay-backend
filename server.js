const cors = require("cors")
const express = require("express")
const multer = require("multer")
require("dotenv").config()

// Routes
const formRoutes = require("./routes/form")
const userRoutes = require("./routes/user")

const app = express()

app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
	res.json({
		name: "relay-api",
		status: "ok"
	})
})

app.get("/health", (req, res) => {
	res.json({
		status: "ok"
	})
})

app.use("/api/forms", formRoutes)
app.use("/api/users", userRoutes)

app.use((err, req, res, next) => {
	if (err instanceof multer.MulterError || err.message?.includes("images are allowed")) {
		return res.status(400).json({ message: err.message })
	}

	next(err)
})

app.use((req, res) => {
	res.status(404).json({
		message: "Route not found"
	})
})

app.use((err, req, res, next) => {
	console.error(err)

	res.status(500).json({
		message: "Internal server error"
	})
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
	console.log(`Relay API running on port ${PORT}`)
})

module.exports = app
