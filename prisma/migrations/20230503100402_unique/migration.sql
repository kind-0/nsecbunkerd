/*
  Warnings:

  - A unique constraint covering the columns `[keyName,userNpub]` on the table `KeyUser` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "KeyUser_keyName_userNpub_key" ON "KeyUser"("keyName", "userNpub");
