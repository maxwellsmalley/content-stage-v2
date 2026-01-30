import {
  BannerFields,
  CardListFields,
  ContentFields,
  HeroFields,
  MediaFields,
  TabContentFields,
  BlockType
} from "../models/types";

export const blockTypeLabels: Record<BlockType, string> = {
  hero: "Hero Block",
  banner: "Banner Block",
  content: "Content Block",
  card_list: "Card List Block",
  tab_content: "Tab Content Block",
  media: "Media Block"
};

export function createDefaultFields(type: BlockType) {
  switch (type) {
    case "hero":
      return {
        heading: { text: "", level: "h1" },
        body: "",
        primaryButton: { label: "", url: "" },
        secondaryButton: { label: "", url: "" },
        media: { src: "", type: "image", alt: "" },
        textAlignment: "left",
        mediaAlignment: "right",
        behindMediaOverlay: false,
        variant: "",
        textColor: "black"
      } satisfies HeroFields;
    case "banner":
      return {
        heading: { text: "", level: "h2" },
        body: "",
        primaryButton: { label: "", url: "" },
        secondaryButton: { label: "", url: "" },
        media: { src: "", type: "image", alt: "" },
        textAlignment: "left",
        mediaAlignment: "right",
        backgroundMode: "background",
        backgroundImageUrl: "",
        backgroundColor: "",
        imageFitToTextHeight: false,
        variant: "",
        textColor: "black"
      } satisfies BannerFields;
    case "content":
      return {
        heading: { text: "", level: "h2" },
        body: "",
        primaryButton: { label: "", url: "" },
        secondaryButton: { label: "", url: "" },
        media: { src: "", type: "image", alt: "", caption: "" },
        imagePosition: "right",
        eyebrow: "",
        variant: ""
      } satisfies ContentFields;
    case "card_list":
      return {
        heading: { text: "", level: "h2" },
        description: "",
        primaryButton: { label: "", url: "" },
        cards: [],
        displayMode: "grid",
        columns: 3,
        imagePosition: "top",
        imageAspectRatio: "16:9"
      } satisfies CardListFields;
    case "tab_content":
      return {
        mainHeading: { text: "", level: "h2" },
        mainDescription: "",
        tabs: []
      } satisfies TabContentFields;
    case "media":
      return {
        media: {
          src: "",
          type: "image",
          alt: "",
          caption: "",
          aspectRatio: "16:9",
          fullWidth: false
        },
        gallery: []
      } satisfies MediaFields;
    default:
      return {
        heading: { text: "", level: "h2" },
        body: "",
        primaryButton: { label: "", url: "" },
        secondaryButton: { label: "", url: "" },
        media: { src: "", type: "image", alt: "", caption: "" },
        imagePosition: "right",
        eyebrow: "",
        variant: ""
      } satisfies ContentFields;
  }
}
