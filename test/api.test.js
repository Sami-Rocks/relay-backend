// Modules
const assert = require("node:assert/strict")
const crypto = require("node:crypto")
const http = require("node:http")
const { after, before, beforeEach, test } = require("node:test")
const bcrypt = require("bcryptjs")

// Environment
process.env.JWT_SECRET = "relay-test-secret"

// Function: Create Mock Method
function createMockMethod (defaultImplementation = async () => null) {
	let implementation = defaultImplementation

	async function method (...args) {
		method.calls.push(args)
		return implementation(...args)
	}

	method.calls = []
	method.reset = (nextImplementation = defaultImplementation) => {
		method.calls = []
		implementation = nextImplementation
	}
	method.setImplementation = (nextImplementation) => {
		implementation = nextImplementation
	}

	return method
}

// Prisma Mock
const prisma = {
	$queryRaw: createMockMethod(async () => []),
	form: {
		create: createMockMethod(),
		delete: createMockMethod(),
		findFirst: createMockMethod(),
		findMany: createMockMethod(async () => []),
		update: createMockMethod()
	},
	formAnswer: {
		findMany: createMockMethod(async () => [])
	},
	formSubmission: {
		create: createMockMethod(),
		findFirst: createMockMethod()
	},
	user: {
		create: createMockMethod(),
		findUnique: createMockMethod(),
		update: createMockMethod()
	}
}

// Cloudinary Mock
const cloudinary = {
	deleteImage: createMockMethod(async () => null),
	uploadImage: createMockMethod()
}

// Mock Prisma before loading routes and controllers.
const prismaModulePath = require.resolve("../lib/prisma")
require.cache[prismaModulePath] = {
	exports: prisma,
	filename: prismaModulePath,
	id: prismaModulePath,
	loaded: true
}

const cloudinaryModulePath = require.resolve("../lib/cloudinary")
require.cache[cloudinaryModulePath] = {
	exports: cloudinary,
	filename: cloudinaryModulePath,
	id: cloudinaryModulePath,
	loaded: true
}

const app = require("../app")
const { signToken } = require("../utils/jwt")

// Variables
let baseUrl
let server

// Function: Reset Prisma
function resetPrisma () {
	Object.values(prisma).forEach((model) => {
		if (typeof model === "function" && model.reset) {
			model.reset()
			return
		}

		if (!model || typeof model !== "object") return

		Object.values(model).forEach((method) => {
			if (method?.reset) method.reset()
		})
	})

	Object.values(cloudinary).forEach((method) => method.reset())
}

// Function: API Request
async function request (path, options = {}) {
	const headers = {
		...options.headers
	}

	if (options.body !== undefined && !options.formData) headers["content-type"] = "application/json"
	if (options.token) headers.authorization = `Bearer ${options.token}`

	const response = await fetch(`${baseUrl}${path}`, {
		body: options.formData || (options.body === undefined ? undefined : JSON.stringify(options.body)),
		headers,
		method: options.method || "GET"
	})
	const text = await response.text()

	return {
		body: text ? JSON.parse(text) : null,
		status: response.status
	}
}

// Fixtures
function createUser (overrides = {}) {
	return {
		id: 1,
		email: "owner@relay.test",
		firstName: "Relay",
		lastName: "Owner",
		createdAt: new Date("2026-06-01T00:00:00.000Z"),
		updatedAt: new Date("2026-06-01T00:00:00.000Z"),
		...overrides
	}
}

function createPublicPoll (overrides = {}) {
	return {
		id: 12,
		allowAnonymous: true,
		allowMultipleSubmissions: false,
		allowMultipleVotes: false,
		duplicateProtection: "BROWSER",
		requireLogin: false,
		status: "PUBLISHED",
		fields: [
			{
				id: 101,
				label: "Choose one",
				required: true,
				type: "MULTIPLE_CHOICE",
				options: [
					{ value: "Alpha" },
					{ value: "Beta" }
				]
			}
		],
		...overrides
	}
}

function createForm (overrides = {}) {
	return {
		id: 12,
		userId: 1,
		kind: "FORM",
		status: "DRAFT",
		title: "Registration form",
		description: "Test form",
		requireLogin: false,
		allowAnonymous: true,
		allowMultipleSubmissions: false,
		allowMultipleVotes: false,
		duplicateProtection: "BROWSER",
		coverImagePublicId: null,
		coverImageUrl: null,
		fields: [],
		...overrides
	}
}

function authenticate (user = createUser()) {
	prisma.user.findUnique.setImplementation(async ({ where }) => {
		return where.id === user.id ? user : null
	})

	return signToken({ userId: user.id })
}

// Setup
before(async () => {
	server = http.createServer(app)
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
	const address = server.address()

	baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
	await new Promise((resolve, reject) => {
		server.close((error) => error ? reject(error) : resolve())
	})
})

beforeEach(() => {
	resetPrisma()
})

// Tests: General
test("GET /health reports a healthy API", async () => {
	const response = await request("/health")

	assert.equal(response.status, 200)
	assert.deepEqual(response.body, { status: "ok" })
})

test("GET / reports API identity", async () => {
	const response = await request("/")

	assert.equal(response.status, 200)
	assert.deepEqual(response.body, { name: "relay-api", status: "ok" })
})

test("malformed JSON reaches the global error handler", async () => {
	const originalError = console.error
	console.error = () => {}

	try {
		const response = await fetch(`${baseUrl}/api/users/login`, {
			body: "{",
			headers: { "content-type": "application/json" },
			method: "POST"
		})

		assert.equal(response.status, 500)
		assert.deepEqual(await response.json(), { message: "Internal server error" })
	} finally {
		console.error = originalError
	}
})

test("unknown routes return a JSON 404", async () => {
	const response = await request("/not-a-route")

	assert.equal(response.status, 404)
	assert.deepEqual(response.body, { message: "Route not found" })
})

test("protected form routes require authentication", async () => {
	const response = await request("/api/forms")

	assert.equal(response.status, 401)
	assert.deepEqual(response.body, { message: "Authentication required" })
})

// Tests: Users
test("registration rejects missing credentials", async () => {
	const response = await request("/api/users/register", {
		body: { email: "owner@relay.test" },
		method: "POST"
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Email and password are required")
})

test("registration creates a safe user and token", async () => {
	const user = createUser()

	prisma.user.findUnique.setImplementation(async () => null)
	prisma.user.create.setImplementation(async () => user)

	const response = await request("/api/users/register", {
		body: {
			email: user.email,
			firstName: user.firstName,
			password: "password123"
		},
		method: "POST"
	})

	assert.equal(response.status, 201)
	assert.equal(response.body.user.email, user.email)
	assert.equal(response.body.user.password, undefined)
	assert.equal(typeof response.body.token, "string")
	assert.equal(prisma.user.create.calls.length, 1)
	assert.notEqual(prisma.user.create.calls[0][0].data.password, "password123")
})

test("login rejects an invalid password", async () => {
	const password = await bcrypt.hash("correct-password", 4)

	prisma.user.findUnique.setImplementation(async () => createUser({ password }))

	const response = await request("/api/users/login", {
		body: {
			email: "owner@relay.test",
			password: "wrong-password"
		},
		method: "POST"
	})

	assert.equal(response.status, 401)
	assert.equal(response.body.message, "Invalid credentials")
})

test("login returns a token without exposing the password", async () => {
	const password = await bcrypt.hash("password123", 4)

	prisma.user.findUnique.setImplementation(async () => createUser({ password }))

	const response = await request("/api/users/login", {
		body: {
			email: "owner@relay.test",
			password: "password123"
		},
		method: "POST"
	})

	assert.equal(response.status, 200)
	assert.equal(typeof response.body.token, "string")
	assert.equal(response.body.user.password, undefined)
})

// Tests: Form Rules
test("poll creation rejects more than one question", async () => {
	const user = createUser()
	const token = signToken({ userId: user.id })

	prisma.user.findUnique.setImplementation(async () => user)

	const response = await request("/api/forms", {
		body: {
			kind: "POLL",
			title: "Favourite option",
			fields: [
				{ label: "First", options: ["A", "B"], type: "MULTIPLE_CHOICE" },
				{ label: "Second", options: ["C", "D"], type: "MULTIPLE_CHOICE" }
			]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Polls can only have one question")
	assert.equal(prisma.form.create.calls.length, 0)
})

test("valid poll creation forces a required multiple-choice question", async () => {
	const user = createUser()
	const token = signToken({ userId: user.id })

	prisma.user.findUnique.setImplementation(async () => user)
	prisma.form.create.setImplementation(async ({ data }) => ({ id: 12, ...data }))

	const response = await request("/api/forms", {
		body: {
			kind: "POLL",
			title: "Favourite option",
			fields: [
				{ label: "Choose", options: ["Alpha", "Beta"], required: false, type: "MULTIPLE_CHOICE" }
			]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 201)
	assert.equal(prisma.form.create.calls.length, 1)
	const data = prisma.form.create.calls[0][0].data

	assert.equal(data.kind, "POLL")
	assert.equal(data.fields.create[0].required, true)
	assert.deepEqual(
		data.fields.create[0].options.create.map((option) => option.value),
		["Alpha", "Beta"]
	)
})

// Tests: Submissions
test("anonymous browser-protected submissions require a token", async () => {
	prisma.form.findFirst.setImplementation(async () => createPublicPoll())

	const response = await request("/api/forms/12/submissions", {
		body: {
			answers: [{ fieldId: 101, value: "Alpha" }]
		},
		method: "POST"
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Anonymous submission token is required")
	assert.equal(prisma.formSubmission.create.calls.length, 0)
})

test("anonymous duplicate submissions are rejected", async () => {
	prisma.form.findFirst.setImplementation(async () => createPublicPoll())
	prisma.formSubmission.findFirst.setImplementation(async () => ({ id: 88 }))

	const response = await request("/api/forms/12/submissions", {
		body: {
			answers: [{ fieldId: 101, value: "Alpha" }]
		},
		headers: {
			"x-anonymous-token": "browser-123"
		},
		method: "POST"
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "You have already submitted this form")
	assert.equal(prisma.formSubmission.create.calls.length, 0)
})

test("submission validation rejects an unknown poll option", async () => {
	prisma.form.findFirst.setImplementation(async () => createPublicPoll())
	prisma.formSubmission.findFirst.setImplementation(async () => null)

	const response = await request("/api/forms/12/submissions", {
		body: {
			answers: [{ fieldId: 101, value: "Unknown" }]
		},
		headers: {
			"x-anonymous-token": "browser-123"
		},
		method: "POST"
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Choose one has an invalid option")
	assert.equal(prisma.formSubmission.create.calls.length, 0)
})

test("valid anonymous submissions store a hashed browser token", async () => {
	const submission = {
		id: 88,
		formId: 12,
		respondentId: null,
		answers: [{ fieldId: 101, value: "Alpha" }]
	}

	prisma.form.findFirst.setImplementation(async () => createPublicPoll())
	prisma.formSubmission.findFirst.setImplementation(async () => null)
	prisma.formSubmission.create.setImplementation(async () => submission)

	const response = await request("/api/forms/12/submissions", {
		body: {
			answers: [{ fieldId: 101, value: "Alpha" }]
		},
		headers: {
			"x-anonymous-token": "browser-123"
		},
		method: "POST"
	})

	assert.equal(response.status, 201)
	assert.equal(response.body.id, submission.id)
	assert.equal(prisma.formSubmission.create.calls.length, 1)

	const data = prisma.formSubmission.create.calls[0][0].data
	const expectedHash = crypto.createHash("sha256").update("browser-123").digest("hex")

	assert.equal(data.anonymousTokenHash, expectedHash)
	assert.equal(data.respondentId, null)
	assert.deepEqual(data.answers.create, [{ fieldId: 101, value: "Alpha" }])
})

test("forms that require login reject anonymous submissions", async () => {
	prisma.form.findFirst.setImplementation(async () => createPublicPoll({
		allowAnonymous: false,
		requireLogin: true
	}))

	const response = await request("/api/forms/12/submissions", {
		body: {
			answers: [{ fieldId: 101, value: "Alpha" }]
		},
		method: "POST"
	})

	assert.equal(response.status, 401)
	assert.equal(response.body.message, "Authentication required")
})

// Tests: Authentication and Profiles
test("invalid bearer tokens are rejected", async () => {
	const response = await request("/api/users/profile", {
		token: "not-a-valid-token"
	})

	assert.equal(response.status, 401)
	assert.equal(response.body.message, "Invalid or expired token")
})

test("registration rejects an existing email", async () => {
	prisma.user.findUnique.setImplementation(async () => ({ id: 1 }))

	const response = await request("/api/users/register", {
		body: {
			email: "owner@relay.test",
			password: "password123"
		},
		method: "POST"
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "User already exists")
})

test("login rejects an unknown user", async () => {
	prisma.user.findUnique.setImplementation(async () => null)

	const response = await request("/api/users/login", {
		body: {
			email: "missing@relay.test",
			password: "password123"
		},
		method: "POST"
	})

	assert.equal(response.status, 401)
	assert.equal(response.body.message, "Invalid credentials")
})

test("login rejects missing credentials", async () => {
	const response = await request("/api/users/login", {
		body: { email: "owner@relay.test" },
		method: "POST"
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Email and password are required")
})

test("profile returns the authenticated user", async () => {
	const user = createUser()
	const token = authenticate(user)
	const response = await request("/api/users/profile", { token })

	assert.equal(response.status, 200)
	assert.equal(response.body.email, user.email)
	assert.equal(response.body.password, undefined)
})

test("profile returns 401 when the token user no longer exists", async () => {
	const token = signToken({ userId: 999 })
	prisma.user.findUnique.setImplementation(async () => null)

	const response = await request("/api/users/profile", { token })

	assert.equal(response.status, 401)
	assert.equal(response.body.message, "Invalid or expired token")
})

test("profile returns 404 when the user disappears after authentication", async () => {
	const user = createUser()
	const token = signToken({ userId: user.id })
	let calls = 0

	prisma.user.findUnique.setImplementation(async () => {
		calls += 1
		return calls === 1 ? user : null
	})

	const response = await request("/api/users/profile", { token })

	assert.equal(response.status, 404)
	assert.equal(response.body.message, "User not found")
})

test("profile update rejects an empty update", async () => {
	const token = authenticate()
	const response = await request("/api/users/profile", {
		body: {},
		method: "PUT",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "No profile changes provided")
})

test("profile update hashes a new password", async () => {
	const user = createUser({ firstName: "Updated" })
	const token = authenticate()

	prisma.user.update.setImplementation(async () => user)

	const response = await request("/api/users/profile", {
		body: {
			firstName: "Updated",
			password: "new-password"
		},
		method: "PUT",
		token
	})

	assert.equal(response.status, 200)
	assert.equal(response.body.user.firstName, "Updated")
	const data = prisma.user.update.calls[0][0].data

	assert.equal(data.firstName, "Updated")
	assert.notEqual(data.password, "new-password")
	assert.equal(await bcrypt.compare("new-password", data.password), true)
})

// Tests: Form Queries
test("form listing normalizes and applies filters", async () => {
	const token = authenticate()
	const forms = [createForm({ kind: "SURVEY", status: "PUBLISHED" })]

	prisma.form.findMany.setImplementation(async () => forms)

	const response = await request("/api/forms?kind=survey&status=published&q=registration", { token })

	assert.equal(response.status, 200)
	assert.equal(response.body.length, 1)
	const query = prisma.form.findMany.calls[0][0]

	assert.equal(query.where.userId, 1)
	assert.equal(query.where.kind, "SURVEY")
	assert.equal(query.where.status, "PUBLISHED")
	assert.equal(query.where.OR[0].title.contains, "registration")
})

test("form listing rejects invalid filters", async () => {
	const token = authenticate()
	const response = await request("/api/forms?kind=quiz", { token })

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Invalid form filters")
	assert.equal(prisma.form.findMany.calls.length, 0)
})

test("single form rejects an invalid id", async () => {
	const token = authenticate()
	const response = await request("/api/forms/not-a-number", { token })

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Invalid form id")
})

test("single form returns 404 outside the owner scope", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => null)

	const response = await request("/api/forms/12", { token })

	assert.equal(response.status, 404)
	assert.equal(response.body.message, "Form not found")
})

test("single form returns the owned form", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => createForm())

	const response = await request("/api/forms/12", { token })

	assert.equal(response.status, 200)
	assert.equal(response.body.id, 12)
	assert.deepEqual(prisma.form.findFirst.calls[0][0].where, { id: 12, userId: 1 })
})

test("public form listing only queries published forms", async () => {
	prisma.form.findMany.setImplementation(async () => [createForm({ status: "PUBLISHED" })])

	const response = await request("/api/forms/public?kind=form&search=registration")

	assert.equal(response.status, 200)
	const query = prisma.form.findMany.calls[0][0]

	assert.equal(query.where.status, "PUBLISHED")
	assert.equal(query.where.kind, "FORM")
	assert.equal(query.where.OR[1].description.contains, "registration")
})

test("public form listing rejects an invalid kind", async () => {
	const response = await request("/api/forms/public?kind=quiz")

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Invalid form filters")
})

test("public form lookup requires a valid published form", async () => {
	let response = await request("/api/forms/public/nope")

	assert.equal(response.status, 400)

	prisma.form.findFirst.setImplementation(async () => null)
	response = await request("/api/forms/public/12")

	assert.equal(response.status, 404)
	assert.equal(response.body.message, "Form not found")
})

test("public form lookup returns a published form", async () => {
	prisma.form.findFirst.setImplementation(async () => createForm({ status: "PUBLISHED" }))

	const response = await request("/api/forms/public/12")

	assert.equal(response.status, 200)
	assert.equal(response.body.status, "PUBLISHED")
	assert.deepEqual(prisma.form.findFirst.calls[0][0].where, { id: 12, status: "PUBLISHED" })
})

// Tests: Form Validation and Mutations
test("form creation requires a title and valid fields", async () => {
	const token = authenticate()
	const response = await request("/api/forms", {
		body: {
			title: "",
			fields: [{ label: "Question", type: "SHORT_TEXT" }]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Title and valid fields are required")
})

test("multiple choice fields require at least two options", async () => {
	const token = authenticate()
	const response = await request("/api/forms", {
		body: {
			title: "Survey",
			fields: [{ label: "Question", options: ["Only"], type: "MULTIPLE_CHOICE" }]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Title and valid fields are required")
})

test("form fields require supported types and non-empty labels", async () => {
	const token = authenticate()
	let response = await request("/api/forms", {
		body: {
			title: "Form",
			fields: [{ label: "", type: "SHORT_TEXT" }]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 400)

	response = await request("/api/forms", {
		body: {
			title: "Form",
			fields: [{ label: "Question", type: "DATE" }]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 400)
})

test("polls require a multiple-choice question", async () => {
	const token = authenticate()
	const response = await request("/api/forms", {
		body: {
			kind: "POLL",
			title: "Poll",
			fields: [{ label: "Question", type: "SHORT_TEXT" }]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Polls must use a multiple choice question")
})

test("login-required forms cannot allow anonymous submissions", async () => {
	const token = authenticate()
	const response = await request("/api/forms", {
		body: {
			allowAnonymous: true,
			requireLogin: true,
			title: "Private form",
			fields: [{ label: "Question", type: "SHORT_TEXT" }]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Forms that require login cannot allow anonymous submissions")
})

test("form update rejects invalid ids, missing forms, and empty changes", async () => {
	const token = authenticate()
	let response = await request("/api/forms/nope", {
		body: { title: "Updated" },
		method: "PUT",
		token
	})

	assert.equal(response.status, 400)

	prisma.form.findFirst.setImplementation(async () => null)
	response = await request("/api/forms/12", {
		body: { title: "Updated" },
		method: "PUT",
		token
	})

	assert.equal(response.status, 404)

	prisma.form.findFirst.setImplementation(async () => createForm())
	response = await request("/api/forms/12", {
		body: {},
		method: "PUT",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "No form changes provided")
})

test("form update replaces fields when fields are supplied", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => createForm())
	prisma.form.update.setImplementation(async ({ data }) => createForm({ ...data, id: 12 }))

	const response = await request("/api/forms/12", {
		body: {
			title: "Updated title",
			fields: [{ label: "New question", required: true, type: "LONG_TEXT" }]
		},
		method: "PUT",
		token
	})

	assert.equal(response.status, 200)
	const data = prisma.form.update.calls[0][0].data

	assert.equal(data.title, "Updated title")
	assert.deepEqual(data.fields.deleteMany, {})
	assert.equal(data.fields.create[0].type, "LONG_TEXT")
})

test("form update rejects invalid data and kind rules", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => createForm())

	let response = await request("/api/forms/12", {
		body: { status: "invalid" },
		method: "PUT",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Invalid form data")

	response = await request("/api/forms/12", {
		body: { fields: "not-an-array" },
		method: "PUT",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Invalid form data")

	response = await request("/api/forms/12", {
		body: {
			kind: "POLL",
			fields: [
				{ label: "One", options: ["A", "B"], type: "MULTIPLE_CHOICE" },
				{ label: "Two", options: ["A", "B"], type: "MULTIPLE_CHOICE" }
			]
		},
		method: "PUT",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Polls can only have one question")
})

test("form deletion is owner-scoped and removes the cover", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => createForm({ coverImagePublicId: "relay/cover" }))
	prisma.form.delete.setImplementation(async () => createForm())

	const response = await request("/api/forms/12", {
		method: "DELETE",
		token
	})

	assert.equal(response.status, 200)
	assert.equal(response.body.message, "Form deleted successfully")
	assert.deepEqual(prisma.form.delete.calls[0][0].where, { id: 12 })
	assert.equal(cloudinary.deleteImage.calls[0][0], "relay/cover")
})

test("form deletion rejects missing forms", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => null)

	const response = await request("/api/forms/12", {
		method: "DELETE",
		token
	})

	assert.equal(response.status, 404)
	assert.equal(prisma.form.delete.calls.length, 0)
})

test("form deletion rejects an invalid id", async () => {
	const token = authenticate()
	const response = await request("/api/forms/nope", {
		method: "DELETE",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Invalid form id")
})

// Tests: Covers and Upload Middleware
test("cover upload requires an image", async () => {
	const token = authenticate()
	const response = await request("/api/forms/12/cover", {
		method: "POST",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Cover image is required")
})

test("cover upload rejects an invalid form id", async () => {
	const token = authenticate()
	const formData = new FormData()

	formData.append("image", new Blob(["image"], { type: "image/png" }), "cover.png")
	const response = await request("/api/forms/nope/cover", {
		formData,
		method: "POST",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Invalid form id")
})

test("cover upload rejects unsupported file types", async () => {
	const token = authenticate()
	const formData = new FormData()

	formData.append("image", new Blob(["not an image"], { type: "text/plain" }), "cover.txt")

	const response = await request("/api/forms/12/cover", {
		formData,
		method: "POST",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Only JPEG, PNG, and WEBP images are allowed")
})

test("cover upload stores the Cloudinary result and removes the previous image", async () => {
	const token = authenticate()
	const formData = new FormData()
	const updatedForm = createForm({
		coverImagePublicId: "relay/forms/new-cover",
		coverImageUrl: "https://images.test/new-cover.webp"
	})

	formData.append("image", new Blob(["image bytes"], { type: "image/webp" }), "cover.webp")
	prisma.form.findFirst.setImplementation(async () => createForm({ coverImagePublicId: "relay/forms/old-cover" }))
	prisma.form.update.setImplementation(async () => updatedForm)
	cloudinary.uploadImage.setImplementation(async () => ({
		public_id: "relay/forms/new-cover",
		secure_url: "https://images.test/new-cover.webp"
	}))

	const response = await request("/api/forms/12/cover", {
		formData,
		method: "POST",
		token
	})

	assert.equal(response.status, 200)
	assert.equal(response.body.coverImageUrl, updatedForm.coverImageUrl)
	assert.equal(cloudinary.uploadImage.calls[0][1], "relay/forms")
	assert.equal(cloudinary.deleteImage.calls[0][0], "relay/forms/old-cover")
	assert.deepEqual(prisma.form.update.calls[0][0].data, {
		coverImagePublicId: "relay/forms/new-cover",
		coverImageUrl: "https://images.test/new-cover.webp"
	})
})

test("cover deletion clears stored cover values", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => createForm({ coverImagePublicId: "relay/forms/cover" }))
	prisma.form.update.setImplementation(async () => createForm())

	const response = await request("/api/forms/12/cover", {
		method: "DELETE",
		token
	})

	assert.equal(response.status, 200)
	assert.deepEqual(prisma.form.update.calls[0][0].data, {
		coverImagePublicId: null,
		coverImageUrl: null
	})
	assert.equal(cloudinary.deleteImage.calls[0][0], "relay/forms/cover")
})

// Tests: Submission Queries and Authenticated Submissions
test("submission results reject invalid and unowned form ids", async () => {
	const token = authenticate()
	let response = await request("/api/forms/nope/submissions", { token })

	assert.equal(response.status, 400)

	prisma.form.findFirst.setImplementation(async () => null)
	response = await request("/api/forms/12/submissions", { token })

	assert.equal(response.status, 404)
	assert.equal(response.body.message, "Form not found")
})

test("submission result flags can skip rows and summaries", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => ({ id: 12 }))

	const response = await request("/api/forms/12/submissions?summary=false&submissions=false", { token })

	assert.equal(response.status, 200)
	assert.deepEqual(response.body, { submissions: [], summary: null })
	assert.equal(prisma.$queryRaw.calls.length, 0)
	assert.equal(prisma.formAnswer.findMany.calls.length, 0)
})

test("submission results return rows and aggregate summaries", async () => {
	const token = authenticate()
	const form = createForm({
		fields: [
			{
				id: 101,
				type: "MULTIPLE_CHOICE",
				options: [{ value: "Alpha" }, { value: "Beta" }]
			},
			{
				id: 102,
				type: "LONG_TEXT",
				options: []
			}
		]
	})
	const submissions = [{ id: 88, answers: [], respondent: null }]

	prisma.form.findFirst.setImplementation(async () => form)
	prisma.$queryRaw.setImplementation(async (strings) => {
		const sql = strings.join(" ")

		if (sql.includes("COUNT(*)")) {
			return [{ end: new Date("2026-06-02"), registered: 1, start: new Date("2026-06-01"), total: 3 }]
		}

		return submissions
	})
	prisma.formAnswer.findMany.setImplementation(async () => [
		{ id: 1, fieldId: 101, value: "Alpha" },
		{ id: 2, fieldId: 101, value: "Alpha" },
		{ id: 3, fieldId: 101, value: "Beta" },
		{ id: 4, fieldId: 102, value: "Useful feedback" }
	])

	const response = await request("/api/forms/12/submissions?sort=oldest", { token })

	assert.equal(response.status, 200)
	assert.equal(response.body.submissions.length, 1)
	assert.equal(response.body.summary.totalSubmissions, 3)
	assert.equal(response.body.summary.registeredSubmissions, 1)
	assert.equal(response.body.summary.anonymousSubmissions, 2)
	assert.deepEqual(response.body.summary.choices[0].options, [
		{ count: 2, label: "Alpha" },
		{ count: 1, label: "Beta" }
	])
	assert.equal(response.body.summary.text[0].responses[0].value, "Useful feedback")
})

test("authenticated submissions store the respondent and do not hash a browser token", async () => {
	const user = createUser()
	const token = authenticate(user)
	prisma.form.findFirst.setImplementation(async () => createPublicPoll({
		allowAnonymous: false,
		requireLogin: true
	}))
	prisma.formSubmission.findFirst.setImplementation(async () => null)
	prisma.formSubmission.create.setImplementation(async () => ({ id: 88, respondentId: user.id }))

	const response = await request("/api/forms/12/submissions", {
		body: {
			answers: [{ fieldId: 101, value: "Alpha" }]
		},
		headers: {
			"x-anonymous-token": "ignored-token"
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 201)
	const data = prisma.formSubmission.create.calls[0][0].data

	assert.equal(data.respondentId, user.id)
	assert.equal(data.anonymousTokenHash, null)
})

test("multiple submissions skip duplicate lookup", async () => {
	prisma.form.findFirst.setImplementation(async () => createPublicPoll({
		allowMultipleSubmissions: true
	}))
	prisma.formSubmission.create.setImplementation(async () => ({ id: 88 }))

	const response = await request("/api/forms/12/submissions", {
		body: {
			answers: [{ fieldId: 101, value: "Beta" }]
		},
		method: "POST"
	})

	assert.equal(response.status, 201)
	assert.equal(prisma.formSubmission.findFirst.calls.length, 0)
})

test("submission validation rejects missing, duplicate, and invalid fields", async () => {
	prisma.form.findFirst.setImplementation(async () => createPublicPoll({
		allowMultipleSubmissions: true
	}))

	let response = await request("/api/forms/12/submissions", {
		body: {},
		method: "POST"
	})

	assert.equal(response.body.message, "Answers are required")

	response = await request("/api/forms/12/submissions", {
		body: {
			answers: [
				{ fieldId: 101, value: "Alpha" },
				{ fieldId: 101, value: "Beta" }
			]
		},
		method: "POST"
	})

	assert.equal(response.body.message, "Duplicate answer field")

	response = await request("/api/forms/12/submissions", {
		body: {
			answers: [{ fieldId: 999, value: "Alpha" }]
		},
		method: "POST"
	})

	assert.equal(response.body.message, "Invalid answer field")
})

test("LOGIN duplicate protection requires authentication", async () => {
	prisma.form.findFirst.setImplementation(async () => createPublicPoll({
		duplicateProtection: "LOGIN"
	}))

	const response = await request("/api/forms/12/submissions", {
		body: {
			answers: [{ fieldId: 101, value: "Alpha" }]
		},
		method: "POST"
	})

	assert.equal(response.status, 401)
	assert.equal(response.body.message, "Login is required to prevent duplicate submissions")
})

test("NONE duplicate protection allows anonymous submissions without a token", async () => {
	prisma.form.findFirst.setImplementation(async () => createPublicPoll({
		duplicateProtection: "NONE"
	}))
	prisma.formSubmission.create.setImplementation(async () => ({ id: 88 }))

	const response = await request("/api/forms/12/submissions", {
		body: { answers: [{ fieldId: 101, value: "Alpha" }] },
		method: "POST"
	})

	assert.equal(response.status, 201)
	assert.equal(prisma.formSubmission.findFirst.calls.length, 0)
})

test("submission creation validates ids and published form existence", async () => {
	let response = await request("/api/forms/nope/submissions", {
		body: { answers: [] },
		method: "POST"
	})

	assert.equal(response.status, 400)

	prisma.form.findFirst.setImplementation(async () => null)
	response = await request("/api/forms/12/submissions", {
		body: { answers: [] },
		method: "POST"
	})

	assert.equal(response.status, 404)
	assert.equal(response.body.message, "Form not found")
})

test("optional authentication ignores invalid tokens", async () => {
	prisma.form.findFirst.setImplementation(async () => createPublicPoll({
		allowMultipleSubmissions: true
	}))
	prisma.formSubmission.create.setImplementation(async () => ({ id: 88 }))

	const response = await request("/api/forms/12/submissions", {
		body: { answers: [{ fieldId: 101, value: "Alpha" }] },
		method: "POST",
		token: "invalid-token"
	})

	assert.equal(response.status, 201)
})

// Tests: Error Mapping
test("controller database errors return structured 500 responses", async () => {
	const token = authenticate()
	prisma.form.findMany.setImplementation(async () => {
		throw new Error("database unavailable")
	})

	const response = await request("/api/forms", { token })

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error fetching forms")
	assert.equal(response.body.error, "database unavailable")
})

test("form read failures return structured 500 responses", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => {
		throw new Error("read unavailable")
	})

	let response = await request("/api/forms/12", { token })
	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error fetching form")

	response = await request("/api/forms/public/12")
	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error fetching form")

	prisma.form.findMany.setImplementation(async () => {
		throw new Error("public list unavailable")
	})
	response = await request("/api/forms/public")
	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error fetching forms")
})

test("user controller failures return structured 500 responses", async () => {
	prisma.user.findUnique.setImplementation(async () => {
		throw new Error("user database unavailable")
	})

	let response = await request("/api/users/register", {
		body: { email: "new@relay.test", password: "password123" },
		method: "POST"
	})

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error creating user")

	response = await request("/api/users/login", {
		body: { email: "owner@relay.test", password: "password123" },
		method: "POST"
	})

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error logging in")
})

test("profile controller failures return structured 500 responses", async () => {
	const user = createUser()
	const token = signToken({ userId: user.id })
	let calls = 0

	prisma.user.findUnique.setImplementation(async () => {
		calls += 1
		if (calls === 1) return user
		throw new Error("profile unavailable")
	})

	let response = await request("/api/users/profile", { token })

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error fetching profile")

	prisma.user.findUnique.setImplementation(async () => user)
	prisma.user.update.setImplementation(async () => {
		throw new Error("update unavailable")
	})

	response = await request("/api/users/profile", {
		body: { firstName: "Updated" },
		method: "PUT",
		token
	})

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error updating profile")
})

test("form mutation failures return structured 500 responses", async () => {
	const token = authenticate()

	prisma.form.create.setImplementation(async () => {
		throw new Error("create failed")
	})
	let response = await request("/api/forms", {
		body: {
			title: "Form",
			fields: [{ label: "Question", type: "SHORT_TEXT" }]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error creating form")

	prisma.form.findFirst.setImplementation(async () => createForm())
	prisma.form.update.setImplementation(async () => {
		throw new Error("update failed")
	})
	response = await request("/api/forms/12", {
		body: { title: "Updated" },
		method: "PUT",
		token
	})

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error updating form")

	prisma.form.delete.setImplementation(async () => {
		throw new Error("delete failed")
	})
	response = await request("/api/forms/12", {
		method: "DELETE",
		token
	})

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error deleting form")
})

test("cover routes validate ids and owner scope", async () => {
	const token = authenticate()
	let response = await request("/api/forms/nope/cover", {
		method: "DELETE",
		token
	})

	assert.equal(response.status, 400)

	prisma.form.findFirst.setImplementation(async () => null)
	response = await request("/api/forms/12/cover", {
		method: "DELETE",
		token
	})

	assert.equal(response.status, 404)

	const formData = new FormData()
	formData.append("image", new Blob(["image"], { type: "image/png" }), "cover.png")
	response = await request("/api/forms/12/cover", {
		formData,
		method: "POST",
		token
	})

	assert.equal(response.status, 404)
})

test("cover operation failures return structured 500 responses", async () => {
	const token = authenticate()
	const formData = new FormData()

	formData.append("image", new Blob(["image"], { type: "image/png" }), "cover.png")
	prisma.form.findFirst.setImplementation(async () => createForm())
	cloudinary.uploadImage.setImplementation(async () => {
		throw new Error("upload failed")
	})

	let response = await request("/api/forms/12/cover", {
		formData,
		method: "POST",
		token
	})

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error uploading form cover")

	prisma.form.update.setImplementation(async () => {
		throw new Error("cover delete failed")
	})
	response = await request("/api/forms/12/cover", {
		method: "DELETE",
		token
	})

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error deleting form cover")
})

test("submission failures return structured 500 responses", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => {
		throw new Error("submission lookup failed")
	})

	let response = await request("/api/forms/12/submissions", { token })

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error fetching submissions")

	response = await request("/api/forms/12/submissions", {
		body: { answers: [] },
		method: "POST"
	})

	assert.equal(response.status, 500)
	assert.equal(response.body.message, "Error submitting form")
})

test("submission validation rejects missing required answers", async () => {
	prisma.form.findFirst.setImplementation(async () => createPublicPoll({
		allowMultipleSubmissions: true
	}))

	const response = await request("/api/forms/12/submissions", {
		body: { answers: [] },
		method: "POST"
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Choose one is required")
})

test("empty submission summaries return zeroed defaults", async () => {
	const token = authenticate()
	prisma.form.findFirst.setImplementation(async () => createForm({ fields: [] }))
	prisma.$queryRaw.setImplementation(async () => [])

	const response = await request("/api/forms/12/submissions?submissions=false", { token })

	assert.equal(response.status, 200)
	assert.deepEqual(response.body.summary, {
		anonymousSubmissions: 0,
		choices: [],
		dateRange: { end: null, start: null },
		registeredSubmissions: 0,
		text: [],
		totalSubmissions: 0
	})
})

test("form data accepts aliases and rejects invalid enums", async () => {
	const token = authenticate()
	prisma.form.create.setImplementation(async ({ data }) => ({ id: 12, ...data }))

	let response = await request("/api/forms", {
		body: {
			allowMultipleVotes: true,
			duplicateProtection: "none",
			status: "published",
			title: "Form",
			fields: [{ label: "Question", type: "SHORT_TEXT" }]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 201)
	const data = prisma.form.create.calls[0][0].data
	assert.equal(data.allowMultipleSubmissions, true)
	assert.equal(data.allowMultipleVotes, true)
	assert.equal(data.duplicateProtection, "NONE")

	response = await request("/api/forms", {
		body: {
			status: "unknown",
			title: "Form",
			fields: [{ label: "Question", type: "SHORT_TEXT" }]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 400)
	assert.equal(response.body.message, "Title and valid fields are required")
})

test("allowMultipleSubmissions mirrors the legacy vote field", async () => {
	const token = authenticate()
	prisma.form.create.setImplementation(async ({ data }) => ({ id: 12, ...data }))

	const response = await request("/api/forms", {
		body: {
			allowMultipleSubmissions: true,
			title: "Form",
			fields: [{ label: "Question", type: "SHORT_TEXT" }]
		},
		method: "POST",
		token
	})

	assert.equal(response.status, 201)
	const data = prisma.form.create.calls[0][0].data
	assert.equal(data.allowMultipleSubmissions, true)
	assert.equal(data.allowMultipleVotes, true)
})
