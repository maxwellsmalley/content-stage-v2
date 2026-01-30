import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Folder } from "../models/types";

export async function createFolder(
  workspaceId: string,
  projectId: string,
  name: string,
  parentId?: string | null
) {
  const folderRef = await addDoc(
    collection(db, "workspaces", workspaceId, "projects", projectId, "folders"),
    {
      name,
      parentId: parentId || null,
      createdAt: Timestamp.now()
    }
  );
  return folderRef.id;
}

export async function listFolders(
  workspaceId: string,
  projectId: string
): Promise<Folder[]> {
  const snapshot = await getDocs(
    query(
      collection(db, "workspaces", workspaceId, "projects", projectId, "folders"),
      orderBy("name")
    )
  );
  return snapshot.docs.map((docItem) => {
    const data = docItem.data();
    return {
      id: docItem.id,
      name: String(data.name || ""),
      parentId: data.parentId || null
    };
  });
}

export async function updateFolderName(
  workspaceId: string,
  projectId: string,
  folderId: string,
  name: string
) {
  await setDoc(
    doc(db, "workspaces", workspaceId, "projects", projectId, "folders", folderId),
    { name },
    { merge: true }
  );
}

export async function deleteFolder(
  workspaceId: string,
  projectId: string,
  folderId: string
) {
  await deleteDoc(
    doc(db, "workspaces", workspaceId, "projects", projectId, "folders", folderId)
  );
  // TODO: Decide how to handle pages/subfolders that reference deleted folders.
}
