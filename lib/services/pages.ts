import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Page, PageStatus } from "../models/types";

export async function createPage(
  workspaceId: string,
  projectId: string,
  title: string
) {
  const pageRef = await addDoc(
    collection(db, "workspaces", workspaceId, "projects", projectId, "pages"),
    {
      title,
      status: "draft",
      order: Date.now(),
      createdAt: Timestamp.now()
    }
  );
  return pageRef.id;
}

export async function getPage(
  workspaceId: string,
  projectId: string,
  pageId: string
): Promise<Page | null> {
  const snapshot = await getDoc(
    doc(
      db,
      "workspaces",
      workspaceId,
      "projects",
      projectId,
      "pages",
      pageId
    )
  );
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: String(data.title || ""),
    status: data.status as PageStatus,
    order: Number(data.order || 0),
    folderId: data.folderId || null
  };
}

export async function listPages(
  workspaceId: string,
  projectId: string
): Promise<Page[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "workspaces", workspaceId, "projects", projectId, "pages"),
      orderBy("order")
    )
  );
  return snapshot.docs.map((docItem) => {
    const data = docItem.data();
    return {
      id: docItem.id,
      title: String(data.title || ""),
      status: data.status as PageStatus,
      order: Number(data.order || 0),
      folderId: data.folderId || null
    };
  });
}

export async function updatePageStatus(
  workspaceId: string,
  projectId: string,
  pageId: string,
  status: PageStatus
) {
  await updateDoc(
    doc(db, "workspaces", workspaceId, "projects", projectId, "pages", pageId),
    { status }
  );
}

export async function updatePageTitle(
  workspaceId: string,
  projectId: string,
  pageId: string,
  title: string
) {
  await updateDoc(
    doc(db, "workspaces", workspaceId, "projects", projectId, "pages", pageId),
    { title }
  );
}

export async function savePageOrder(
  workspaceId: string,
  projectId: string,
  pageId: string,
  order: number
) {
  await setDoc(
    doc(db, "workspaces", workspaceId, "projects", projectId, "pages", pageId),
    { order },
    { merge: true }
  );
}

export async function deletePage(
  workspaceId: string,
  projectId: string,
  pageId: string
) {
  await deleteDoc(
    doc(db, "workspaces", workspaceId, "projects", projectId, "pages", pageId)
  );
}
