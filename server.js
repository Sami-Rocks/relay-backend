require("dotenv").config()

// App
const app = require("./app")

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
	console.log(`Relay API running on port ${PORT}`)
})

module.exports = app
