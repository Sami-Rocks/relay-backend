require("dotenv").config()

const crypto = require("crypto")
const prisma = require("../lib/prisma")

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
		createdAt: daysAgo(index % 16, index * 9),
		respondent
	}
}

function anonymousSubmission (answers, index = 0) {
	return {
		anonymousTokenHash: hashAnonymousToken(`relay-survey-only-${index}`),
		answers,
		createdAt: daysAgo(index % 16, index * 9)
	}
}

function generateVolunteerFeedbackSubmissions (count) {
	return Array.from({ length: count }, (_, index) => {
		const respondent = index % 4 === 0 ? cycle(["ama@relay.test", "kwame@relay.test", "akosua@relay.test", "yaw@relay.test"], index) : null
		const experienceRatings = [
			"Excellent", "Excellent", "Excellent", "Excellent", "Excellent",
			"Good", "Good", "Good", "Good",
			"Okay", "Okay",
			"Needs work"
		]
		const serveAgainAnswers = [
			"Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes",
			"Maybe", "Maybe",
			"No"
		]
		const answers = {
			"How was your volunteer experience?": cycle(experienceRatings, index),
			"What went well?": cycle([
				"Team leads gave clear roles early and the check-in desk felt calm.",
				"Setup moved quickly because supplies were already labeled by station.",
				"Guests were welcomed warmly and first-time visitors found seats fast.",
				"Cleanup was organized, especially the media and hospitality areas.",
				"Communication in the volunteer group chat helped everyone stay aligned.",
				"The children team had enough helpers and parents felt confident.",
				"Parking guides reduced confusion before the second service.",
				"Prayer team follow-up after service felt personal and thoughtful.",
				"Music rehearsal started on time and transitions were smooth.",
				"New volunteers felt included because team captains checked on them.",
				"Hospitality served snacks early, which helped volunteers stay energized.",
				"Security and ushers coordinated well during the crowded entry period."
			], index),
			"What should improve?": cycle([
				"Send the volunteer briefing a day earlier with final arrival times.",
				"Add larger entrance signs so guests know where to register.",
				"Place more water stations near the children's area and welcome desk.",
				"Share parking directions with guests before Sunday morning.",
				"Create a backup plan when microphones or cameras fail.",
				"Give new volunteers a short checklist before they arrive.",
				"Reduce last-minute changes after teams have already been assigned.",
				"Add more chairs near the lobby for elderly guests.",
				"Keep extra name tags and pens at every check-in point.",
				"Give cleanup teams clearer zones so no area is missed.",
				"Start rehearsal ten minutes earlier when the set list changes.",
				"Assign one person to answer volunteer questions during service."
			], index),
			"Would you serve again?": cycle(serveAgainAnswers, index)
		}

		return respondent
			? namedSubmission(respondent, answers, index + 1200)
			: anonymousSubmission(answers, index + 1200)
	})
}

function generateWorkshopFeedbackSubmissions (count) {
	return Array.from({ length: count }, (_, index) => {
		const usefulnessRatings = [
			"Excellent", "Excellent", "Good", "Good", "Good", "Okay", "Needs work"
		]
		const answers = {
			"How useful was the workshop?": cycle(usefulnessRatings, index),
			"What topic should we cover next?": cycle([
				"Planning volunteer schedules without overwhelming team leads",
				"Better follow-up systems for first-time guests",
				"Using forms to collect prayer requests and care needs",
				"Simple media workflows for small church teams",
				"Training ushers to handle crowded service days",
				"Creating onboarding checklists for new volunteers",
				"Building a stronger welcome team culture",
				"Preparing event budgets and resource lists",
				"How to analyze survey feedback after programs",
				"Designing registration forms that people actually finish",
				"Turning survey comments into action plans",
				"Organizing equipment requests before an event"
			], index)
		}

		return index % 3 === 0
			? namedSubmission(cycle(["ama@relay.test", "kwame@relay.test", "akosua@relay.test"], index), answers, index + 1600)
			: anonymousSubmission(answers, index + 1600)
	})
}

function buildAnswerCreateData (form, answerMap) {
	return form.fields.map((field) => ({
		fieldId: field.id,
		value: answerMap[field.label] === undefined ? "" : answerMap[field.label]
	}))
}

async function createSurveySubmissions (title, submissions, usersByEmail) {
	const form = await prisma.form.findFirst({
		where: {
			kind: "SURVEY",
			title
		},
		include: {
			fields: {
				orderBy: {
					order: "asc"
				}
			}
		}
	})

	if (!form) {
		throw new Error(`Survey not found: ${title}`)
	}

	await prisma.formSubmission.deleteMany({
		where: {
			formId: form.id
		}
	})

	await Promise.all(submissions.map((submission) => prisma.formSubmission.create({
		data: {
			anonymousTokenHash: submission.anonymousTokenHash || null,
			createdAt: submission.createdAt || undefined,
			formId: form.id,
			respondentId: submission.respondent ? usersByEmail.get(submission.respondent).id : null,
			answers: {
				create: buildAnswerCreateData(form, submission.answers)
			}
		}
	})))

	return {
		count: submissions.length,
		title
	}
}

async function main () {
	const users = await prisma.user.findMany({
		where: {
			email: {
				in: [
					"ama@relay.test",
					"kwame@relay.test",
					"akosua@relay.test",
					"yaw@relay.test"
				]
			}
		}
	})
	const usersByEmail = new Map(users.map((user) => [user.email, user]))

	const results = await Promise.all([
		createSurveySubmissions("Volunteer feedback survey", generateVolunteerFeedbackSubmissions(96), usersByEmail),
		createSurveySubmissions("Workshop feedback survey", generateWorkshopFeedbackSubmissions(48), usersByEmail)
	])

	console.log(`Survey seed complete: ${results.map(result => `${result.title} (${result.count})`).join(", ")}.`)
}

main()
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})
