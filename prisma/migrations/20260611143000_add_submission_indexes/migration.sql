-- Add indexes used by duplicate checks and submission result ordering.
CREATE INDEX "FormSubmission_formId_createdAt_id_idx" ON "FormSubmission"("formId", "createdAt", "id");
CREATE INDEX "FormSubmission_formId_respondentId_idx" ON "FormSubmission"("formId", "respondentId");
CREATE INDEX "FormSubmission_formId_anonymousTokenHash_idx" ON "FormSubmission"("formId", "anonymousTokenHash");
CREATE INDEX "FormAnswer_fieldId_submissionId_idx" ON "FormAnswer"("fieldId", "submissionId");
