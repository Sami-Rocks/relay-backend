require("dotenv").config()

const crypto = require("crypto")
const bcrypt = require("bcryptjs")
const prisma = require("../lib/prisma")

const SEED_PASSWORD = "password123"
const MINISTRIES = ["Hospitality", "Music", "Media", "Children", "Prayer", "Outreach"]
const TICKET_TYPES = ["General", "Volunteer", "VIP"]
const SERVICE_TIMES = ["8:00 AM", "10:00 AM", "12:00 PM", "5:00 PM"]
const WORSHIP_STYLES = ["Acoustic", "Choir", "Full band", "Spoken word"]
const RATINGS = ["Excellent", "Good", "Okay", "Needs work"]
const YES_MAYBE_NO = ["Yes", "Maybe", "No"]

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
	},
	{
		email: "ama@relay.test",
		firstName: "Ama",
		lastName: "Boateng"
	},
	{
		email: "kwame@relay.test",
		firstName: "Kwame",
		lastName: "Mensah"
	},
	{
		email: "akosua@relay.test",
		firstName: "Akosua",
		lastName: "Owusu"
	},
	{
		email: "yaw@relay.test",
		firstName: "Yaw",
		lastName: "Appiah"
	}
]

function cycle (items, index) {
	return items[index % items.length]
}

function daysAgo (days, minutes = 0) {
	const date = new Date()
	date.setDate(date.getDate() - days)
	date.setMinutes(date.getMinutes() - minutes)

	return date
}

function hashAnonymousToken (value) {
	return crypto
		.createHash("sha256")
		.update(value)
		.digest("hex")
}

function namedSubmission (respondent, answers, index = 0) {
	return {
		answers,
		createdAt: daysAgo(index % 12, index * 7),
		respondent
	}
}

function anonymousSubmission (answers, index = 0) {
	return {
		anonymousTokenHash: hashAnonymousToken(`relay-seed-anonymous-${index}`),
		answers,
		createdAt: daysAgo(index % 12, index * 7)
	}
}

function generateMembershipSubmissions (count) {
	return Array.from({ length: count }, (_, index) => {
		const firstNames = ["Ama", "Kojo", "Efua", "Nana", "Abena", "Kofi", "Esi", "Yaw", "Akua", "Kwesi"]
		const lastNames = ["Boateng", "Mensah", "Owusu", "Appiah", "Darko", "Addo", "Asante", "Sarpong"]
		const fullName = `${cycle(firstNames, index)} ${cycle(lastNames, index)}`
		const respondent = index % 5 === 0 ? "respondent@relay.test" : null
		const answers = {
			"Full name": fullName,
			"Phone number": `+233 24 10${String(index).padStart(3, "0")}`,
			"Preferred ministry": cycle(MINISTRIES, index),
			"Prayer request": index % 4 === 0
				? "Praying for direction and consistency this season."
				: ""
		}

		return respondent
			? namedSubmission(respondent, answers, index)
			: anonymousSubmission(answers, index)
	})
}

function generateEventRegistrationSubmissions (count) {
	return Array.from({ length: count }, (_, index) => {
		const answers = {
			"Attendee name": `Guest ${index + 1}`,
			"Email address": `guest${index + 1}@example.com`,
			"Ticket type": cycle(TICKET_TYPES, index),
			"Accessibility notes": index % 9 === 0 ? "Needs front-row seating." : ""
		}

		return anonymousSubmission(answers, index + 200)
	})
}

function generatePollSubmissions (question, options, weights, count, offset = 0) {
	const weightedOptions = options.flatMap((option, index) => Array.from({ length: weights[index] }, () => option))

	return Array.from({ length: count }, (_, index) => anonymousSubmission({
		[question]: cycle(weightedOptions, index)
	}, index + offset))
}

function generateSurveySubmissions (count) {
	return Array.from({ length: count }, (_, index) => {
		const respondent = index % 4 === 0 ? cycle(["ama@relay.test", "kwame@relay.test", "akosua@relay.test"], index) : null
		const answers = {
			"How was your volunteer experience?": cycle(RATINGS, index),
			"What went well?": cycle([
				"The team leads communicated clearly before the event.",
				"Setup moved faster than expected.",
				"Guests were welcomed quickly.",
				"Cleanup was well organized."
			], index),
			"What should improve?": cycle([
				"Earlier briefing would help.",
				"More signs at the entrance.",
				"More water stations.",
				"Clearer parking directions."
			], index),
			"Would you serve again?": cycle(YES_MAYBE_NO, index)
		}

		return respondent
			? namedSubmission(respondent, answers, index + 400)
			: anonymousSubmission(answers, index + 400)
	})
}

const SAMPLE_FORMS = [
	{
		allowAnonymous: true,
		allowMultipleSubmissions: true,
		coverImageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
		description: "Large form dataset for testing search, sort, column visibility, detail panel, and CSV export.",
		duplicateProtection: "NONE",
		fields: [
			{
				label: "Full name",
				placeholder: "Jane Doe",
				required: true,
				type: "SHORT_TEXT"
			},
			{
				label: "Phone number",
				placeholder: "+233 00 000 0000",
				required: true,
				type: "SHORT_TEXT"
			},
			{
				label: "Preferred ministry",
				options: MINISTRIES,
				required: true,
				type: "MULTIPLE_CHOICE"
			},
			{
				label: "Prayer request",
				placeholder: "Share anything you would like the team to pray about.",
				required: false,
				type: "LONG_TEXT"
			}
		],
		icon: "📝",
		kind: "FORM",
		status: "PUBLISHED",
		submissions: generateMembershipSubmissions(135),
		title: "Membership intake"
	},
	{
		allowAnonymous: true,
		allowMultipleSubmissions: true,
		description: "Medium registration form with email, ticket, and notes columns.",
		duplicateProtection: "NONE",
		fields: [
			{
				label: "Attendee name",
				placeholder: "Full name",
				required: true,
				type: "SHORT_TEXT"
			},
			{
				label: "Email address",
				placeholder: "guest@example.com",
				required: true,
				type: "SHORT_TEXT"
			},
			{
				label: "Ticket type",
				options: TICKET_TYPES,
				required: true,
				type: "MULTIPLE_CHOICE"
			},
			{
				label: "Accessibility notes",
				placeholder: "Optional notes",
				required: false,
				type: "LONG_TEXT"
			}
		],
		icon: "🎟️",
		kind: "FORM",
		status: "PUBLISHED",
		submissions: generateEventRegistrationSubmissions(48),
		title: "Conference registration"
	},
	{
		allowAnonymous: true,
		allowMultipleSubmissions: false,
		description: "Empty form for testing no-submission table states.",
		fields: [
			{
				label: "Attendee name",
				placeholder: "Full name",
				required: true,
				type: "SHORT_TEXT"
			},
			{
				label: "Ticket type",
				options: TICKET_TYPES,
				required: true,
				type: "MULTIPLE_CHOICE"
			}
		],
		icon: "📦",
		kind: "FORM",
		status: "ARCHIVED",
		submissions: [],
		title: "Archived event registration"
	},
	{
		allowAnonymous: false,
		allowMultipleSubmissions: false,
		description: "Draft form owned by the logged-in user, used to test unpublished/private form states.",
		duplicateProtection: "LOGIN",
		fields: [
			{
				label: "Leader name",
				required: true,
				type: "SHORT_TEXT"
			},
			{
				label: "Team update",
				required: true,
				type: "LONG_TEXT"
			}
		],
		icon: "🔒",
		kind: "FORM",
		requireLogin: true,
		status: "DRAFT",
		submissions: [
			namedSubmission("ama@relay.test", {
				"Leader name": "Ama Boateng",
				"Team update": "Follow-up calls are scheduled for Saturday."
			}, 20)
		],
		title: "Team leader check-in"
	},
	{
		allowAnonymous: true,
		allowMultipleSubmissions: true,
		allowMultipleVotes: true,
		coverImageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
		description: "Skewed poll with a clear winner and one zero-vote option.",
		duplicateProtection: "NONE",
		fields: [
			{
				label: "Which service time do you prefer?",
				options: SERVICE_TIMES,
				required: true,
				type: "MULTIPLE_CHOICE"
			}
		],
		icon: "🗳️",
		kind: "POLL",
		status: "PUBLISHED",
		submissions: generatePollSubmissions("Which service time do you prefer?", SERVICE_TIMES, [6, 17, 9, 0], 64, 600),
		title: "Sunday service time poll"
	},
	{
		allowAnonymous: true,
		allowMultipleSubmissions: true,
		allowMultipleVotes: true,
		description: "Poll with a tie for testing multiple highlighted winners.",
		duplicateProtection: "NONE",
		fields: [
			{
				label: "Which worship style should we feature next month?",
				options: WORSHIP_STYLES,
				required: true,
				type: "MULTIPLE_CHOICE"
			}
		],
		icon: "🎶",
		kind: "POLL",
		status: "PUBLISHED",
		submissions: generatePollSubmissions("Which worship style should we feature next month?", WORSHIP_STYLES, [5, 5, 2, 1], 26, 800),
		title: "Worship style poll"
	},
	{
		allowAnonymous: true,
		allowMultipleSubmissions: false,
		allowMultipleVotes: false,
		description: "Empty poll for testing all options at zero votes.",
		fields: [
			{
				label: "Which outreach location should we choose?",
				options: ["East Legon", "Madina", "Osu", "Tema"],
				required: true,
				type: "MULTIPLE_CHOICE"
			}
		],
		icon: "📍",
		kind: "POLL",
		status: "PUBLISHED",
		submissions: [],
		title: "Outreach location poll"
	},
	{
		allowAnonymous: true,
		allowMultipleSubmissions: true,
		allowMultipleVotes: true,
		coverImageUrl: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1600&q=80",
		description: "Survey data is seeded now, but frontend analysis will be built later.",
		duplicateProtection: "NONE",
		fields: [
			{
				label: "How was your volunteer experience?",
				options: RATINGS,
				required: true,
				type: "MULTIPLE_CHOICE"
			},
			{
				label: "What went well?",
				placeholder: "Share what worked well for your team.",
				required: false,
				type: "LONG_TEXT"
			},
			{
				label: "What should improve?",
				placeholder: "Share one improvement.",
				required: false,
				type: "LONG_TEXT"
			},
			{
				label: "Would you serve again?",
				options: YES_MAYBE_NO,
				required: true,
				type: "MULTIPLE_CHOICE"
			}
		],
		icon: "📊",
		kind: "SURVEY",
		status: "PUBLISHED",
		submissions: generateSurveySubmissions(72),
		title: "Volunteer feedback survey"
	},
	{
		allowAnonymous: true,
		allowMultipleSubmissions: true,
		description: "Short empty survey for future analysis empty states.",
		fields: [
			{
				label: "How useful was the workshop?",
				options: RATINGS,
				required: true,
				type: "MULTIPLE_CHOICE"
			},
			{
				label: "What topic should we cover next?",
				required: false,
				type: "SHORT_TEXT"
			}
		],
		icon: "💬",
		kind: "SURVEY",
		status: "PUBLISHED",
		submissions: [],
		title: "Workshop feedback survey"
	}
]

function buildFieldCreateData (fields) {
	return fields.map((field, index) => ({
		label: field.label,
		order: index + 1,
		placeholder: field.placeholder || null,
		required: Boolean(field.required),
		type: field.type,
		options: {
			create: (field.options || []).map((option, optionIndex) => ({
				label: option,
				order: optionIndex + 1,
				value: option
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
			allowAnonymous: form.allowAnonymous ?? true,
			allowMultipleSubmissions: form.allowMultipleSubmissions ?? false,
			allowMultipleVotes: form.allowMultipleVotes ?? form.allowMultipleSubmissions ?? false,
			coverImageUrl: form.coverImageUrl || null,
			description: form.description || null,
			duplicateProtection: form.duplicateProtection || "BROWSER",
			icon: form.icon,
			kind: form.kind,
			requireLogin: Boolean(form.requireLogin),
			status: form.status,
			title: form.title,
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

	await Promise.all(submissions.map((submission) => prisma.formSubmission.create({
		data: {
			anonymousTokenHash: submission.anonymousTokenHash || null,
			createdAt: submission.createdAt || undefined,
			formId: createdForm.id,
			respondentId: submission.respondent ? usersByEmail.get(submission.respondent).id : null,
			answers: {
				create: buildAnswerCreateData(createdForm, submission.answers)
			}
		}
	})))

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
