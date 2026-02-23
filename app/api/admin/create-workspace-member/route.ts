import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email || "").trim();
    const workspaceId = String(body?.workspaceId || "").trim();
    const role = body?.role as "admin" | "editor" | "viewer";

    const allowedRoles = ["admin", "editor", "viewer"];
    if (!email || !workspaceId || !role || !allowedRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: "Missing email, workspaceId, or role." },
        { status: 400 }
      );
    }

    let user;
    try {
      user = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
      if (error?.code === "auth/user-not-found") {
        user = await adminAuth.createUser({ email });
      } else {
        throw error;
      }
    }

    await adminAuth.generatePasswordResetLink(email);

    await adminDb
      .doc(`workspaces/${workspaceId}/workspaceMembers/${user.uid}`)
      .set(
        {
          workspaceId,
          userId: user.uid,
          email,
          role,
          status: "invited",
          createdAt: Timestamp.now()
        },
        { merge: true }
      );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Unable to invite member." },
      { status: 500 }
    );
  }
}