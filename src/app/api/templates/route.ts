import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/templates - List all templates for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;

    const templates = await db.jDTemplate.findMany({
      where: { userId },
      orderBy: [{ usageCount: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await request.json();

    const {
      name,
      jobTitle,
      department,
      employmentType,
      experienceLevel,
      location,
      salaryCurrency,
      salaryRange,
      requiredSkills,
      preferredSkills,
      education,
      responsibilities,
      additionalNotes,
    } = body;

    if (!name?.trim() || !jobTitle?.trim()) {
      return NextResponse.json(
        { error: "Template name and job title are required" },
        { status: 400 }
      );
    }

    const template = await db.jDTemplate.create({
      data: {
        name: name.trim(),
        jobTitle: jobTitle.trim(),
        department: department || "",
        employmentType: employmentType || "",
        experienceLevel: experienceLevel || "",
        location: location || "",
        salaryCurrency: salaryCurrency || "USD",
        salaryRange: salaryRange || "",
        requiredSkills: JSON.stringify(requiredSkills || []),
        preferredSkills: JSON.stringify(preferredSkills || []),
        education: education || "",
        responsibilities: responsibilities || "",
        additionalNotes: additionalNotes || "",
        userId,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
