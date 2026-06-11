// Modules
const { deleteImage, uploadImage } = require("../lib/cloudinary")
const prisma = require("../lib/prisma")
const { hasOwn, parseId, parseList } = require("../utils/request")

// Variables
const formInclude = {
	fields: {
		include: {
			options: {
				orderBy: {
					order: "asc"
				}
			}
		},
		orderBy: {
			order: "asc"
		}
	},
	user: {
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true
		}
	},
	_count: {
		select: {
			submissions: true
		}
	}
}
const formKinds = ["FORM", "POLL", "SURVEY"]
const formStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"]
const fieldTypes = ["SHORT_TEXT", "LONG_TEXT", "MULTIPLE_CHOICE"]
const duplicateProtections = ["NONE", "BROWSER", "LOGIN"]

// Function: Normalize Enum
function normalizeEnum (value) {
	return String(value || "")
		.trim()
		.replaceAll("-", "_")
		.toUpperCase()
}

// Function: Normalize Duplicate Protection
function normalizeDuplicateProtection (value) {
	return normalizeEnum(value || "BROWSER")
}

// Function: Build Form Where
function buildFormWhere (user, formId) {
	const where = {
		userId: user.userId
	}
	if (formId) where.id = formId

	return where
}

// Function: Build Fields Data
function buildFieldsData (fields = [], kind = "FORM") {
	if (!Array.isArray(fields)) return null

	const normalizedFields = fields.map((field, index) => {
		const type = normalizeEnum(field.type)
		const options = parseList(field.options)

		if (!field.label || !field.label.trim() || !fieldTypes.includes(type)) {
			return null
		}

		if (type === "MULTIPLE_CHOICE" && options.length < 2) {
			return null
		}

		return {
			label: field.label.trim(),
			order: parseId(field.order) || index + 1,
			placeholder: field.placeholder || null,
			required: kind === "POLL" ? true : Boolean(field.required),
			type,
			options: {
				create: type === "MULTIPLE_CHOICE"
					? options.map((option, optionIndex) => ({
						label: option,
						value: option,
						order: optionIndex + 1
					}))
					: []
			}
		}
	})

	if (normalizedFields.some((field) => field === null)) return null

	return normalizedFields
}

// Function: Validate Kind Rules
function validateKindRules (kind, fields = []) {
	if (!fields.length) return "At least one question is required"

	if (kind === "POLL") {
		if (fields.length !== 1) return "Polls can only have one question"
		if (fields[0].type !== "MULTIPLE_CHOICE") return "Polls must use a multiple choice question"
		if (fields[0].options.create.length < 2) return "Polls must have at least two options"
	}

	return null
}

// Function: Validate Submission Rules
function validateSubmissionRules (data) {
	if (data.requireLogin && data.allowAnonymous) {
		return "Forms that require login cannot allow anonymous submissions"
	}

	if (data.duplicateProtection && !duplicateProtections.includes(data.duplicateProtection)) {
		return "Invalid duplicate protection"
	}

	return null
}

// Function: Build Form Data
function buildFormData (body, userId, isCreate = false) {
	const data = {}
	const kind = hasOwn(body, "kind") ? normalizeEnum(body.kind) : "FORM"
	const status = hasOwn(body, "status") ? normalizeEnum(body.status) : undefined
	const duplicateProtection = hasOwn(body, "duplicateProtection")
		? normalizeDuplicateProtection(body.duplicateProtection)
		: undefined

	if (isCreate) data.userId = userId
	if (hasOwn(body, "kind")) data.kind = kind
	if (hasOwn(body, "status")) data.status = status
	if (hasOwn(body, "icon")) data.icon = body.icon
	if (hasOwn(body, "title")) data.title = body.title
	if (hasOwn(body, "description")) data.description = body.description
	if (hasOwn(body, "requireLogin")) data.requireLogin = Boolean(body.requireLogin)
	if (hasOwn(body, "allowAnonymous")) data.allowAnonymous = Boolean(body.allowAnonymous)
	if (hasOwn(body, "allowMultipleSubmissions")) {
		data.allowMultipleSubmissions = Boolean(body.allowMultipleSubmissions)
		data.allowMultipleVotes = Boolean(body.allowMultipleSubmissions)
	}
	if (hasOwn(body, "allowMultipleVotes")) {
		data.allowMultipleSubmissions = Boolean(body.allowMultipleVotes)
		data.allowMultipleVotes = Boolean(body.allowMultipleVotes)
	}
	if (hasOwn(body, "duplicateProtection")) data.duplicateProtection = duplicateProtection
	if (isCreate) {
		if (!hasOwn(body, "allowAnonymous")) data.allowAnonymous = data.requireLogin ? false : true
		if (!hasOwn(body, "allowMultipleSubmissions") && !hasOwn(body, "allowMultipleVotes")) {
			data.allowMultipleSubmissions = false
			data.allowMultipleVotes = false
		}
		if (!hasOwn(body, "duplicateProtection")) data.duplicateProtection = "BROWSER"
	}

	if (
		(hasOwn(body, "kind") && !formKinds.includes(kind)) ||
		(hasOwn(body, "status") && !formStatuses.includes(status)) ||
		(hasOwn(body, "duplicateProtection") && !duplicateProtections.includes(duplicateProtection))
	) {
		return null
	}

	return data
}

// Controller: Get Forms
async function getForms (req, res) {
	try {
		const search = req.query.search || req.query.q
		const kind = req.query.kind ? normalizeEnum(req.query.kind) : undefined
		const status = req.query.status ? normalizeEnum(req.query.status) : undefined
		const where = {
			userId: req.user.userId
		}

		if (kind) where.kind = kind
		if (status) where.status = status
		if (search) {
			where.OR = [
				{ title: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } }
			]
		}

		if ((kind && !formKinds.includes(kind)) || (status && !formStatuses.includes(status))) {
			return res.status(400).json({ message: "Invalid form filters" })
		}

		const forms = await prisma.form.findMany({
			where,
			include: formInclude,
			orderBy: {
				createdAt: "desc"
			}
		})

		res.json(forms)
	} catch (error) {
		res.status(500).json({ message: "Error fetching forms", error: error.message })
	}
}

// Controller: Get Form
async function getForm (req, res) {
	try {
		const formId = parseId(req.params.id)

		if (!formId) {
			return res.status(400).json({ message: "Invalid form id" })
		}

		const form = await prisma.form.findFirst({
			where: buildFormWhere(req.user, formId),
			include: formInclude
		})
		if (!form) {
			return res.status(404).json({ message: "Form not found" })
		}

		res.json(form)
	} catch (error) {
		res.status(500).json({ message: "Error fetching form", error: error.message })
	}
}

// Controller: Get Public Form
async function getPublicForm (req, res) {
	try {
		const formId = parseId(req.params.id)

		if (!formId) {
			return res.status(400).json({ message: "Invalid form id" })
		}

		const form = await prisma.form.findFirst({
			where: {
				id: formId,
				status: "PUBLISHED"
			},
			include: formInclude
		})
		if (!form) {
			return res.status(404).json({ message: "Form not found" })
		}

		res.json(form)
	} catch (error) {
		res.status(500).json({ message: "Error fetching form", error: error.message })
	}
}

// Controller: Get Public Forms
async function getPublicForms (req, res) {
	try {
		const search = req.query.search || req.query.q
		const kind = req.query.kind ? normalizeEnum(req.query.kind) : undefined
		const where = {
			status: "PUBLISHED"
		}

		if (kind) where.kind = kind
		if (search) {
			where.OR = [
				{ title: { contains: search, mode: "insensitive" } },
				{ description: { contains: search, mode: "insensitive" } }
			]
		}

		if (kind && !formKinds.includes(kind)) {
			return res.status(400).json({ message: "Invalid form filters" })
		}

		const forms = await prisma.form.findMany({
			where,
			include: formInclude,
			orderBy: {
				updatedAt: "desc"
			}
		})

		res.json(forms)
	} catch (error) {
		res.status(500).json({ message: "Error fetching forms", error: error.message })
	}
}

// Controller: Create Form
async function createForm (req, res) {
	try {
		const formData = buildFormData(req.body, req.user.userId, true)
		const kind = formData?.kind || "FORM"
		const fields = buildFieldsData(req.body.fields || [], kind)
		const kindError = fields ? validateKindRules(kind, fields) : null
		const submissionRulesError = formData ? validateSubmissionRules(formData) : null

		if (!formData || !formData.title || !fields) {
			return res.status(400).json({ message: "Title and valid fields are required" })
		}
		if (kindError || submissionRulesError) {
			return res.status(400).json({ message: kindError || submissionRulesError })
		}

		const form = await prisma.form.create({
			data: {
				...formData,
				fields: {
					create: fields
				}
			},
			include: formInclude
		})

		res.status(201).json(form)
	} catch (error) {
		res.status(500).json({ message: "Error creating form", error: error.message })
	}
}

// Controller: Upload Form Cover
async function uploadFormCover (req, res) {
	try {
		const formId = parseId(req.params.id)

		if (!formId) {
			return res.status(400).json({ message: "Invalid form id" })
		}

		if (!req.file) {
			return res.status(400).json({ message: "Cover image is required" })
		}

		const existingForm = await prisma.form.findFirst({
			where: buildFormWhere(req.user, formId),
			select: {
				id: true,
				coverImagePublicId: true
			}
		})
		if (!existingForm) {
			return res.status(404).json({ message: "Form not found" })
		}

		const result = await uploadImage(req.file, "relay/forms")
		const form = await prisma.form.update({
			where: { id: formId },
			data: {
				coverImageUrl: result.secure_url,
				coverImagePublicId: result.public_id
			},
			include: formInclude
		})

		await deleteImage(existingForm.coverImagePublicId)

		res.json(form)
	} catch (error) {
		res.status(500).json({ message: "Error uploading form cover", error: error.message })
	}
}

// Controller: Delete Form Cover
async function deleteFormCover (req, res) {
	try {
		const formId = parseId(req.params.id)

		if (!formId) {
			return res.status(400).json({ message: "Invalid form id" })
		}

		const existingForm = await prisma.form.findFirst({
			where: buildFormWhere(req.user, formId),
			select: {
				id: true,
				coverImagePublicId: true
			}
		})
		if (!existingForm) {
			return res.status(404).json({ message: "Form not found" })
		}

		const form = await prisma.form.update({
			where: { id: formId },
			data: {
				coverImagePublicId: null,
				coverImageUrl: null
			},
			include: formInclude
		})

		await deleteImage(existingForm.coverImagePublicId)

		res.json(form)
	} catch (error) {
		res.status(500).json({ message: "Error deleting form cover", error: error.message })
	}
}

// Controller: Update Form
async function updateForm (req, res) {
	try {
		const formId = parseId(req.params.id)

		if (!formId) {
			return res.status(400).json({ message: "Invalid form id" })
		}

		const existingForm = await prisma.form.findFirst({
			where: buildFormWhere(req.user, formId),
			select: {
				id: true,
				kind: true,
				requireLogin: true,
				allowAnonymous: true,
				duplicateProtection: true
			}
		})
		if (!existingForm) {
			return res.status(404).json({ message: "Form not found" })
		}

		const formData = buildFormData(req.body, req.user.userId)
		const kind = formData?.kind || existingForm.kind
		const shouldUpdateFields = hasOwn(req.body, "fields")
		const fields = shouldUpdateFields ? buildFieldsData(req.body.fields, kind) : undefined
		const nextRules = {
			requireLogin: formData.requireLogin ?? existingForm.requireLogin,
			allowAnonymous: formData.allowAnonymous ?? existingForm.allowAnonymous,
			duplicateProtection: formData.duplicateProtection ?? existingForm.duplicateProtection
		}
		const kindError = fields ? validateKindRules(kind, fields) : null
		const submissionRulesError = validateSubmissionRules(nextRules)

		if (!formData || fields === null) {
			return res.status(400).json({ message: "Invalid form data" })
		}

		if (Object.keys(formData).length === 0 && !shouldUpdateFields) {
			return res.status(400).json({ message: "No form changes provided" })
		}
		if (kindError || submissionRulesError) {
			return res.status(400).json({ message: kindError || submissionRulesError })
		}

		const form = await prisma.form.update({
			where: { id: formId },
			data: {
				...formData,
				fields: shouldUpdateFields
					? {
						deleteMany: {},
						create: fields
					}
					: undefined
			},
			include: formInclude
		})

		res.json(form)
	} catch (error) {
		res.status(500).json({ message: "Error updating form", error: error.message })
	}
}

// Controller: Delete Form
async function deleteForm (req, res) {
	try {
		const formId = parseId(req.params.id)

		if (!formId) {
			return res.status(400).json({ message: "Invalid form id" })
		}

		const form = await prisma.form.findFirst({
			where: buildFormWhere(req.user, formId),
			select: {
				coverImagePublicId: true,
				id: true
			}
		})
		if (!form) {
			return res.status(404).json({ message: "Form not found" })
		}

		await prisma.form.delete({
			where: { id: formId }
		})
		await deleteImage(form.coverImagePublicId)

		res.json({ message: "Form deleted successfully" })
	} catch (error) {
		res.status(500).json({ message: "Error deleting form", error: error.message })
	}
}

// Export
module.exports = {
	createForm,
	deleteFormCover,
	deleteForm,
	getForm,
	getForms,
	getPublicForm,
	getPublicForms,
	updateForm,
	uploadFormCover
}
