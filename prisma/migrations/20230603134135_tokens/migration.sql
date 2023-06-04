-- CreateTable
CREATE TABLE "Token" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "expiresAt" DATETIME,
    "redeemedAt" DATETIME,
    "keyUserId" INTEGER,
    "policyId" INTEGER,
    CONSTRAINT "Token_keyUserId_fkey" FOREIGN KEY ("keyUserId") REFERENCES "KeyUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Token_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_token_key" ON "Token"("token");
