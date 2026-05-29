import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/templates/[id] - Get a single template
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const template = await db.jDTemplate.findUnique({ where: { id } });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

// PUT /api/templates/[id] - Update a template (all authenticated users)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.jDTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const body = await request.json();

    const template = await db.jDTemplate.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        jobTitle: body.jobTitle?.trim() ?? existing.jobTitle,
        department: body.department ?? existing.department,
        employmentType: body.employmentType ?? existing.employmentType,
        experienceLevel: body.experienceLevel ?? existing.experienceLevel,
        location: body.location ?? existing.location,
        salaryCurrency: body.salaryCurrency ?? existing.salaryCurrency,
        salaryRange: body.salaryRange ?? existing.salaryRange,
        requiredSkills: body.requiredSkills
          ? JSON.stringify(body.requiredSkills)
          : existing.requiredSkills,
        preferredSkills: body.preferredSkills
          ? JSON.stringify(body.preferredSkills)
          : existing.preferredSkills,
        education: body.education ?? existing.education,
        responsibilities: body.responsibilities ?? existing.responsibilities,
        additionalNotes: body.additionalNotes ?? existing.additionalNotes,
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// PATCH /api/templates/[id] - Increment usage count
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const template = await db.jDTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error("Error updating usage count:", error);
    return NextResponse.json(
      { error: "Failed to update usage count" },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete a template (all authenticated users)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await db.jDTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    await db.jDTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
