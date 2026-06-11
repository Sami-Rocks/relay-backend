require("dotenv").config()

const bcrypt = require("bcryptjs")
const prisma = require("../lib/prisma")

const SEED_PASSWORD = "password123"
const SEED_USERS = [
	{
		email: "owner@relay.test",
		firstName: "Relay",
		lastName: "Owner"
	},
	{
		email: "respondent@relay.test",
		firstName: "Test",
		lastName: "Respondent"
	}
]

const SAMPLE_FORMS = [
	{
		kind: "FORM",
		icon: "📝",
		title: "Membership intake",
		description: "Collect basic details from new members before onboarding.",
		coverImageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
		status: "PUBLISHED",
		allowAnonymous: true,
		allowMultipleVotes: true,
		fields: [
			{
				type: "SHORT_TEXT",
				label: "Full name",
				placeholder: "Jane Doe",
				required: true
			},
			{
				type: "SHORT_TEXT",
				label: "Phone number",
				placeholder: "+233 00 000 0000",
				required: true
			},
			{
				type: "MULTIPLE_CHOICE",
				label: "Preferred ministry",
				required: true,
				options: ["Hospitality", "Music", "Media", "Children"]
			},
			{
				type: "LONG_TEXT",
				label: "Prayer request",
				placeholder: "Share anything you would like the team to pray about.",
				required: false
			}
		],
		submissions: [
			{
				respondent: "respondent@relay.test",
				answers: {
					"Full name": "Ama Boateng",
					"Phone number": "+233 24 000 0000",
					"Preferred ministry": "Hospitality",
					"Prayer request": "Praying for a smooth transition into the city."
				}
			}
		]
	},
	{
		kind: "POLL",
		icon: "🗳️",
		title: "Sunday service time poll",
		description: "Quick vote to learn which service time works best.",
		coverImageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
		status: "PUBLISHED",
		allowAnonymous: true,
		allowMultipleVotes: false,
		fields: [
			{
				type: "MULTIPLE_CHOICE",
				label: "Which service time do you prefer?",
				required: true,
				options: ["8:00 AM", "10:00 AM", "12:00 PM"]
			}
		],
		submissions: [
			{
				answers: {
					"Which service time do you prefer?": "8:00 AM"
				}
			},
			{
				answers: {
					"Which service time do you prefer?": "10:00 AM"
				}
			},
			{
				answers: {
					"Which service time do you prefer?": "10:00 AM"
				}
			}
		]
	},
	{
		kind: "SURVEY",
		icon: "📊",
		title: "Volunteer feedback survey",
		description: "Understand how volunteer teams felt after the last event.",
		coverImageUrl: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1600&q=80",
		status: "PUBLISHED",
		allowAnonymous: true,
		allowMultipleVotes: true,
		fields: [
			{
				type: "MULTIPLE_CHOICE",
				label: "How was your volunteer experience?",
				required: true,
				options: ["Excellent", "Good", "Okay", "Needs work"]
			},
			{
				type: "LONG_TEXT",
				label: "What went well?",
				placeholder: "Share what worked well for your team.",
				required: false
			},
			{
				type: "MULTIPLE_CHOICE",
				label: "Would you serve again?",
				required: true,
				options: ["Yes", "Maybe", "No"]
			}
		],
		submissions: [
			{
				respondent: "respondent@relay.test",
				answers: {
					"How was your volunteer experience?": "Excellent",
					"What went well?": "The team leads communicated clearly before the event.",
					"Would you serve again?": "Yes"
				}
			}
		]
	},
	{
		kind: "FORM",
		icon: "📦",
		title: "Archived event registration",
		description: "An older registration form kept for archive testing.",
		status: "ARCHIVED",
		allowAnonymous: true,
		allowMultipleVotes: false,
		fields: [
			{
				type: "SHORT_TEXT",
				label: "Attendee name",
				placeholder: "Full name",
				required: true
			},
			{
				type: "MULTIPLE_CHOICE",
				label: "Ticket type",
				required: true,
				options: ["General", "Volunteer", "VIP"]
			}
		],
		submissions: []
	}
]

function buildFieldCreateData (fields) {
	return fields.map((field, index) => ({
		type: field.type,
		label: field.label,
		placeholder: field.placeholder || null,
		required: Boolean(field.required),
		order: index + 1,
		options: {
			create: (field.options || []).map((option, optionIndex) => ({
				label: option,
				value: option,
				order: optionIndex + 1
			}))
		}
	}))
}

function buildAnswerCreateData (form, answerMap) {
	return form.fields.map((field) => {
		const value = answerMap[field.label]

		return {
			fieldId: field.id,
			value: value === undefined ? "" : value
		}
	})
}

async function createSeedUser (user, password) {
	return prisma.user.create({
		data: {
			...user,
			password
		}
	})
}

async function createSeedForm (ownerId, formData, usersByEmail) {
	const { fields, submissions, ...form } = formData
	const createdForm = await prisma.form.create({
		data: {
			...form,
			userId: ownerId,
			fields: {
				create: buildFieldCreateData(fields)
			}
		},
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
	})

	for (const submission of submissions) {
		await prisma.formSubmission.create({
			data: {
				formId: createdForm.id,
				respondentId: submission.respondent ? usersByEmail.get(submission.respondent).id : null,
				answers: {
					create: buildAnswerCreateData(createdForm, submission.answers)
				}
			}
		})
	}

	return createdForm
}

async function main () {
	const emails = SEED_USERS.map((user) => user.email)
	const password = await bcrypt.hash(SEED_PASSWORD, 10)

	await prisma.user.deleteMany({
		where: {
			email: {
				in: emails
			}
		}
	})

	const users = await Promise.all(SEED_USERS.map((user) => createSeedUser(user, password)))
	const usersByEmail = new Map(users.map((user) => [user.email, user]))
	const owner = usersByEmail.get("owner@relay.test")

	for (const form of SAMPLE_FORMS) {
		await createSeedForm(owner.id, form, usersByEmail)
	}

	const [userCount, formCount, submissionCount] = await Promise.all([
		prisma.user.count({
			where: {
				email: {
					in: emails
				}
			}
		}),
		prisma.form.count({
			where: {
				userId: owner.id
			}
		}),
		prisma.formSubmission.count({
			where: {
				form: {
					userId: owner.id
				}
			}
		})
	])

	console.log(`Seed complete: ${userCount} users, ${formCount} forms, ${submissionCount} submissions.`)
	console.log(`Login with owner@relay.test / ${SEED_PASSWORD}`)
}

main()
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
