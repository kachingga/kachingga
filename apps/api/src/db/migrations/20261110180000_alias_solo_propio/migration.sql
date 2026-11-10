-- Only each person sets their own alias (#106): participants without account have none.
-- Data only: clears the group alias that someone else set for a participant without account.
UPDATE "Participant" SET "paymentAlias" = NULL WHERE "userId" IS NULL;
