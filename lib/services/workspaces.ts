import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  where
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Workspace, WorkspaceMember } from "../models/types";

const workspacesCollection = collection(db, "workspaces");

export async function listWorkspaces(): Promise<Workspace[]> {
  const snapshot = await getDocs(query(workspacesCollection, orderBy("name")));
  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    name: String(docItem.data().name || "")
  }));
}

export async function createWorkspace(name: string) {
  const workspaceRef = doc(workspacesCollection);
  await setDoc(workspaceRef, {
    name,
    createdAt: Timestamp.now()
  });
  return workspaceRef.id;
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const snapshot = await getDoc(doc(db, "workspaces", workspaceId));
  if (!snapshot.exists()) return null;
  return {
    id: snapshot.id,
    name: String(snapshot.data().name || "")
  };
}

export async function getWorkspaceMembershipForUser(
  userId: string
): Promise<WorkspaceMember | null> {
  const membershipQuery = query(
    collectionGroup(db, "workspaceMembers"),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(membershipQuery);
  const membershipDoc = snapshot.docs[0];
  if (!membershipDoc) return null;
  const workspaceId = membershipDoc.ref.parent.parent?.id;
  if (!workspaceId) return null;
  const data = membershipDoc.data();
  return {
    workspaceId,
    userId,
    role: data.role,
    email: data.email,
    displayName: data.displayName
  };
}

export async function upsertWorkspaceMember(
  workspaceId: string,
  member: WorkspaceMember
) {
  const memberRef = doc(
    db,
    "workspaces",
    workspaceId,
    "workspaceMembers",
    member.userId
  );
  await setDoc(
    memberRef,
    {
      userId: member.userId,
      role: member.role,
      email: member.email || "",
      displayName: member.displayName || "",
      status: member.status || "active",
      createdAt: member.createdAt || "",
      updatedAt: Timestamp.now()
    },
    { merge: true }
  );
}

export async function listWorkspaceMembers(
  workspaceId: string
): Promise<WorkspaceMember[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "workspaces", workspaceId, "workspaceMembers"),
      orderBy("email")
    )
  );
  return snapshot.docs.map((docItem) => {
    const data = docItem.data();
    return {
      workspaceId,
      userId: docItem.id,
      role: data.role,
      email: data.email,
      displayName: data.displayName,
      status: data.status,
      createdAt: data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : data.createdAt
    };
  });
}
