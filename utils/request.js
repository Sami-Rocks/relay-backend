// Function: Parse ID
function parseId (value) {
	const id = Number(value)

	return Number.isInteger(id) && id > 0 ? id : null
}

// Function: Parse ID Array
function parseIdArray (values) {
	if (!Array.isArray(values) || values.length === 0) {
		return null
	}

	const ids = values.map(parseId)

	if (ids.some((id) => id === null)) {
		return null
	}

	return ids
}

// Function: Check Duplicates
function hasDuplicates (values) {
	return new Set(values).size !== values.length
}

// Function: Parse Amount
function parseAmount (value) {
	if (value === "" || value === null || value === undefined) {
		return null
	}

	const amount = Number(value)

	return Number.isFinite(amount) && amount >= 0 ? amount : null
}

// Function: Has Own Property
function hasOwn (object, key) {
	return Object.prototype.hasOwnProperty.call(object, key)
}

// Export
module.exports = {
	hasDuplicates,
	hasOwn,
	parseAmount,
	parseId,
	parseIdArray
}
