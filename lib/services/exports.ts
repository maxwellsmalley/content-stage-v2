import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { downloadJson } from "../utils/export";

export async function exportProject(
  workspaceId: string,
  projectId: string
) {
  const projectSnapshot = await getDoc(
    doc(db, "workspaces", workspaceId, "projects", projectId)
  );
  if (!projectSnapshot.exists()) return;

  const pagesSnapshot = await getDocs(
    query(
      collection(db, "workspaces", workspaceId, "projects", projectId, "pages"),
      orderBy("order")
    )
  );

  const pages = [];
  for (const pageDoc of pagesSnapshot.docs) {
    const blocksSnapshot = await getDocs(
      query(
        collection(
          db,
          "workspaces",
          workspaceId,
          "projects",
          projectId,
          "pages",
          pageDoc.id,
          "blocks"
        ),
        orderBy("order")
      )
    );

    pages.push({
      id: pageDoc.id,
      title: pageDoc.data().title,
      status: pageDoc.data().status,
      blocks: blocksSnapshot.docs.map((blockDoc) => ({
        id: blockDoc.id,
        type: blockDoc.data().type,
        fields: blockDoc.data().fields,
        order: blockDoc.data().order
      }))
    });
  }

  const payload = {
    project: {
      id: projectSnapshot.id,
      name: projectSnapshot.data().name,
      description: projectSnapshot.data().description || ""
    },
    pages,
    media: []
  };

  // TODO: Collect media files referenced by blocks and include in export output.
  downloadJson(
    `content-stage-project-${projectSnapshot.id}.json`,
    payload
  );
}

export async function exportPage(
  workspaceId: string,
  projectId: string,
  pageId: string
) {
  const pageSnapshot = await getDoc(
    doc(db, "workspaces", workspaceId, "projects", projectId, "pages", pageId)
  );
  if (!pageSnapshot.exists()) return;

  const blocksSnapshot = await getDocs(
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

  const payload = {
    page: {
      id: pageSnapshot.id,
      title: pageSnapshot.data().title,
      status: pageSnapshot.data().status
    },
    blocks: blocksSnapshot.docs.map((blockDoc) => ({
      id: blockDoc.id,
      type: blockDoc.data().type,
      fields: blockDoc.data().fields,
      order: blockDoc.data().order
    })),
    media: []
  };

  // TODO: Collect media files referenced by blocks and include in export output.
  downloadJson(`content-stage-page-${pageSnapshot.id}.json`, payload);
}
