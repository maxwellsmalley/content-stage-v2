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
        headline: "",
        subheadline: "",
        primaryCtaLabel: "",
        primaryCtaUrl: "",
        mediaUrl: ""
      } satisfies HeroFields;
    case "banner":
      return {
        text: "",
        linkLabel: "",
        linkUrl: ""
      } satisfies BannerFields;
    case "content":
      return {
        heading: "",
        body: ""
      } satisfies ContentFields;
    case "card_list":
      return {
        heading: "",
        cards: []
      } satisfies CardListFields;
    case "tab_content":
      return {
        heading: "",
        tabs: []
      } satisfies TabContentFields;
    case "media":
      return {
        mediaUrl: "",
        caption: "",
        mediaType: "image"
      } satisfies MediaFields;
    default:
      return { heading: "", body: "" } satisfies ContentFields;
  }
}
