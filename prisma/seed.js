require("dotenv").config()

const crypto = require("crypto")
const bcrypt = require("bcryptjs")
const prisma = require("../lib/prisma")

const SEED_PASSWORD = "password123"
const CONCURRENCY = 25

const MINISTRIES = ["Hospitality", "Music", "Media", "Children", "Prayer", "Outreach", "Ushering", "Care"]
const TICKET_TYPES = ["General", "Volunteer", "VIP", "Student", "Partner"]
const SERVICE_TIMES = ["8:00 AM", "10:00 AM", "12:00 PM", "5:00 PM"]
const WORSHIP_STYLES = ["Acoustic", "Choir", "Full band", "Spoken word", "Hymns"]
const RATINGS = ["Excellent", "Good", "Okay", "Needs work"]
const YES_MAYBE_NO = ["Yes", "Maybe", "No"]

const FIRST_NAMES = [
	"Ama", "Kojo", "Efua", "Nana", "Abena", "Kofi", "Esi", "Yaw", "Akua", "Kwesi",
	"Adjoa", "Fiifi", "Mansa", "Selorm", "Afia", "Kwaku", "Ekua", "Kobby", "Dzifa", "Yaa",
	"Elikem", "Sena", "Kafui", "Nii", "Araba", "Kwabena", "Serwaa", "Ato", "Dede", "Kweku"
]
const LAST_NAMES = [
	"Boateng", "Mensah", "Owusu", "Appiah", "Darko", "Addo", "Asante", "Sarpong", "Tetteh", "Ofori",
	"Baah", "Agyeman", "Quaye", "Dartey", "Arthur", "Bonsu", "Danso", "Amponsah", "Acheampong", "Annan"
]
const TEAMS = ["welcome", "media", "children", "hospitality", "prayer", "parking", "music", "cleanup", "security", "follow-up"]
const AREAS = ["lobby", "auditorium", "children's room", "welcome desk", "parking lane", "media booth", "prayer corner", "registration table"]
const POSITIVE_OUTCOMES = [
	"guests found help quickly",
	"volunteers knew their roles",
	"handoffs were calmer",
	"families moved through check-in faster",
	"team leads had fewer questions",
	"new volunteers felt included",
	"service transitions felt smoother",
	"follow-up conversations were easier"
]
const IMPROVEMENTS = [
	"send the briefing earlier",
	"print larger directional signs",
	"add another water station",
	"prepare a backup microphone",
	"share parking instructions sooner",
	"label supply boxes more clearly",
	"assign a floating support lead",
	"keep extra pens at check-in",
	"start rehearsal earlier",
	"publish cleanup zones before service"
]
const WORKSHOP_TOPICS = [
	"volunteer scheduling",
	"guest follow-up",
	"care request workflows",
	"small team media systems",
	"usher training",
	"new volunteer onboarding",
	"welcome team culture",
	"event budgeting",
	"survey analysis",
	"registration form design",
	"equipment planning",
	"team leader coaching"
]

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
	},
	{
		email: "esi@relay.test",
		firstName: "Esi",
		lastName: "Asante"
	},
	{
		email: "nii@relay.test",
		firstName: "Nii",
		lastName: "Quaye"
	}
]

function cycle (items, index) {
	return items[index % items.length]
}

function minutesAgo (minutes) {
	const date = new Date()
	date.setMinutes(date.getMinutes() - minutes)

	return date
}

function hashAnonymousToken (value) {
	return crypto
		.createHash("sha256")
		.update(value)
		.digest("hex")
}

function fullName (index) {
	return `${cycle(FIRST_NAMES, index)} ${cycle(LAST_NAMES, Math.floor(index / FIRST_NAMES.length) + index)}`
}

function namedSubmission (respondent, answers, index = 0) {
	return {
		answers,
		createdAt: minutesAgo(90 + index * 11),
		respondent
	}
}

function anonymousSubmission (answers, index = 0) {
	return {
		anonymousTokenHash: hashAnonymousToken(`relay-seed-anonymous-${index}`),
		answers,
		createdAt: minutesAgo(90 + index * 11)
	}
}

function uniqueNote (prefix, index, focus) {
	return `${prefix} ${index + 1}: ${focus} in the ${cycle(AREAS, index)} helped the ${cycle(TEAMS, index)} team during service ${1000 + index}.`
}

function createSubmission (answers, index, offset = 0, respondentEvery = 0) {
	const respondentEmails = SEED_USERS
		.map((user) => user.email)
		.filter((email) => email !== "owner@relay.test")
	const respondent = respondentEvery && index % respondentEvery === 0
		? cycle(respondentEmails, index)
		: null

	return respondent
		? namedSubmission(respondent, answers, index + offset)
		: anonymousSubmission(answers, index + offset)
}

function generateMembershipSubmissions (count) {
	return Array.from({ length: count }, (_, index) => {
		const name = fullName(index)
		const ministry = cycle(MINISTRIES, index)
		const request = index % 5 === 0
			? uniqueNote("Prayer request", index, `guidance while joining ${ministry.toLowerCase()}`)
			: uniqueNote("Short note", index, `interest in ${ministry.toLowerCase()} ministry`)

		return createSubmission({
			"Full name": name,
			"Phone number": `+233 24 ${String(500000 + index).padStart(6, "0")}`,
			"Preferred ministry": ministry,
			"Prayer request": request
		}, index, 0, 7)
	})
}

function generateEventRegistrationSubmissions (count) {
	return Array.from({ length: count }, (_, index) => {
		const attendeeName = fullName(index + 400)
		const ticketType = cycle(TICKET_TYPES, index)

		return createSubmission({
			"Attendee name": attendeeName,
			"Email address": `guest.${index + 1}.${ticketType.toLowerCase()}@example.com`,
			"Ticket type": ticketType,
			"Accessibility notes": uniqueNote("Registration note", index, `${ticketType.toLowerCase()} check-in`)
		}, index, 500, 9)
	})
}

function generateLeaderCheckInSubmissions (count) {
	return Array.from({ length: count }, (_, index) => createSubmission({
		"Leader name": fullName(index + 800),
		"Team update": uniqueNote("Leader update", index, `progress for ${cycle(TEAMS, index)}`)
	}, index, 900, 1))
}

function generatePollSubmissions (question, options, weights, count, offset = 0) {
	const weightedOptions = options.flatMap((option, index) => Array.from({ length: weights[index] }, () => option))

	return Array.from({ length: count }, (_, index) => anonymousSubmission({
		[question]: cycle(weightedOptions, index)
	}, index + offset))
}

function generateVolunteerSurveySubmissions (count) {
	const experienceRatings = [
		"Excellent", "Excellent", "Excellent", "Excellent", "Excellent", "Excellent",
		"Good", "Good", "Good", "Good",
		"Okay", "Okay",
		"Needs work"
	]
	const serveAgainAnswers = [
		"Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes",
		"Maybe", "Maybe", "No"
	]

	return Array.from({ length: count }, (_, index) => createSubmission({
		"How was your volunteer experience?": cycle(experienceRatings, index),
		"What went well?": `Response ${index + 1}: ${cycle(POSITIVE_OUTCOMES, index)} because the ${cycle(TEAMS, index)} team prepared ${cycle(["early", "clearly", "calmly", "together"], index)} around the ${cycle(AREAS, index)}.`,
		"What should improve?": `Improvement ${index + 1}: Please ${cycle(IMPROVEMENTS, index)} for the ${cycle(TEAMS, index + 3)} team before event block ${index + 1}.`,
		"Would you serve again?": cycle(serveAgainAnswers, index)
	}, index, 1400, 4))
}

function generateWorkshopSurveySubmissions (count) {
	const usefulnessRatings = [
		"Excellent", "Excellent", "Excellent",
		"Good", "Good", "Good", "Good",
		"Okay", "Needs work"
	]

	return Array.from({ length: count }, (_, index) => createSubmission({
		"How useful was the workshop?": cycle(usefulnessRatings, index),
		"What topic should we cover next?": `Topic request ${index + 1}: ${cycle(WORKSHOP_TOPICS, index)} for ${cycle(TEAMS, index)} volunteers, with practical examples from service week ${index + 1}.`
	}, index, 1900, 3))
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
		submissions: generateMembershipSubmissions(320),
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
		submissions: generateEventRegistrationSubmissions(180),
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
		allowMultipleSubmissions: true,
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
		submissions: generateLeaderCheckInSubmissions(36),
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
		submissions: generatePollSubmissions("Which service time do you prefer?", SERVICE_TIMES, [6, 18, 9, 0], 420, 2400),
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
		submissions: generatePollSubmissions("Which worship style should we feature next month?", WORSHIP_STYLES, [8, 8, 4, 3, 2], 260, 3000),
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
		description: "Survey data with distinct written responses for clear charts and word clouds.",
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
		submissions: generateVolunteerSurveySubmissions(360),
		title: "Volunteer feedback survey"
	},
	{
		allowAnonymous: true,
		allowMultipleSubmissions: true,
		description: "Workshop survey with varied topic requests for word cloud testing.",
		duplicateProtection: "NONE",
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
		submissions: generateWorkshopSurveySubmissions(240),
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

async function runInChunks (items, size, task) {
	for (let index = 0; index < items.length; index += size) {
		const chunk = items.slice(index, index + size)

		await Promise.all(chunk.map(task))
	}
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

	await runInChunks(submissions, CONCURRENCY, (submission) => prisma.formSubmission.create({
		data: {
			anonymousTokenHash: submission.anonymousTokenHash || null,
			createdAt: submission.createdAt || undefined,
			formId: createdForm.id,
			respondentId: submission.respondent ? usersByEmail.get(submission.respondent).id : null,
			answers: {
				create: buildAnswerCreateData(createdForm, submission.answers)
			}
		}
	}))

	console.log(`Created ${createdForm.kind.toLowerCase()} "${createdForm.title}" with ${submissions.length} submissions.`)

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
