// Modules
const { Prisma } = require("@prisma/client")
const crypto = require("crypto")
const prisma = require("../lib/prisma")
const { parseId } = require("../utils/request")

// Variables
const submissionInclude = {
	answers: {
		select: {
			createdAt: true,
			fieldId: true,
			id: true,
			updatedAt: true,
			value: true
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

// Function: Parse Submission Query
function parseSubmissionQuery (query) {
	const includeSummary = query.summary !== "false"
	const includeSubmissions = query.submissions !== "false"
	const sort = query.sort === "oldest" ? "oldest" : "newest"

	return {
		includeSubmissions,
		includeSummary,
		sort
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

// Function: Normalize Summary Text
function normalizeSummaryText (value) {
	if (Array.isArray(value)) return value.filter(Boolean).join(", ")
	if (value === null || value === undefined || value === "") return ""

	return String(value)
}

// Function: Find Submissions
async function findSubmissions (formId, params) {
	const sortDirection = params.sort === "oldest" ? Prisma.sql`ASC` : Prisma.sql`DESC`

	return prisma.$queryRaw`
		SELECT
			fs.id,
			fs."formId",
			fs."respondentId",
			fs."anonymousTokenHash",
			fs."createdAt",
			fs."updatedAt",
			CASE
				WHEN u.id IS NULL THEN NULL
				ELSE json_build_object(
					'id', u.id,
					'email', u.email,
					'firstName', u."firstName",
					'lastName', u."lastName"
				)
			END AS respondent,
			COALESCE(
				json_agg(
					json_build_object(
						'id', fa.id,
						'fieldId', fa."fieldId",
						'value', fa.value,
						'createdAt', fa."createdAt",
						'updatedAt', fa."updatedAt"
					)
					ORDER BY fa.id ASC
				) FILTER (WHERE fa.id IS NOT NULL),
				'[]'
			) AS answers
		FROM "FormSubmission" fs
		LEFT JOIN "User" u ON u.id = fs."respondentId"
		LEFT JOIN "FormAnswer" fa ON fa."submissionId" = fs.id
		WHERE fs."formId" = ${formId}
		GROUP BY fs.id, u.id
		ORDER BY fs."createdAt" ${sortDirection}, fs.id ${sortDirection}
	`
}

// Function: Build Submission Summary
async function buildSubmissionSummary (form) {
	const fieldIds = form.fields.map((field) => field.id)
	const [submissionStats, answers] = await Promise.all([
		prisma.$queryRaw`
			SELECT
				COUNT(*)::int AS total,
				COUNT("respondentId")::int AS registered,
				MIN("createdAt") AS start,
				MAX("createdAt") AS "end"
			FROM "FormSubmission"
			WHERE "formId" = ${form.id}
		`,
		fieldIds.length
			? prisma.formAnswer.findMany({
				where: {
					fieldId: {
						in: fieldIds
					}
				},
				select: {
					fieldId: true,
					id: true,
					value: true
				}
			})
			: []
	])
	const stats = submissionStats[0] || {
		end: null,
		registered: 0,
		start: null,
		total: 0
	}
	const answersByField = answers.reduce((groups, answer) => {
		const group = groups.get(answer.fieldId) || []

		group.push(answer)
		groups.set(answer.fieldId, group)

		return groups
	}, new Map())
	const choices = form.fields
		.filter((field) => field.type === "MULTIPLE_CHOICE")
		.map((field) => {
			const counts = new Map(field.options.map((option) => [option.value, 0]))
			const fieldAnswers = answersByField.get(field.id) || []

			fieldAnswers.forEach((answer) => {
				const values = Array.isArray(answer.value) ? answer.value : [answer.value]

				values.filter(Boolean).forEach((value) => {
					if (counts.has(value)) {
						counts.set(value, counts.get(value) + 1)
					}
				})
			})

			return {
				fieldId: field.id,
				options: field.options.map((option) => ({
					count: counts.get(option.value) || 0,
					label: option.value
				}))
			}
		})
	const text = form.fields
		.filter((field) => field.type !== "MULTIPLE_CHOICE")
		.map((field) => {
			const responses = (answersByField.get(field.id) || [])
				.map((answer) => ({
					answerId: answer.id,
					value: normalizeSummaryText(answer.value)
				}))
				.filter((answer) => answer.value)

			return {
				fieldId: field.id,
				responses
			}
		})

	return {
		anonymousSubmissions: stats.total - stats.registered,
		choices,
		dateRange: {
			end: stats.end,
			start: stats.start
		},
		registeredSubmissions: stats.registered,
		text,
		totalSubmissions: stats.total
	}
}

// Controller: Get Form Submissions
async function getFormSubmissions (req, res) {
	try {
		const formId = parseId(req.params.formId)
		const params = parseSubmissionQuery(req.query)

		if (!formId) {
			return res.status(400).json({ message: "Invalid form id" })
		}

		const form = await prisma.form.findFirst({
			where: {
				id: formId,
				userId: req.user.userId
			},
			...(params.includeSummary
				? {
					include: {
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
						}
					}
				}
				: {
					select: {
						id: true
					}
				})
		})
		if (!form) {
			return res.status(404).json({ message: "Form not found" })
		}

		const [submissions, summary] = await Promise.all([
			params.includeSubmissions ? findSubmissions(formId, params) : Promise.resolve([]),
			params.includeSummary ? buildSubmissionSummary(form) : Promise.resolve(null)
		])

		res.json({
			submissions,
			summary
		})
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
