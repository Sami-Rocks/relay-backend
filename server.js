require("dotenv").config()

// App
const app = require("./app")

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
	console.log(`Relay API running on port ${PORT}`)
})

module.exports = app
