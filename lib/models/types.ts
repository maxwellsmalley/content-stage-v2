export type Role = "super_admin" | "admin" | "user";

export type PageStatus = "draft" | "in_review" | "approved";

export type BlockType =
  | "hero"
  | "banner"
  | "content"
  | "card_list"
  | "tab_content"
  | "media";

export type HeroFields = {
  headline: string;
  subheadline: string;
  primaryCtaLabel: string;
  primaryCtaUrl: string;
  mediaUrl: string;
};

export type BannerFields = {
  text: string;
  linkLabel: string;
  linkUrl: string;
};

export type ContentFields = {
  heading: string;
  body: string;
};

export type CardListFields = {
  heading: string;
  cards: Array<{
    title: string;
    body: string;
    linkLabel: string;
    linkUrl: string;
  }>;
};

export type TabContentFields = {
  heading: string;
  tabs: Array<{
    label: string;
    content: string;
  }>;
};

export type MediaFields = {
  mediaUrl: string;
  caption: string;
  mediaType: "image" | "video";
};

export type BlockFields =
  | HeroFields
  | BannerFields
  | ContentFields
  | CardListFields
  | TabContentFields
  | MediaFields;

export type Block = {
  id: string;
  type: BlockType;
  order: number;
  fields: BlockFields;
};

export type Page = {
  id: string;
  title: string;
  status: PageStatus;
  order: number;
  folderId?: string | null;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
};

export type Workspace = {
  id: string;
  name: string;
};

export type WorkspaceMember = {
  workspaceId: string;
  userId: string;
  role: Exclude<Role, "super_admin">;
  email?: string;
  displayName?: string;
};

export type SystemRole = {
  userId: string;
  role: "super_admin";
};

export type ProjectMember = {
  userId: string;
  assignedAt: string;
};

// TODO: Confirm block field definitions and character limits per spec updates.
