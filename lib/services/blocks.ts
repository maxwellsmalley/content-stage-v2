import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Block, BlockFields, BlockType } from "../models/types";

export async function listBlocks(
  workspaceId: string,
  projectId: string,
  pageId: string
): Promise<Block[]> {
  const snapshot = await getDocs(
    query(
      collection(
        db,
        "workspaces",
        workspaceId,
        "projects",
        projectId,
        "pages",
        pageId,
        "blocks"
      ),
      orderBy("order")
    )
  );
  return snapshot.docs.map((docItem) => ({
    id: docItem.id,
    type: docItem.data().type,
    order: Number(docItem.data().order || 0),
    fields: docItem.data().fields as BlockFields
  }));
}

export async function addBlock(
  workspaceId: string,
  projectId: string,
  pageId: string,
  type: BlockType,
  fields: BlockFields
) {
  await addDoc(
    collection(
      db,
      "workspaces",
      workspaceId,
      "projects",
      projectId,
      "pages",
      pageId,
      "blocks"
    ),
    {
      type,
      fields,
      order: Date.now()
    }
  );
}

export async function updateBlockFields(
  workspaceId: string,
  projectId: string,
  pageId: string,
  blockId: string,
  fields: BlockFields
) {
  await updateDoc(
    doc(
      db,
      "workspaces",
      workspaceId,
      "projects",
      projectId,
      "pages",
      pageId,
      "blocks",
      blockId
    ),
    { fields }
  );
}

export async function updateBlockOrder(
  workspaceId: string,
  projectId: string,
  pageId: string,
  blockId: string,
  order: number
) {
  await setDoc(
    doc(
      db,
      "workspaces",
      workspaceId,
      "projects",
      projectId,
      "pages",
      pageId,
      "blocks",
      blockId
    ),
    { order },
    { merge: true }
  );
}

export async function removeBlock(
  workspaceId: string,
  projectId: string,
  pageId: string,
  blockId: string
) {
  await deleteDoc(
    doc(
      db,
      "workspaces",
      workspaceId,
      "projects",
      projectId,
      "pages",
      pageId,
      "blocks",
      blockId
    )
  );
}
