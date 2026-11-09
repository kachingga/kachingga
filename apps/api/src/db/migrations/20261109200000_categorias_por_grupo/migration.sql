-- Categories per group (#78): each group gets its own editable categories, starting with the 8
-- built-in ones. Hand-written so no expense loses its category: create the table, create the
-- defaults for every existing group, point each expense (and saved filter) to its group's
-- category, and only then drop the old enum column.

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "defaultKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_groupId_idx" ON "Category"("groupId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Block Supabase's REST API on new tables (see CLAUDE.md)
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;

-- The 8 built-in categories for every existing group (same as `defaultCategories` in src/schemas.ts).
-- createdAt is staggered (a few ms in the past) so they keep this order and new ones come after.
INSERT INTO "Category" ("id", "groupId", "name", "icon", "color", "defaultKey", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, g."id", d.name, d.icon, d.color, d.key,
       CURRENT_TIMESTAMP - (8 - d.ord) * INTERVAL '1 millisecond', CURRENT_TIMESTAMP
FROM "Group" g
CROSS JOIN (VALUES
    (0, 'FOOD', 'Comida', 'utensils', 'chart-2'),
    (1, 'GROCERIES', 'Súper', 'shopping-cart', 'chart-1'),
    (2, 'TRANSPORT', 'Transporte', 'car', 'chart-4'),
    (3, 'LODGING', 'Alojamiento', 'bed-double', 'chart-5'),
    (4, 'ENTERTAINMENT', 'Salidas', 'party-popper', 'chart-3'),
    (5, 'SHOPPING', 'Compras', 'shopping-bag', 'highlight'),
    (6, 'SERVICES', 'Servicios', 'zap', 'positive'),
    (7, 'OTHER', 'Otros', 'shapes', 'muted')
) AS d(ord, key, name, icon, color);

-- Every expense points to its group's category with the same key as the old enum value.
ALTER TABLE "Expense" ADD COLUMN "categoryId" TEXT;
UPDATE "Expense" e
SET "categoryId" = c."id"
FROM "Category" c
WHERE c."groupId" = e."groupId" AND c."defaultKey" = e."category"::text;
ALTER TABLE "Expense" ALTER COLUMN "categoryId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Saved filters: `categories` (old enum keys) → `categoryIds` (the group's category ids).
UPDATE "SavedFilter" f
SET "filters" = (f."filters" - 'categories') || jsonb_build_object(
    'categoryIds',
    COALESCE(
        (SELECT jsonb_agg(c."id" ORDER BY c."createdAt")
         FROM "Category" c
         WHERE c."groupId" = f."groupId"
           AND c."defaultKey" IN (SELECT jsonb_array_elements_text(f."filters" -> 'categories'))),
        '[]'::jsonb))
WHERE f."filters" ? 'categories';

-- Only now drop the old column and enum.
ALTER TABLE "Expense" DROP COLUMN "category";
DROP TYPE "ExpenseCategory";
