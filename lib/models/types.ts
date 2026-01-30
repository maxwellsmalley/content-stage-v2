export type Role = "super_admin" | "admin" | "user";

export type PageStatus = "draft" | "in_review" | "approved";

export type BlockType =
  | "hero"
  | "banner"
  | "content"
  | "card_list"
  | "tab_content"
  | "media";

export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export type HeadingField = {
  text: string;
  level: HeadingLevel;
};

export type ButtonField = {
  label: string;
  url: string;
};

export type MediaField = {
  src: string;
  alt: string;
  caption?: string;
  type?: "image" | "video";
  aspectRatio?: "16:9" | "4:3" | "1:1" | "3:4";
  fullWidth?: boolean;
  fileName?: string;
};

export type HeroFields = {
  heading: HeadingField;
  body: string;
  primaryButton: ButtonField;
  secondaryButton: ButtonField;
  media: MediaField;
  textAlignment: "left" | "center" | "right";
  mediaAlignment: "left" | "right";
  behindMediaOverlay: boolean;
  variant: string;
  textColor: "black" | "white";
};

export type BannerFields = {
  heading: HeadingField;
  body: string;
  primaryButton: ButtonField;
  secondaryButton: ButtonField;
  media: MediaField;
  textAlignment: "left" | "center" | "right";
  mediaAlignment: "left" | "right";
  backgroundMode: "background" | "behind_media";
  backgroundImageUrl: string;
  backgroundColor: string;
  imageFitToTextHeight: boolean;
  variant: string;
  textColor: "black" | "white";
};

export type ContentFields = {
  heading: HeadingField;
  body: string;
  primaryButton: ButtonField;
  secondaryButton: ButtonField;
  media: MediaField;
  imagePosition: "left" | "right" | "above" | "below";
  eyebrow: string;
  variant: string;
};

export type CardListFields = {
  heading: HeadingField;
  description: string;
  primaryButton: ButtonField;
  cards: Array<{
    heading: string;
    description: string;
    imageUrl: string;
    imageAlt: string;
    eyebrow: string;
    button: ButtonField;
  }>;
  displayMode: "grid" | "carousel";
  columns: 2 | 3 | 4;
  imagePosition: "top" | "left" | "background";
  imageAspectRatio: "16:9" | "4:3" | "1:1" | "3:4";
};

export type TabContentFields = {
  mainHeading: HeadingField;
  mainDescription: string;
  tabs: Array<{
    name: string;
    heading: HeadingField;
    body: string;
    button: ButtonField;
    media: MediaField;
    imagePosition: "left" | "right" | "above" | "below";
    eyebrow: string;
  }>;
};

export type MediaFields = {
  media: MediaField;
  gallery?: MediaField[];
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

export type Folder = {
  id: string;
  name: string;
  parentId?: string | null;
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
