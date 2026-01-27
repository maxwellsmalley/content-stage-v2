import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SystemRole } from "../models/types";

export async function getSystemRole(userId: string): Promise<SystemRole | null> {
  const snapshot = await getDoc(doc(db, "systemRoles", userId));
  if (!snapshot.exists()) return null;
  return { userId, role: "super_admin" };
}

export async function assignSuperAdmin(userId: string) {
  await setDoc(doc(db, "systemRoles", userId), {
    userId,
    role: "super_admin",
    assignedAt: Timestamp.now()
  });
}
