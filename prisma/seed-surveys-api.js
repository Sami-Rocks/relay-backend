const API_BASE_URL = process.env.SEED_API_BASE_URL || "http://localhost:3000/api"

function cycle (items, index) {
	return items[index % items.length]
}

function buildAnswers (form, answerMap) {
	return form.fields.map((field) => ({
		fieldId: field.id,
		value: answerMap[field.label] === undefined ? "" : answerMap[field.label]
	}))
}

function generateVolunteerFeedbackSubmissions (count) {
	return Array.from({ length: count }, (_, index) => {
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

		return {
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
	})
}

function generateWorkshopFeedbackSubmissions (count) {
	return Array.from({ length: count }, (_, index) => {
		const usefulnessRatings = [
			"Excellent", "Excellent", "Good", "Good", "Good", "Okay", "Needs work"
		]

		return {
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
	})
}

async function getPublicForms () {
	const response = await fetch(`${API_BASE_URL}/forms/public`)
	if (!response.ok) throw new Error(`Failed to fetch public forms: ${response.status}`)

	return response.json()
}

async function submitSurveyResponses (forms, title, responses, offset) {
	const form = forms.find((item) => item.kind === "SURVEY" && item.title === title)

	if (!form) throw new Error(`Survey not found: ${title}`)

	for (const [index, responseMap] of responses.entries()) {
		const response = await fetch(`${API_BASE_URL}/forms/${form.id}/submissions`, {
			body: JSON.stringify({
				answers: buildAnswers(form, responseMap)
			}),
			headers: {
				"Content-Type": "application/json",
				"x-anonymous-token": `relay-api-survey-seed-${offset + index}`
			},
			method: "POST"
		})

		if (!response.ok) {
			const body = await response.json().catch(() => ({}))
			throw new Error(`Failed to submit ${title} response ${index + 1}: ${body.message || response.status}`)
		}
	}

	return {
		count: responses.length,
		title
	}
}

async function main () {
	const forms = await getPublicForms()
	const results = []

	results.push(await submitSurveyResponses(forms, "Volunteer feedback survey", generateVolunteerFeedbackSubmissions(96), 2000))
	results.push(await submitSurveyResponses(forms, "Workshop feedback survey", generateWorkshopFeedbackSubmissions(48), 3000))

	console.log(`Survey API seed complete: ${results.map(result => `${result.title} (+${result.count})`).join(", ")}.`)
}

main()
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
