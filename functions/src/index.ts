import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import archiver from "archiver";
import { randomUUID } from "crypto";

admin.initializeApp();

type AssetInput = {
  filename: string;
  url: string;
};

function storagePathFromUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("gs://")) {
    const parts = url.split("/");
    return parts.slice(3).join("/");
  }
  const match = url.match(/\/o\/([^?]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

async function hasAccess(
  workspaceId: string,
  projectId: string,
  userId: string
): Promise<boolean> {
  const db = admin.firestore();
  const systemRole = await db.doc(`systemRoles/${userId}`).get();
  if (systemRole.exists) return true;

  const workspaceMember = await db
    .doc(`workspaces/${workspaceId}/workspaceMembers/${userId}`)
    .get();
  if (workspaceMember.exists && workspaceMember.data()?.role === "admin") {
    return true;
  }

  const projectMember = await db
    .doc(`workspaces/${workspaceId}/projects/${projectId}/projectMembers/${userId}`)
    .get();
  return projectMember.exists;
}

export const exportPageAssetsZip = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to export assets."
      );
    }

    const workspaceId = String(data?.workspaceId || "");
    const projectId = String(data?.projectId || "");
    const pageId = String(data?.pageId || "");
    const fileBase = String(data?.fileBase || "content-stage-page-assets.zip");
    const assets: AssetInput[] = Array.isArray(data?.assets) ? data.assets : [];

    if (!workspaceId || !projectId || !pageId || assets.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing export parameters."
      );
    }

    const allowed = await hasAccess(workspaceId, projectId, context.auth.uid);
    if (!allowed) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You do not have access to this project."
      );
    }

    const bucket = admin.storage().bucket();
    const outputPath = `exports/${workspaceId}/${projectId}/${pageId}/${fileBase}`;
    const outputFile = bucket.file(outputPath);
    const outputStream = outputFile.createWriteStream({
      contentType: "application/zip"
    });

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(outputStream);

    for (const asset of assets) {
      if (!asset?.url || !asset?.filename) continue;
      const storagePath = storagePathFromUrl(asset.url);
      if (!storagePath) continue;
      const fileStream = bucket.file(storagePath).createReadStream();
      archive.append(fileStream, { name: asset.filename });
    }

    await new Promise<void>((resolve, reject) => {
      outputStream.on("finish", () => resolve());
      outputStream.on("error", (err: unknown) => reject(err));
      archive.on("error", (err: unknown) => reject(err));
      try {
        archive.finalize();
      } catch (err) {
        reject(err);
      }
    });

    const token = randomUUID();
    await outputFile.setMetadata({
      metadata: {
        firebaseStorageDownloadTokens: token
      }
    });

    const encodedPath = encodeURIComponent(outputPath);
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
    return { url: downloadUrl };
  });
