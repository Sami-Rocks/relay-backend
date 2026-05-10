// Modules
const bcrypt = require("bcryptjs")
const prisma = require("../lib/prisma")
const { signToken } = require("../utils/jwt")

// Controller: Register
exports.register = async (req, res) => {
	try {
		const { email, password } = req.body

		if (!email || !password) {
			return res.status(400).json({ message: "Email and password are required" })
		}

		// Check if user already exists
		const existingUser = await prisma.user.findUnique({
			where: { email },
			select: {
				id: true
			}
		})
		if (existingUser) {
			return res.status(400).json({ message: "User already exists" })
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10)

		// Create new user
		const user = await prisma.user.create({
			data: {
				email,
				password: hashedPassword
			},
			select: {
				id: true
			}
		})

		// Generate JWT token
		const token = signToken({ userId: user.id })

		res.status(201).json({
			message: "User created successfully",
			token
		})
	} catch (error) {
		res.status(500).json({ message: "Error creating user", error: error.message })
	}
}

// Controller: Login
exports.login = async (req, res) => {
	try {
		const { email, password } = req.body

		if (!email || !password) {
			return res.status(400).json({ message: "Email and password are required" })
		}

		// Find user
		const user = await prisma.user.findUnique({
			where: { email },
			select: {
				id: true,
				password: true
			}
		})
		if (!user) {
			return res.status(401).json({ message: "Invalid credentials" })
		}

		// Check password
		const isValidPassword = await bcrypt.compare(password, user.password)
		if (!isValidPassword) {
			return res.status(401).json({ message: "Invalid credentials" })
		}

		// Generate JWT token
		const token = signToken({ userId: user.id })

		res.json({ token })
	} catch (error) {
		res.status(500).json({ message: "Error logging in", error: error.message })
	}
}

// Controller: Get Profile
exports.getProfile = async (req, res) => {
	try {
		const user = await prisma.user.findUnique({
			where: { id: req.user.userId },
			select: {
				id: true,
				email: true,
				createdAt: true,
				updatedAt: true
			}
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
exports.updateProfile = async (req, res) => {
	try {
		const { email, password } = req.body
		const updateData = {}

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
			select: {
				id: true,
				email: true,
				createdAt: true,
				updatedAt: true
			}
		})
		res.json({ message: "Profile updated successfully", user })
	} catch (error) {
		res.status(500).json({ message: "Error updating profile", error: error.message })
	}
}

// Controller: Delete Account
exports.deleteAccount = async (req, res) => {
	try {
		await prisma.user.delete({
			where: { id: req.user.userId }
		})
		res.json({ message: "Account deleted successfully" })
	} catch (error) {
		res.status(500).json({ message: "Error deleting account", error: error.message })
	}
}
