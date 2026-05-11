ALTER TABLE "Product" ADD COLUMN "gender" TEXT;
ALTER TABLE "Product" ADD COLUMN "audience" TEXT;

CREATE INDEX "Product_gender_idx" ON "Product"("gender");
CREATE INDEX "Product_audience_idx" ON "Product"("audience");
