import {
  addDoc,
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
import { Project, ProjectMember } from "../models/types";

export async function createProject(
  workspaceId: string,
  name: string,
  description?: string
) {
  const projectRef = await addDoc(
    collection(db, "workspaces", workspaceId, "projects"),
    {
      name,
      description: description || "",
      createdAt: Timestamp.now()
    }
  );
  return projectRef.id;
}

export async function getProject(
  workspaceId: string,
  projectId: string
): Promise<Project | null> {
  const snapshot = await getDoc(
    doc(db, "workspaces", workspaceId, "projects", projectId)
  );
  if (!snapshot.exists()) return null;
  return {
    id: snapshot.id,
    name: String(snapshot.data().name || ""),
    description: String(snapshot.data().description || "")
  };
}

export async function listProjectsForWorkspace(
  workspaceId: string
): Promise<Project[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "workspaces", workspaceId, "projects"),
      orderBy("name")
    )
  );
  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    name: String(docItem.data().name || ""),
    description: String(docItem.data().description || "")
  }));
}

export async function listProjectsForUser(
  workspaceId: string,
  userId: string
): Promise<Project[]> {
  const membershipQuery = query(
    collectionGroup(db, "projectMembers"),
    where("userId", "==", userId),
    where("workspaceId", "==", workspaceId)
  );
  const membershipSnapshot = await getDocs(membershipQuery);
  const projects: Project[] = [];
  for (const membershipDoc of membershipSnapshot.docs) {
    const projectId = membershipDoc.ref.parent.parent?.id;
    if (!projectId) continue;
    const projectSnapshot = await getDoc(
      doc(db, "workspaces", workspaceId, "projects", projectId)
    );
    if (!projectSnapshot.exists()) continue;
    projects.push({
      id: projectSnapshot.id,
      name: String(projectSnapshot.data().name || ""),
      description: String(projectSnapshot.data().description || "")
    });
  }
  return projects;
}

export async function upsertProjectMember(
  workspaceId: string,
  projectId: string,
  member: ProjectMember
) {
  await setDoc(
    doc(
      db,
      "workspaces",
      workspaceId,
      "projects",
      projectId,
      "projectMembers",
      member.userId
    ),
    {
      userId: member.userId,
      workspaceId,
      assignedAt: member.assignedAt
    },
    { merge: true }
  );
}

export async function hasProjectAccess(
  workspaceId: string,
  projectId: string,
  userId: string
): Promise<boolean> {
  const snapshot = await getDoc(
    doc(
      db,
      "workspaces",
      workspaceId,
      "projects",
      projectId,
      "projectMembers",
      userId
    )
  );
  return snapshot.exists();
}
