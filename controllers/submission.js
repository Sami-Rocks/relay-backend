// Modules
const crypto = require("crypto")
const prisma = require("../lib/prisma")
const { parseId } = require("../utils/request")

// Variables
const submissionInclude = {
	answers: {
		include: {
			field: {
				select: {
					id: true,
					label: true,
					type: true
				}
			}
		}
	},
	form: {
		select: {
			id: true,
			title: true,
			kind: true
		}
	},
	respondent: {
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true
		}
	}
}

// Function: Normalize Answers
function normalizeAnswers (answers) {
	if (!Array.isArray(answers)) return null

	return answers.map((answer) => ({
		fieldId: parseId(answer.fieldId),
		value: answer.value
	}))
}

// Function: Get Anonymous Token
function getAnonymousToken (req) {
	return req.body.anonymousToken || req.headers["x-anonymous-token"] || null
}

// Function: Hash Anonymous Token
function hashAnonymousToken (token) {
	if (!token || typeof token !== "string") return null

	return crypto
		.createHash("sha256")
		.update(token)
		.digest("hex")
}

// Function: Allows Multiple Submissions
function allowsMultipleSubmissions (form) {
	return Boolean(form.allowMultipleSubmissions || form.allowMultipleVotes)
}

// Function: Validate Answers
function validateAnswers (form, answers) {
	if (!answers) return "Answers are required"

	const fieldMap = new Map(form.fields.map((field) => [field.id, field]))
	const answerMap = new Map()

	for (const answer of answers) {
		if (!answer.fieldId || !fieldMap.has(answer.fieldId)) {
			return "Invalid answer field"
		}
		if (answerMap.has(answer.fieldId)) {
			return "Duplicate answer field"
		}
		answerMap.set(answer.fieldId, answer.value)
	}

	for (const field of form.fields) {
		const value = answerMap.get(field.id)

		if (field.required && (value === undefined || value === null || value === "")) {
			return `${field.label} is required`
		}

		if (field.type === "MULTIPLE_CHOICE" && value !== undefined && value !== null && value !== "") {
			const values = Array.isArray(value) ? value : [value]
			const optionValues = new Set(field.options.map((option) => option.value))

			if (!values.length || values.some((item) => !optionValues.has(item))) {
				return `${field.label} has an invalid option`
			}
		}
	}

	return null
}

// Function: Find Public Form
async function findPublicForm (formId) {
	return prisma.form.findFirst({
		where: {
			id: formId,
			status: "PUBLISHED"
		},
		include: {
			fields: {
				include: {
					options: true
				}
			}
		}
	})
}

// Function: Create Submission
async function createSubmissionData (form, answers, respondentId, anonymousTokenHash) {
	return prisma.formSubmission.create({
		data: {
			anonymousTokenHash,
			formId: form.id,
			respondentId,
			answers: {
				create: answers.map((answer) => ({
					fieldId: answer.fieldId,
					value: answer.value
				}))
			}
		},
		include: submissionInclude
	})
}

// Function: Find Existing Submission
async function findExistingSubmission (formId, respondentId, anonymousTokenHash) {
	if (respondentId) {
		return prisma.formSubmission.findFirst({
			where: {
				formId,
				respondentId
			},
			select: {
				id: true
			}
		})
	}

	if (anonymousTokenHash) {
		return prisma.formSubmission.findFirst({
			where: {
				anonymousTokenHash,
				formId
			},
			select: {
				id: true
			}
		})
	}

	return null
}

// Controller: Get Form Submissions
async function getFormSubmissions (req, res) {
	try {
		const formId = parseId(req.params.formId)

		if (!formId) {
			return res.status(400).json({ message: "Invalid form id" })
		}

		const form = await prisma.form.findFirst({
			where: {
				id: formId,
				userId: req.user.userId
			},
			select: {
				id: true
			}
		})
		if (!form) {
			return res.status(404).json({ message: "Form not found" })
		}

		const submissions = await prisma.formSubmission.findMany({
			where: {
				formId
			},
			include: submissionInclude,
			orderBy: {
				createdAt: "desc"
			}
		})

		res.json(submissions)
	} catch (error) {
		res.status(500).json({ message: "Error fetching submissions", error: error.message })
	}
}

// Controller: Submit Form
async function submitForm (req, res) {
	try {
		const formId = parseId(req.params.formId)

		if (!formId) {
			return res.status(400).json({ message: "Invalid form id" })
		}

		const form = await findPublicForm(formId)
		if (!form) {
			return res.status(404).json({ message: "Form not found" })
		}

		if ((form.requireLogin || !form.allowAnonymous) && !req.user?.userId) {
			return res.status(401).json({ message: "Authentication required" })
		}

		const respondentId = req.user?.userId || null
		const anonymousTokenHash = respondentId ? null : hashAnonymousToken(getAnonymousToken(req))

		if (!allowsMultipleSubmissions(form)) {
			if (!respondentId && form.duplicateProtection === "LOGIN") {
				return res.status(401).json({ message: "Login is required to prevent duplicate submissions" })
			}
			if (!respondentId && form.duplicateProtection === "BROWSER" && !anonymousTokenHash) {
				return res.status(400).json({ message: "Anonymous submission token is required" })
			}

			const existingSubmission = await findExistingSubmission(formId, respondentId, anonymousTokenHash)

			if (existingSubmission) {
				return res.status(400).json({ message: "You have already submitted this form" })
			}
		}

		const answers = normalizeAnswers(req.body.answers)
		const validationError = validateAnswers(form, answers)

		if (validationError) {
			return res.status(400).json({ message: validationError })
		}

		const submission = await createSubmissionData(form, answers, respondentId, anonymousTokenHash)

		res.status(201).json(submission)
	} catch (error) {
		res.status(500).json({ message: "Error submitting form", error: error.message })
	}
}

// Export
module.exports = {
	getFormSubmissions,
	submitForm
}
