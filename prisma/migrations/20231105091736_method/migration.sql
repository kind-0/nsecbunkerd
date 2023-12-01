/*
  Warnings:

  - Added the required column `method` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT NOT NULL,
    "remotePubkey" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "params" TEXT
);
INSERT INTO "new_Request" ("createdAt", "id", "keyName", "remotePubkey", "requestId") SELECT "createdAt", "id", "keyName", "remotePubkey", "requestId" FROM "Request";
DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
