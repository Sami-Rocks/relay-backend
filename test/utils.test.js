// Modules
const assert = require("node:assert/strict")
const { test } = require("node:test")

// Environment
process.env.JWT_SECRET = "relay-test-secret"

// Utilities
const { signToken, verifyToken } = require("../utils/jwt")
const {
	hasDuplicates,
	hasOwn,
	parseAmount,
	parseId,
	parseIdArray,
	parseList
} = require("../utils/request")

test("parseId accepts positive integers only", () => {
	assert.equal(parseId("12"), 12)
	assert.equal(parseId(1), 1)
	assert.equal(parseId(0), null)
	assert.equal(parseId(-1), null)
	assert.equal(parseId(1.5), null)
	assert.equal(parseId("not-a-number"), null)
})

test("parseIdArray validates every id", () => {
	assert.deepEqual(parseIdArray(["1", 2, "3"]), [1, 2, 3])
	assert.equal(parseIdArray([]), null)
	assert.equal(parseIdArray("1,2"), null)
	assert.equal(parseIdArray([1, 0]), null)
})

test("parseList supports arrays and comma-separated values", () => {
	assert.deepEqual(parseList(["A", "", "B"]), ["A", "B"])
	assert.deepEqual(parseList(" A, B, , C "), ["A", "B", "C"])
	assert.deepEqual(parseList(null), [])
})

test("parseAmount accepts finite non-negative amounts", () => {
	assert.equal(parseAmount("12.5"), 12.5)
	assert.equal(parseAmount(0), 0)
	assert.equal(parseAmount(""), null)
	assert.equal(parseAmount(-1), null)
	assert.equal(parseAmount("invalid"), null)
})

test("hasDuplicates and hasOwn report structured data correctly", () => {
	assert.equal(hasDuplicates([1, 2, 1]), true)
	assert.equal(hasDuplicates([1, 2, 3]), false)
	assert.equal(hasOwn({ value: undefined }, "value"), true)
	assert.equal(hasOwn({}, "value"), false)
})

test("JWT tokens round-trip signed payloads", () => {
	const token = signToken({ role: "owner", userId: 12 })
	const payload = verifyToken(token)

	assert.equal(payload.userId, 12)
	assert.equal(payload.role, "owner")
	assert.equal(typeof payload.iat, "number")
	assert.equal(typeof payload.exp, "number")
})

test("JWT verification rejects malformed and tampered tokens", () => {
	assert.throws(() => verifyToken("invalid"), /Invalid token/)

	const token = signToken({ userId: 12 })
	const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`

	assert.throws(() => verifyToken(tampered), /Invalid token/)
})

test("JWT verification rejects expired tokens", () => {
	const originalNow = Date.now
	const token = signToken({ userId: 12 })

	Date.now = () => originalNow() + (2 * 24 * 60 * 60 * 1000)

	try {
		assert.throws(() => verifyToken(token), /Token expired/)
	} finally {
		Date.now = originalNow
	}
})

test("JWT helpers require a configured secret", () => {
	const secret = process.env.JWT_SECRET

	delete process.env.JWT_SECRET

	try {
		assert.throws(() => signToken({ userId: 1 }), /JWT_SECRET environment variable is missing/)
	} finally {
		process.env.JWT_SECRET = secret
	}
})

test("Cloudinary helper ignores empty deletes and guards missing config", async () => {
	const environment = {
		apiKey: process.env.CLOUDINARY_API_KEY,
		apiSecret: process.env.CLOUDINARY_API_SECRET,
		cloudName: process.env.CLOUDINARY_CLOUD_NAME
	}

	delete process.env.CLOUDINARY_API_KEY
	delete process.env.CLOUDINARY_API_SECRET
	delete process.env.CLOUDINARY_CLOUD_NAME
	delete require.cache[require.resolve("../lib/cloudinary")]
	const { deleteImage, uploadImage } = require("../lib/cloudinary")

	try {
		assert.equal(await deleteImage(null), null)
		assert.throws(
			() => uploadImage({ buffer: Buffer.from("test") }, "relay/test"),
			/Cloudinary environment variables are missing/
		)
	} finally {
		if (environment.apiKey) process.env.CLOUDINARY_API_KEY = environment.apiKey
		if (environment.apiSecret) process.env.CLOUDINARY_API_SECRET = environment.apiSecret
		if (environment.cloudName) process.env.CLOUDINARY_CLOUD_NAME = environment.cloudName
	}
})

test("Cloudinary helper uploads buffers and deletes public ids", async () => {
	const cloudinarySdkPath = require.resolve("cloudinary")
	const cloudinaryHelperPath = require.resolve("../lib/cloudinary")
	const originalSdkCache = require.cache[cloudinarySdkPath]
	const originalEnvironment = {
		apiKey: process.env.CLOUDINARY_API_KEY,
		apiSecret: process.env.CLOUDINARY_API_SECRET,
		cloudName: process.env.CLOUDINARY_CLOUD_NAME
	}
	const calls = {
		config: [],
		destroy: [],
		end: [],
		upload: []
	}
	const result = {
		public_id: "relay/test/image",
		secure_url: "https://images.test/image.webp"
	}

	require.cache[cloudinarySdkPath] = {
		exports: {
			v2: {
				config: (options) => calls.config.push(options),
				uploader: {
					destroy: async (publicId) => {
						calls.destroy.push(publicId)
						return { result: "ok" }
					},
					upload_stream: (options, callback) => {
						calls.upload.push(options)
						return {
							end: (buffer) => {
								calls.end.push(buffer)
								callback(null, result)
							}
						}
					}
				}
			}
		},
		filename: cloudinarySdkPath,
		id: cloudinarySdkPath,
		loaded: true
	}

	process.env.CLOUDINARY_API_KEY = "test-key"
	process.env.CLOUDINARY_API_SECRET = "test-secret"
	process.env.CLOUDINARY_CLOUD_NAME = "test-cloud"
	delete require.cache[cloudinaryHelperPath]

	try {
		const { deleteImage, uploadImage } = require("../lib/cloudinary")
		const buffer = Buffer.from("image bytes")
		const uploadResult = await uploadImage({ buffer }, "relay/test")
		const deleteResult = await deleteImage("relay/test/image")

		assert.deepEqual(uploadResult, result)
		assert.deepEqual(deleteResult, { result: "ok" })
		assert.equal(calls.upload[0].folder, "relay/test")
		assert.equal(calls.upload[0].resource_type, "image")
		assert.equal(calls.end[0], buffer)
		assert.equal(calls.destroy[0], "relay/test/image")
	} finally {
		delete require.cache[cloudinaryHelperPath]
		if (originalSdkCache) {
			require.cache[cloudinarySdkPath] = originalSdkCache
		} else {
			delete require.cache[cloudinarySdkPath]
		}

		if (originalEnvironment.apiKey) process.env.CLOUDINARY_API_KEY = originalEnvironment.apiKey
		else delete process.env.CLOUDINARY_API_KEY
		if (originalEnvironment.apiSecret) process.env.CLOUDINARY_API_SECRET = originalEnvironment.apiSecret
		else delete process.env.CLOUDINARY_API_SECRET
		if (originalEnvironment.cloudName) process.env.CLOUDINARY_CLOUD_NAME = originalEnvironment.cloudName
		else delete process.env.CLOUDINARY_CLOUD_NAME
	}
})
