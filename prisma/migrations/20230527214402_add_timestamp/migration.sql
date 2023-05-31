-- CreateTable
CREATE TABLE "Log" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "method" TEXT,
    "params" TEXT,
    "keyUserId" INTEGER,
    CONSTRAINT "Log_keyUserId_fkey" FOREIGN KEY ("keyUserId") REFERENCES "KeyUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KeyUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyName" TEXT NOT NULL,
    "userPubkey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME
);
INSERT INTO "new_KeyUser" ("id", "keyName", "userPubkey") SELECT "id", "keyName", "userPubkey" FROM "KeyUser";
DROP TABLE "KeyUser";
ALTER TABLE "new_KeyUser" RENAME TO "KeyUser";
CREATE UNIQUE INDEX "KeyUser_keyName_userPubkey_key" ON "KeyUser"("keyName", "userPubkey");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
