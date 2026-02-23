import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = String(body?.workspaceId || "").trim();
    const projectId = String(body?.projectId || "").trim();
    const userId = String(body?.userId || "").trim();

    if (!workspaceId || !projectId || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const membersRef = adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("projects")
      .doc(projectId)
      .collection("projectMembers");

    const snapshot = await membersRef.where("userId", "==", userId).get();
    const batch = adminDb.batch();

    snapshot.docs.forEach((docItem) => {
      batch.delete(docItem.ref);
    });

    if (!snapshot.empty) {
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Unable to remove project member." },
      { status: 500 }
    );
  }
}
