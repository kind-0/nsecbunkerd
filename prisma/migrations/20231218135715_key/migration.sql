/*
  Warnings:

  - You are about to drop the column `result` on the `Request` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Key" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "pubkey" TEXT NOT NULL
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "remotePubkey" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "params" TEXT,
    "allowed" BOOLEAN
);
INSERT INTO "new_Request" ("allowed", "createdAt", "id", "keyName", "method", "params", "remotePubkey", "requestId") SELECT "allowed", "createdAt", "id", "keyName", "method", "params", "remotePubkey", "requestId" FROM "Request";
DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
