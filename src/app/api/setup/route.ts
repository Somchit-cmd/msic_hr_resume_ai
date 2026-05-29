import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/setup - One-time setup to ensure admin role is set
 * This upgrades the default admin user to have role="admin" if needed
 */
export async function GET() {
  try {
    const admin = await db.user.findUnique({
      where: { email: "admin@resumescreen.ai" },
    });

    if (!admin) {
      return NextResponse.json({
        success: false,
        message: "Admin user not found. Run the seed script first.",
      }, { status: 404 });
    }

    if (admin.role === "admin") {
      return NextResponse.json({
        success: true,
        message: "Admin user already has admin role",
        user: { email: admin.email, role: admin.role },
      });
    }

    // Upgrade to admin role
    const updated = await db.user.update({
      where: { email: "admin@resumescreen.ai" },
      data: { role: "admin" },
    });

    return NextResponse.json({
      success: true,
      message: `Upgraded user ${updated.email} from "${admin.role}" to "admin" role`,
      user: { email: updated.email, role: updated.role },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({
      success: false,
      message: `Setup failed: ${(error as Error).message}`,
    }, { status: 500 });
  }
}
