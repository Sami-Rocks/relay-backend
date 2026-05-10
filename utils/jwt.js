// Modules
const crypto = require("crypto")

// Variables
const tokenExpirySeconds = 60 * 60 * 24

// Function: Encode Base64 URL
function encodeBase64Url (value) {
	return Buffer.from(JSON.stringify(value)).toString("base64url")
}

// Function: Sign Data
function signData (data, secret) {
	return crypto
		.createHmac("sha256", secret)
		.update(data)
		.digest("base64url")
}

// Function: Get Secret
function getSecret () {
	if (!process.env.JWT_SECRET) {
		throw new Error("JWT_SECRET environment variable is missing")
	}

	return process.env.JWT_SECRET
}

// Function: Sign Token
function signToken (payload) {
	const secret = getSecret()
	const now = Math.floor(Date.now() / 1000)
	const header = encodeBase64Url({
		alg: "HS256",
		typ: "JWT"
	})
	const body = encodeBase64Url({
		...payload,
		iat: now,
		exp: now + tokenExpirySeconds
	})
	const signature = signData(`${header}.${body}`, secret)

	return `${header}.${body}.${signature}`
}

// Function: Verify Token
function verifyToken (token) {
	const secret = getSecret()
	const [header, body, signature] = token.split(".")

	if (!header || !body || !signature) {
		throw new Error("Invalid token")
	}

	const expectedSignature = signData(`${header}.${body}`, secret)
	const signatureBuffer = Buffer.from(signature)
	const expectedSignatureBuffer = Buffer.from(expectedSignature)

	if (
		signatureBuffer.length !== expectedSignatureBuffer.length
		|| !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
	) {
		throw new Error("Invalid token")
	}

	const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))

	if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
		throw new Error("Token expired")
	}

	return payload
}

// Export
module.exports = {
	signToken,
	verifyToken
}
