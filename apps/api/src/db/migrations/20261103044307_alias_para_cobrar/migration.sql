-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "paymentAlias" TEXT;

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "paymentAlias" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- Block Supabase's REST API on new tables (see CLAUDE.md)
ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
