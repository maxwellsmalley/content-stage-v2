import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import {
  Document as PdfDocument,
  Page as PdfPage,
  StyleSheet,
  Text,
  View,
  pdf
} from "@react-pdf/renderer";
import { createElement } from "react";
import { db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { downloadBlob, downloadJson } from "../utils/export";

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

const pdfStyles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    color: "#1b1b1b",
    lineHeight: 1.4
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 8
  },
  metaRow: {
    marginBottom: 4
  },
  metaLabel: {
    fontWeight: 600
  },
  section: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e2e2",
    borderTopStyle: "solid"
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 4
  },
  blockPurpose: {
    fontSize: 11,
    marginBottom: 6
  },
  item: {
    marginBottom: 3
  },
  itemLabel: {
    fontWeight: 600
  }
});

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

  const pageData = pageSnapshot.data();
  const pageTitle = String(pageData.title || "Untitled page");
  const pageStatus = String(pageData.status || "draft");
  const exportDate = new Date();
  const slug = slugify(pageTitle);
  const metaTitle = String(pageData.metaTitle || "");
  const metaDescription = String(pageData.metaDescription || "");

  const blocks = blocksSnapshot.docs.map((blockDoc, index) => ({
    id: blockDoc.id,
    type: blockDoc.data().type,
    fields: blockDoc.data().fields,
    order: blockDoc.data().order,
    index
  }));

  const assetIndex = new Map<string, { filename: string; url: string }>();
  const usedNames = new Set<string>();

  const registerAsset = (url: string | undefined, context: string) => {
    if (!url) return "";
    const existing = assetIndex.get(url);
    if (existing) return existing.filename;
    const filename = buildAssetFilename(context, url, usedNames);
    assetIndex.set(url, { filename, url });
    return filename;
  };

  const blockExports = blocks.map((block) => {
    const fields: any = block.fields || {};
    const blockType = String(block.type || "");
    const blockName = blockTypeLabel(blockType);
    const purpose = blockPurpose(blockType);
    const items: Array<{ label: string; value: string }> = [];

    const headingText = fields.heading?.text;
    const headingLevel = fields.heading?.level;
    const mainHeadingText = fields.mainHeading?.text;
    const mainHeadingLevel = fields.mainHeading?.level;

    if (headingText) {
      items.push({
        label: "Heading",
        value: `${headingText} (${String(headingLevel || "h2").toUpperCase()})`
      });
    }
    if (mainHeadingText) {
      items.push({
        label: "Main heading",
        value: `${mainHeadingText} (${String(mainHeadingLevel || "h2").toUpperCase()})`
      });
    }
    if (fields.body) {
      items.push({ label: "Body copy", value: String(fields.body) });
    }
    if (fields.mainDescription) {
      items.push({ label: "Main description", value: String(fields.mainDescription) });
    }
    if (fields.eyebrow) {
      items.push({ label: "Eyebrow", value: String(fields.eyebrow) });
    }
    if (fields.primaryButton?.label || fields.primaryButton?.url) {
      items.push({
        label: "Primary CTA",
        value: `${fields.primaryButton?.label || ""} → ${fields.primaryButton?.url || ""}`.trim()
      });
    }
    if (fields.secondaryButton?.label || fields.secondaryButton?.url) {
      items.push({
        label: "Secondary CTA",
        value: `${fields.secondaryButton?.label || ""} → ${fields.secondaryButton?.url || ""}`.trim()
      });
    }

    if (fields.textAlignment) {
      items.push({ label: "Text alignment", value: String(fields.textAlignment) });
    }
    if (fields.mediaAlignment) {
      items.push({ label: "Media alignment", value: String(fields.mediaAlignment) });
    }
    if (fields.textColor) {
      items.push({ label: "Text color", value: String(fields.textColor) });
    }
    if (fields.imagePosition) {
      items.push({ label: "Image position", value: String(fields.imagePosition) });
    }
    if (fields.variant) {
      items.push({ label: "Variant", value: String(fields.variant) });
    }

    if (fields.media?.src) {
      items.push({
        label: "Media",
        value: registerAsset(fields.media.src, `${block.index + 1}-${blockType}-media`)
      });
    }
    if (fields.media?.caption) {
      items.push({ label: "Media caption", value: String(fields.media.caption) });
    }
    if (fields.media?.alt) {
      items.push({ label: "Media alt text", value: String(fields.media.alt) });
    }
    if (fields.media?.aspectRatio) {
      items.push({ label: "Aspect ratio", value: String(fields.media.aspectRatio) });
    }
    if (typeof fields.media?.fullWidth === "boolean") {
      items.push({ label: "Full width", value: fields.media.fullWidth ? "Yes" : "No" });
    }

    if (Array.isArray(fields.gallery) && fields.gallery.length > 0) {
      const galleryNames = fields.gallery.map((item: any, idx: number) =>
        registerAsset(item?.src, `${block.index + 1}-${blockType}-gallery-${idx + 1}`)
      );
      items.push({ label: "Gallery images", value: galleryNames.filter(Boolean).join(", ") });
    }

    if (Array.isArray(fields.cards) && fields.cards.length > 0) {
      fields.cards.forEach((card: any, cardIndex: number) => {
        items.push({
          label: `Card ${cardIndex + 1} heading`,
          value: String(card.heading || "")
        });
        if (card.eyebrow) {
          items.push({
            label: `Card ${cardIndex + 1} eyebrow`,
            value: String(card.eyebrow)
          });
        }
        if (card.description) {
          items.push({
            label: `Card ${cardIndex + 1} description`,
            value: String(card.description)
          });
        }
        if (card.imageUrl) {
          items.push({
            label: `Card ${cardIndex + 1} image`,
            value: registerAsset(
              card.imageUrl,
              `${block.index + 1}-${blockType}-card-${cardIndex + 1}`
            )
          });
        }
        if (card.button?.label || card.button?.url) {
          items.push({
            label: `Card ${cardIndex + 1} CTA`,
            value: `${card.button?.label || ""} → ${card.button?.url || ""}`.trim()
          });
        }
      });
    }

    if (Array.isArray(fields.tabs) && fields.tabs.length > 0) {
      fields.tabs.forEach((tab: any, tabIndex: number) => {
        items.push({ label: `Tab ${tabIndex + 1} name`, value: String(tab.name || "") });
        if (tab.heading?.text) {
          items.push({
            label: `Tab ${tabIndex + 1} heading`,
            value: `${tab.heading.text} (${String(tab.heading.level || "h3").toUpperCase()})`
          });
        }
        if (tab.body) {
          items.push({ label: `Tab ${tabIndex + 1} body`, value: String(tab.body) });
        }
        if (tab.eyebrow) {
          items.push({ label: `Tab ${tabIndex + 1} eyebrow`, value: String(tab.eyebrow) });
        }
        if (tab.button?.label || tab.button?.url) {
          items.push({
            label: `Tab ${tabIndex + 1} CTA`,
            value: `${tab.button?.label || ""} → ${tab.button?.url || ""}`.trim()
          });
        }
        if (tab.imagePosition) {
          items.push({
            label: `Tab ${tabIndex + 1} image position`,
            value: String(tab.imagePosition)
          });
        }
        if (tab.media?.src) {
          items.push({
            label: `Tab ${tabIndex + 1} media`,
            value: registerAsset(
              tab.media.src,
              `${block.index + 1}-${blockType}-tab-${tabIndex + 1}`
            )
          });
        }
      });
    }

    if (fields.displayMode) {
      items.push({ label: "Display mode", value: String(fields.displayMode) });
    }
    if (fields.columns) {
      items.push({ label: "Columns", value: String(fields.columns) });
    }
    if (fields.imagePosition && blockType === "card_list") {
      items.push({ label: "Image position", value: String(fields.imagePosition) });
    }
    if (fields.imageAspectRatio) {
      items.push({ label: "Image aspect ratio", value: String(fields.imageAspectRatio) });
    }

    return {
      name: blockName,
      purpose,
      items,
      type: blockType,
      order: block.order
    };
  });

  const pdfDocument = createElement(
    PdfDocument,
    null,
    createElement(
      PdfPage,
      { size: "A4", style: pdfStyles.page },
      createElement(Text, { style: pdfStyles.title }, "Content Stage Page Handover"),
      createElement(
        View,
        { style: pdfStyles.metaRow },
        createElement(
          Text,
          null,
          createElement(Text, { style: pdfStyles.metaLabel }, "Page title: "),
          pageTitle
        )
      ),
      createElement(
        View,
        { style: pdfStyles.metaRow },
        createElement(
          Text,
          null,
          createElement(Text, { style: pdfStyles.metaLabel }, "URL / slug: "),
          slug ? `/${slug}` : "Not set"
        )
      ),
      createElement(
        View,
        { style: pdfStyles.metaRow },
        createElement(
          Text,
          null,
          createElement(Text, { style: pdfStyles.metaLabel }, "Meta title: "),
          metaTitle || "Not set"
        )
      ),
      createElement(
        View,
        { style: pdfStyles.metaRow },
        createElement(
          Text,
          null,
          createElement(Text, { style: pdfStyles.metaLabel }, "Meta description: "),
          metaDescription || "Not set"
        )
      ),
      createElement(
        View,
        { style: pdfStyles.metaRow },
        createElement(
          Text,
          null,
          createElement(Text, { style: pdfStyles.metaLabel }, "Page status: "),
          pageStatus
        )
      ),
      createElement(
        View,
        { style: pdfStyles.metaRow },
        createElement(
          Text,
          null,
          createElement(Text, { style: pdfStyles.metaLabel }, "Export date: "),
          exportDate.toLocaleString()
        )
      ),
      ...blockExports.map((block, idx) =>
        createElement(
          View,
          { key: `${block.type}-${block.order}`, style: pdfStyles.section },
          createElement(
            Text,
            { style: pdfStyles.blockTitle },
            `Block ${idx + 1}: ${block.name}`
          ),
          createElement(
            Text,
            { style: pdfStyles.blockPurpose },
            createElement(Text, { style: pdfStyles.metaLabel }, "Purpose: "),
            block.purpose
          ),
          ...block.items.map((item, itemIdx) =>
            createElement(
              Text,
              { key: `${block.type}-${itemIdx}`, style: pdfStyles.item },
              createElement(Text, { style: pdfStyles.itemLabel }, `${item.label}: `),
              item.value || "Not set"
            )
          )
        )
      )
    )
  );

  const pdfBlob = await pdf(pdfDocument).toBlob();
  downloadBlob(`content-stage-page-${slug || pageSnapshot.id}-handover.pdf`, pdfBlob);

  if (assetIndex.size > 0) {
    const callable = httpsCallable(functions, "exportPageAssetsZip");
    const response = await callable({
      workspaceId,
      projectId,
      pageId,
      assets: Array.from(assetIndex.values()),
      fileBase: `content-stage-page-${slug || pageSnapshot.id}-assets.zip`
    });
    const payload = response.data as { url?: string };
    if (payload?.url) {
      const link = document.createElement("a");
      link.href = payload.url;
      link.download = `content-stage-page-${slug || pageSnapshot.id}-assets.zip`;
      link.click();
    }
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function blockTypeLabel(type: string) {
  switch (type) {
    case "hero":
      return "Hero";
    case "banner":
      return "Banner";
    case "content":
      return "Content";
    case "card_list":
      return "Card list";
    case "tab_content":
      return "Tabbed content";
    case "media":
      return "Media";
    default:
      return "Block";
  }
}

function blockPurpose(type: string) {
  switch (type) {
    case "hero":
      return "Primary page introduction with headline, supporting copy, and key CTA.";
    case "banner":
      return "Supporting callout with concise messaging and a CTA.";
    case "content":
      return "Primary content section with narrative copy, media, and CTA.";
    case "card_list":
      return "Collection of related items presented as cards.";
    case "tab_content":
      return "Tabbed content areas with per-tab copy and media.";
    case "media":
      return "Standalone media area for imagery or video.";
    default:
      return "Content block.";
  }
}

function fileNameFromUrl(src?: string) {
  if (!src) return "";
  try {
    const url = new URL(src);
    const path = url.pathname.split("/").pop() || "";
    return decodeURIComponent(path);
  } catch {
    return src.split("/").pop() || "";
  }
}

function buildAssetFilename(context: string, url: string, usedNames: Set<string>) {
  const original = fileNameFromUrl(url);
  const parts = original.split(".");
  const ext = parts.length > 1 ? parts.pop() || "jpg" : "jpg";
  const base = slugify(parts.join(".") || "asset");
  let candidate = `${slugify(context)}-${base}.${ext}`;
  let counter = 2;
  while (usedNames.has(candidate)) {
    candidate = `${slugify(context)}-${base}-${counter}.${ext}`;
    counter += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

