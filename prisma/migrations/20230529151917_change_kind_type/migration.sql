-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SigningCondition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "method" TEXT,
    "kind" TEXT,
    "content" TEXT,
    "keyUserKeyName" TEXT,
    "allowed" BOOLEAN,
    "keyUserId" INTEGER,
    CONSTRAINT "SigningCondition_keyUserId_fkey" FOREIGN KEY ("keyUserId") REFERENCES "KeyUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SigningCondition" ("allowed", "content", "id", "keyUserId", "keyUserKeyName", "kind", "method") SELECT "allowed", "content", "id", "keyUserId", "keyUserKeyName", "kind", "method" FROM "SigningCondition";
DROP TABLE "SigningCondition";
ALTER TABLE "new_SigningCondition" RENAME TO "SigningCondition";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
