import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import { db } from "@/lib/firebase";
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
    const jsonFields = buildJsonFields(blockType, fields, block.index, registerAsset);

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
      jsonFields,
      type: blockType,
      order: block.order,
      fields
    };
  });

  const docParagraphs: Paragraph[] = [
    new Paragraph({
      text: "Content Stage Page Handover",
      heading: HeadingLevel.HEADING_1
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Page title: ", bold: true }),
        new TextRun(pageTitle)
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "URL / slug: ", bold: true }),
        new TextRun(slug ? `/${slug}` : "Not set")
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Meta title: ", bold: true }),
        new TextRun(metaTitle || "Not set")
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Meta description: ", bold: true }),
        new TextRun(metaDescription || "Not set")
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Page status: ", bold: true }),
        new TextRun(pageStatus)
      ]
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Export date: ", bold: true }),
        new TextRun(exportDate.toLocaleString())
      ]
    }),
    new Paragraph({ text: "" })
  ];

  blockExports.forEach((block, idx) => {
    docParagraphs.push(
      new Paragraph({
        text: `Block ${idx + 1}: ${block.name}`,
        heading: HeadingLevel.HEADING_2
      })
    );
    docParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "Purpose: ", bold: true }), new TextRun(block.purpose)]
      })
    );
    block.items.forEach((item) => {
      docParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${item.label}: `, bold: true }),
            new TextRun(item.value || "Not set")
          ]
        })
      );
    });
    docParagraphs.push(new Paragraph({ text: "" }));
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docParagraphs
      }
    ]
  });

  const docBlob = await Packer.toBlob(doc);
  downloadBlob(`content-stage-page-${slug || pageSnapshot.id}-handover.docx`, docBlob);

  const jsonPayload = {
    page: {
      id: pageSnapshot.id,
      title: pageTitle,
      slug,
      metaTitle,
      metaDescription,
      status: pageStatus,
      exportDate: exportDate.toISOString()
    },
    blocks: blockExports.map((block) => ({
      type: block.type,
      name: block.name,
      purpose: block.purpose,
      order: block.order,
      fields: block.jsonFields
    }))
  };
  downloadJson(`content-stage-page-${slug || pageSnapshot.id}-handover.json`, jsonPayload);

  if (assetIndex.size > 0) {
    const zip = new JSZip();
    const assetsFolder = zip.folder(`content-stage-page-${slug || pageSnapshot.id}-assets`);
    if (assetsFolder) {
      await Promise.all(
        Array.from(assetIndex.values()).map(async (asset) => {
          const response = await fetch(asset.url);
          const blob = await response.blob();
          assetsFolder.file(asset.filename, blob);
        })
      );
      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(`content-stage-page-${slug || pageSnapshot.id}-assets.zip`, zipBlob);
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

function buildJsonFields(
  blockType: string,
  fields: any,
  blockIndex: number,
  registerAsset: (url: string | undefined, context: string) => string
) {
  switch (blockType) {
    case "hero":
      return {
        heading: {
          text: fields.heading?.text || "",
          level: String(fields.heading?.level || "h1")
        },
        body: fields.body || "",
        primaryButton: fields.primaryButton || { label: "", url: "" },
        secondaryButton: fields.secondaryButton || { label: "", url: "" },
        textAlignment: fields.textAlignment || "left",
        mediaAlignment: fields.mediaAlignment || "right",
        textColor: fields.textColor || "black",
        behindMediaOverlay: Boolean(fields.behindMediaOverlay),
        media: fields.media?.src
          ? {
              file: registerAsset(fields.media.src, `${blockIndex + 1}-hero-media`),
              type: fields.media?.type || "image",
              alt: fields.media?.alt || "",
              caption: fields.media?.caption || ""
            }
          : null
      };
    case "banner":
      return {
        heading: {
          text: fields.heading?.text || "",
          level: String(fields.heading?.level || "h2")
        },
        body: fields.body || "",
        primaryButton: fields.primaryButton || { label: "", url: "" },
        secondaryButton: fields.secondaryButton || { label: "", url: "" },
        textAlignment: fields.textAlignment || "left",
        mediaAlignment: fields.mediaAlignment || "right",
        textColor: fields.textColor || "black",
        media: fields.media?.src
          ? {
              file: registerAsset(fields.media.src, `${blockIndex + 1}-banner-media`),
              type: fields.media?.type || "image",
              alt: fields.media?.alt || "",
              caption: fields.media?.caption || ""
            }
          : null
      };
    case "content":
      return {
        eyebrow: fields.eyebrow || "",
        heading: {
          text: fields.heading?.text || "",
          level: String(fields.heading?.level || "h2")
        },
        body: fields.body || "",
        primaryButton: fields.primaryButton || { label: "", url: "" },
        secondaryButton: fields.secondaryButton || { label: "", url: "" },
        imagePosition: fields.imagePosition || "right",
        media: fields.media?.src
          ? {
              file: registerAsset(fields.media.src, `${blockIndex + 1}-content-media`),
              type: fields.media?.type || "image",
              alt: fields.media?.alt || "",
              caption: fields.media?.caption || ""
            }
          : null
      };
    case "card_list":
      return {
        heading: {
          text: fields.heading?.text || "",
          level: String(fields.heading?.level || "h2")
        },
        description: fields.description || "",
        primaryButton: fields.primaryButton || { label: "", url: "" },
        displayMode: fields.displayMode || "grid",
        columns: fields.columns || 3,
        imagePosition: fields.imagePosition || "top",
        imageAspectRatio: fields.imageAspectRatio || "16:9",
        cards: Array.isArray(fields.cards)
          ? fields.cards.map((card: any, cardIndex: number) => ({
              heading: card.heading || "",
              description: card.description || "",
              eyebrow: card.eyebrow || "",
              image: card.imageUrl
                ? registerAsset(
                    card.imageUrl,
                    `${blockIndex + 1}-card-list-card-${cardIndex + 1}`
                  )
                : "",
              button: card.button || { label: "", url: "" }
            }))
          : []
      };
    case "tab_content":
      return {
        mainHeading: {
          text: fields.mainHeading?.text || "",
          level: String(fields.mainHeading?.level || "h2")
        },
        mainDescription: fields.mainDescription || "",
        tabs: Array.isArray(fields.tabs)
          ? fields.tabs.map((tab: any, tabIndex: number) => ({
              name: tab.name || "",
              heading: {
                text: tab.heading?.text || "",
                level: String(tab.heading?.level || "h3")
              },
              body: tab.body || "",
              eyebrow: tab.eyebrow || "",
              button: tab.button || { label: "", url: "" },
              imagePosition: tab.imagePosition || "right",
              media: tab.media?.src
                ? registerAsset(
                    tab.media.src,
                    `${blockIndex + 1}-tab-content-tab-${tabIndex + 1}`
                  )
                : ""
            }))
          : []
      };
    case "media":
      return {
        media: fields.media?.src
          ? {
              file: registerAsset(fields.media.src, `${blockIndex + 1}-media-single`),
              type: fields.media?.type || "image",
              alt: fields.media?.alt || "",
              caption: fields.media?.caption || "",
              aspectRatio: fields.media?.aspectRatio || "16:9",
              fullWidth: Boolean(fields.media?.fullWidth)
            }
          : null,
        gallery: Array.isArray(fields.gallery)
          ? fields.gallery.map((item: any, itemIndex: number) =>
              registerAsset(item?.src, `${blockIndex + 1}-media-gallery-${itemIndex + 1}`)
            )
          : []
      };
    default:
      return fields || {};
  }
}
