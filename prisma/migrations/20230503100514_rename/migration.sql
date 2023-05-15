/*
  Warnings:

  - The primary key for the `KeyUser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `userNpub` on the `KeyUser` table. All the data in the column will be lost.
  - Added the required column `id` to the `KeyUser` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userPubkey` to the `KeyUser` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_KeyUser" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyName" TEXT NOT NULL,
    "userPubkey" TEXT NOT NULL
);
INSERT INTO "new_KeyUser" ("keyName") SELECT "keyName" FROM "KeyUser";
DROP TABLE "KeyUser";
ALTER TABLE "new_KeyUser" RENAME TO "KeyUser";
CREATE UNIQUE INDEX "KeyUser_keyName_userPubkey_key" ON "KeyUser"("keyName", "userPubkey");
CREATE TABLE "new_SigningCondition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" INTEGER,
    "content" TEXT,
    "keyUserKeyName" TEXT,
    "allowed" BOOLEAN,
    "keyUserId" INTEGER,
    CONSTRAINT "SigningCondition_keyUserId_fkey" FOREIGN KEY ("keyUserId") REFERENCES "KeyUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SigningCondition" ("allowed", "content", "id", "keyUserKeyName", "kind") SELECT "allowed", "content", "id", "keyUserKeyName", "kind" FROM "SigningCondition";
DROP TABLE "SigningCondition";
ALTER TABLE "new_SigningCondition" RENAME TO "SigningCondition";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
