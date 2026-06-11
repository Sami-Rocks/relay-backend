// Modules
const bcrypt = require("bcryptjs")
const prisma = require("../lib/prisma")
const { hasOwn } = require("../utils/request")
const { signToken } = require("../utils/jwt")

// Variables
const userSelect = {
	id: true,
	email: true,
	firstName: true,
	lastName: true,
	createdAt: true,
	updatedAt: true
}
const userLoginSelect = {
	...userSelect,
	password: true
}
const profileFields = [
	"firstName",
	"lastName"
]

// Function: Build Profile Data
function buildProfileData (body) {
	return profileFields.reduce((data, field) => {
		if (hasOwn(body, field)) data[field] = body[field]
		return data
	}, {})
}

// Controller: Register
async function register (req, res) {
	try {
		const { email, password } = req.body

		if (!email || !password) {
			return res.status(400).json({ message: "Email and password are required" })
		}

		const existingUser = await prisma.user.findUnique({
			where: { email },
			select: {
				id: true
			}
		})
		if (existingUser) {
			return res.status(400).json({ message: "User already exists" })
		}

		const hashedPassword = await bcrypt.hash(password, 10)
		const user = await prisma.user.create({
			data: {
				email,
				password: hashedPassword,
				...buildProfileData(req.body)
			},
			select: userSelect
		})
		const token = signToken({ userId: user.id })

		res.status(201).json({
			message: "User created successfully",
			token,
			user
		})
	} catch (error) {
		res.status(500).json({ message: "Error creating user", error: error.message })
	}
}

// Controller: Login
async function login (req, res) {
	try {
		const { email, password } = req.body

		if (!email || !password) {
			return res.status(400).json({ message: "Email and password are required" })
		}

		const user = await prisma.user.findUnique({
			where: { email },
			select: userLoginSelect
		})
		if (!user) {
			return res.status(401).json({ message: "Invalid credentials" })
		}

		const isValidPassword = await bcrypt.compare(password, user.password)
		if (!isValidPassword) {
			return res.status(401).json({ message: "Invalid credentials" })
		}

		const token = signToken({ userId: user.id })
		const { password: userPassword, ...safeUser } = user

		res.json({
			token,
			user: safeUser
		})
	} catch (error) {
		res.status(500).json({ message: "Error logging in", error: error.message })
	}
}

// Controller: Get Profile
async function getProfile (req, res) {
	try {
		const user = await prisma.user.findUnique({
			where: { id: req.user.userId },
			select: userSelect
		})
		if (!user) {
			return res.status(404).json({ message: "User not found" })
		}

		res.json(user)
	} catch (error) {
		res.status(500).json({ message: "Error fetching profile", error: error.message })
	}
}

// Controller: Update Profile
async function updateProfile (req, res) {
	try {
		const { email, password } = req.body
		const updateData = buildProfileData(req.body)

		if (email) updateData.email = email
		if (password) {
			updateData.password = await bcrypt.hash(password, 10)
		}

		if (Object.keys(updateData).length === 0) {
			return res.status(400).json({ message: "No profile changes provided" })
		}

		const user = await prisma.user.update({
			where: { id: req.user.userId },
			data: updateData,
			select: userSelect
		})

		res.json({ message: "Profile updated successfully", user })
	} catch (error) {
		res.status(500).json({ message: "Error updating profile", error: error.message })
	}
}

// Export
module.exports = {
	getProfile,
	login,
	register,
	updateProfile
}
