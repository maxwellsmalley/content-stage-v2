import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspaceId = String(body?.workspaceId || "").trim();
    const userId = String(body?.userId || "").trim();

    if (!workspaceId || !userId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields." },
        { status: 400 }
      );
    }

    const workspaceMemberRef = adminDb.doc(
      `workspaces/${workspaceId}/workspaceMembers/${userId}`
    );
    await workspaceMemberRef.delete();

    const projectsSnapshot = await adminDb
      .collection("workspaces")
      .doc(workspaceId)
      .collection("projects")
      .get();

    let batch = adminDb.batch();
    let batchCount = 0;

    for (const projectDoc of projectsSnapshot.docs) {
      const membersSnapshot = await projectDoc.ref
        .collection("projectMembers")
        .where("userId", "==", userId)
        .get();

      for (const memberDoc of membersSnapshot.docs) {
        batch.delete(memberDoc.ref);
        batchCount += 1;

        if (batchCount >= 450) {
          await batch.commit();
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Unable to remove workspace member." },
      { status: 500 }
    );
  }
}
