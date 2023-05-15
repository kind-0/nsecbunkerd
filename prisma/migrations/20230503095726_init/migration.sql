-- CreateTable
CREATE TABLE "KeyUser" (
    "keyName" TEXT NOT NULL PRIMARY KEY,
    "userNpub" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SigningCondition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" INTEGER,
    "content" TEXT,
    "keyUserKeyName" TEXT,
    "allowed" BOOLEAN,
    CONSTRAINT "SigningCondition_keyUserKeyName_fkey" FOREIGN KEY ("keyUserKeyName") REFERENCES "KeyUser" ("keyName") ON DELETE SET NULL ON UPDATE CASCADE
);
