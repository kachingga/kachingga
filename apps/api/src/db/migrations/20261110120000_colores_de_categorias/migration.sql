-- More vibrant category colors (#84): the old palette names (chart-1…5, positive, negative,
-- highlight, primary, muted) become 12 distinct colors (tomato … cocoa, see `categoryColors`).
-- Data only: Category.color is a plain text column.

-- 1. The built-in categories nobody recolored (still on their original color) get their new one.
UPDATE "Category" SET "color" = d.new_color
FROM (VALUES
    ('FOOD', 'chart-2', 'tangerine'),
    ('GROCERIES', 'chart-1', 'lime'),
    ('TRANSPORT', 'chart-4', 'sky'),
    ('LODGING', 'chart-5', 'indigo'),
    ('ENTERTAINMENT', 'chart-3', 'raspberry'),
    ('SHOPPING', 'highlight', 'grape'),
    ('SERVICES', 'positive', 'mango'),
    ('OTHER', 'muted', 'cocoa')
) AS d(default_key, old_color, new_color)
WHERE "Category"."defaultKey" = d.default_key AND "Category"."color" = d.old_color;

-- 2. Every other category (custom ones, or built-in ones somebody recolored): closest new color.
UPDATE "Category" SET "color" = m.new_color
FROM (VALUES
    ('chart-1', 'mint'),
    ('chart-2', 'tangerine'),
    ('chart-3', 'tomato'),
    ('chart-4', 'sky'),
    ('chart-5', 'lime'),
    ('positive', 'teal'),
    ('negative', 'raspberry'),
    ('highlight', 'mango'),
    ('primary', 'teal'),
    ('muted', 'cocoa')
) AS m(old_color, new_color)
WHERE "Category"."color" = m.old_color;
