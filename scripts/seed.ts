import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create default HR admin user
  const existingUser = await db.user.findUnique({
    where: { email: "admin@resumescreen.ai" },
  });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash("admin123", 12);
    const user = await db.user.create({
      data: {
        email: "admin@resumescreen.ai",
        name: "HR Admin",
        password: hashedPassword,
        role: "hr",
      },
    });
    console.log(`✅ Created default user: ${user.email}`);
  } else {
    console.log("⏭️  Default user already exists");
  }

  console.log("🎉 Seeding complete!");
  console.log("");
  console.log("Default login credentials:");
  console.log("  Email:    admin@resumescreen.ai");
  console.log("  Password: admin123");
}

seed()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
