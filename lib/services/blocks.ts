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

function sanitizeMedia(media: any) {
  if (!media) return media;
  return {
    src: String(media.src || ""),
    alt: String(media.alt || ""),
    caption: String(media.caption || "")
  };
}

function sanitizeFields(fields: BlockFields): BlockFields {
  const next: any = { ...fields };
  if ("media" in next) {
    next.media = sanitizeMedia(next.media);
  }
  if ("gallery" in next && Array.isArray(next.gallery)) {
    next.gallery = next.gallery.map((item: any) => sanitizeMedia(item));
  }
  if ("tabs" in next && Array.isArray(next.tabs)) {
    next.tabs = next.tabs.map((tab: any) => ({
      ...tab,
      media: sanitizeMedia(tab.media)
    }));
  }
  return next as BlockFields;
}

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
  const sanitizedFields = sanitizeFields(fields);
  console.log("Saving block fields", sanitizedFields);
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
      fields: sanitizedFields,
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
  const sanitizedFields = sanitizeFields(fields);
  console.log("Saving block fields", sanitizedFields);
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
    { fields: sanitizedFields }
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
