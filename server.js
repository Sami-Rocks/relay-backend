const cors = require("cors")
const express = require("express")
require("dotenv").config()

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
