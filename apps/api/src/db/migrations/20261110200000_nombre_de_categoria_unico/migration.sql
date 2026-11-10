-- Category names are unique among the group's active ones, ignoring case (#107). The API checks it
-- before writing; this index is what stops two requests at the same time. Hand-written: Prisma's
-- schema can't express a partial index on lower(name), and `prisma migrate diff` ignores it (no drift).

-- Just in case a race already left two active categories of a group with the same name: keep the
-- oldest one active and archive the others (their expenses keep them), so the index can be created.
UPDATE "Category" c
SET "archivedAt" = CURRENT_TIMESTAMP
WHERE c."archivedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Category" o
    WHERE o."groupId" = c."groupId"
      AND o."archivedAt" IS NULL
      AND lower(o."name") = lower(c."name")
      AND (o."createdAt", o."id") < (c."createdAt", c."id")
  );

-- CreateIndex
CREATE UNIQUE INDEX "Category_active_name_key" ON "Category" ("groupId", lower("name")) WHERE "archivedAt" IS NULL;
