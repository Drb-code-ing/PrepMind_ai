ALTER TABLE "AgentTraceRun"
  ADD COLUMN "modelCallId" TEXT,
  ADD COLUMN "realtimePreparedAt" TIMESTAMP(3),
  ADD COLUMN "realtimePreparationDigest" CHAR(64),
  ADD COLUMN "firstTokenLatencyMs" INTEGER,
  ADD COLUMN "finishReason" TEXT,
  ADD COLUMN "verifiedInputTokens" INTEGER,
  ADD COLUMN "verifiedOutputTokens" INTEGER,
  ADD COLUMN "priceProfile" TEXT,
  ADD COLUMN "verifiedCostCny" DECIMAL(12, 6),
  ADD COLUMN "qualityAuthority" TEXT NOT NULL DEFAULT 'none';

CREATE UNIQUE INDEX "AgentTraceRun_modelCallId_key"
  ON "AgentTraceRun"("modelCallId");

ALTER TABLE "AgentTraceRun"
  ADD CONSTRAINT "AgentTraceRun_realtime_metrics_nonnegative_check"
  CHECK (
    ("firstTokenLatencyMs" IS NULL OR "firstTokenLatencyMs" >= 0)
    AND ("verifiedInputTokens" IS NULL OR "verifiedInputTokens" >= 0)
    AND ("verifiedOutputTokens" IS NULL OR "verifiedOutputTokens" >= 0)
    AND ("verifiedCostCny" IS NULL OR "verifiedCostCny" >= 0)
  ),
  ADD CONSTRAINT "AgentTraceRun_realtime_usage_complete_check"
  CHECK (
    ("verifiedInputTokens" IS NULL
      AND "verifiedOutputTokens" IS NULL
      AND "priceProfile" IS NULL
      AND "verifiedCostCny" IS NULL)
    OR
    ("verifiedInputTokens" IS NOT NULL
      AND "verifiedOutputTokens" IS NOT NULL
      AND "priceProfile" IS NOT NULL
      AND "verifiedCostCny" IS NOT NULL)
  ),
  ADD CONSTRAINT "AgentTraceRun_quality_authority_check"
  CHECK ("qualityAuthority" = 'none'),
  ADD CONSTRAINT "AgentTraceRun_realtime_lifecycle_check"
  CHECK (
    "modelCallId" IS NULL
    OR (
      "status" = 'RUNNING'
      AND "finishedAt" IS NULL
      AND "totalDurationMs" IS NULL
      AND "firstTokenLatencyMs" IS NULL
      AND "finishReason" IS NULL
      AND "verifiedInputTokens" IS NULL
      AND "verifiedOutputTokens" IS NULL
      AND "priceProfile" IS NULL
      AND "verifiedCostCny" IS NULL
      AND (
        ("realtimePreparedAt" IS NOT NULL AND "realtimePreparationDigest" IS NOT NULL)
        OR (
          "realtimePreparationDigest" IS NULL
          AND "route" IS NULL
          AND "confidence" = 0
          AND "modelProvider" = 'pending'
          AND "modelName" = 'pending'
          AND "inputTokenEstimate" = 0
          AND "outputTokenEstimate" = 0
          AND "maxOutputTokens" = 0
          AND "pricingKnown" = FALSE
          AND "costEstimate" = 0
          AND "ragHitCount" = 0
          AND "verifierStatus" IS NULL
          AND "verifierChunkCount" = 0
          AND "tutorIntent" IS NULL
          AND "tutorDepth" IS NULL
          AND "degraded" = FALSE
          AND "inputHash" IS NULL
          AND "inputPreview" IS NULL
        )
      )
    )
    OR (
      "status" IN ('COMPLETED', 'DEGRADED')
      AND "realtimePreparedAt" IS NOT NULL
      AND "realtimePreparationDigest" IS NOT NULL
      AND "finishedAt" IS NOT NULL
      AND "totalDurationMs" IS NOT NULL
      AND "finishReason" IN ('stop', 'length', 'content_filter')
      AND "pricingKnown" = TRUE
      AND "verifiedInputTokens" IS NOT NULL
      AND "verifiedOutputTokens" IS NOT NULL
      AND "priceProfile" IS NOT NULL
      AND "verifiedCostCny" IS NOT NULL
      AND (
        ("status" = 'COMPLETED' AND "degraded" = FALSE)
        OR ("status" = 'DEGRADED' AND "degraded" = TRUE)
      )
    )
    OR (
      "status" = 'FAILED'
      AND "finishedAt" IS NOT NULL
      AND "totalDurationMs" IS NOT NULL
      AND "finishReason" IN ('failed', 'aborted')
      AND "pricingKnown" = FALSE
      AND "verifiedInputTokens" IS NULL
      AND "verifiedOutputTokens" IS NULL
      AND "priceProfile" IS NULL
      AND "verifiedCostCny" IS NULL
      AND "degraded" = TRUE
      AND (
        ("realtimePreparedAt" IS NOT NULL AND "realtimePreparationDigest" IS NOT NULL)
        OR (
          "realtimePreparationDigest" IS NULL
          AND "route" IS NULL
          AND "confidence" = 0
          AND "modelProvider" = 'pending'
          AND "modelName" = 'pending'
          AND "inputTokenEstimate" = 0
          AND "outputTokenEstimate" = 0
          AND "maxOutputTokens" = 0
          AND "costEstimate" = 0
          AND "ragHitCount" = 0
          AND "verifierStatus" IS NULL
          AND "verifierChunkCount" = 0
          AND "tutorIntent" IS NULL
          AND "tutorDepth" IS NULL
          AND "inputHash" IS NULL
          AND "inputPreview" IS NULL
        )
      )
    )
  ),
  ADD CONSTRAINT "AgentTraceRun_realtime_preparation_timeline_check"
  CHECK (
    ("realtimePreparedAt" IS NULL AND "realtimePreparationDigest" IS NULL)
    OR (
      "realtimePreparedAt" >= "startedAt"
      AND "realtimePreparationDigest" IS NOT NULL
      AND ("finishedAt" IS NULL OR "realtimePreparedAt" <= "finishedAt")
    )
  );
