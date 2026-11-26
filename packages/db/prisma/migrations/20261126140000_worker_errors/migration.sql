-- Journal des erreurs du worker
CREATE TABLE "WorkerError" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "subject" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkerError_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkerError_key_key" ON "WorkerError"("key");
CREATE INDEX "WorkerError_lastAt_idx" ON "WorkerError"("lastAt");
