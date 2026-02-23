import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const workspaceId = String(body?.workspaceId || "").trim();
    const projectId = String(body?.projectId || "").trim();
    const userId = String(body?.userId || "").trim();
    const role = body?.role as "editor" | "viewer";

    const allowedRoles = ["editor", "viewer"];

    if (!workspaceId || !projectId || !userId || !role || !allowedRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const projectRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("projects")
      .doc(projectId);

    const projectDoc = await projectRef.get();

    if (!projectDoc.exists) {
      return NextResponse.json(
        { success: false, error: "Project not found." },
        { status: 404 }
      );
    }

    await projectRef
      .collection("projectMembers")
      .add({
        userId,
        role,
        createdAt: Timestamp.now(),
      });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("ASSIGN PROJECT ERROR:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}