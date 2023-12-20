/*
  Warnings:

  - A unique constraint covering the columns `[keyName]` on the table `Key` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Key_keyName_key" ON "Key"("keyName");
