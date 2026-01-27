CONTENT_STAGE_BASE.md
1. One-sentence definition

Content Stage is a content staging and handover platform that lets teams assemble, review, and export website content in the shape of real pages before development begins.

2. What Content Stage is

Content Stage exists to remove ambiguity between content creation and website build. Teams assemble content as real pages using structured blocks, review it in context, and export it in a predictable format for developers.

It is designed for writers, editors, project managers, clients, and developers who need clarity before build, not control after launch.

3. What Content Stage is not

Content Stage is not a CMS.
It does not publish content.
It does not host websites.
It does not manage themes, styling, or responsive behaviour.
It does not replace design tools or development workflows.

Any behaviour that resembles publishing, syncing, or running a live site is out of scope.

4. Core objects

Only the objects listed below exist in the system.
If something is not listed here, it does not exist.

Roles

Super Admin
A product owner who can create workspaces, manage admins, and access all projects across the system.

Admin
A workspace manager who can create projects, invite users, and assign access within their workspace.

User
A contributor or reviewer who can access only the projects they are assigned to.

Organisational containers

Workspace
A workspace represents a single organisation or entity.
All users and projects belong to exactly one workspace.

Project
A project represents a single website, release, or body of work.
All content is created and exported at the project level or below.

Folder
A folder is an optional organisational grouping for pages.
It has no permissions and no content of its own.

Content objects

Page
A page represents a real webpage.
It is composed of blocks and always has a visible status.

Block
A block is a structured section of a page such as a hero, content section, or media block.
Blocks only exist inside pages.

System actions

Export
Export is a manual action that outputs structured content and related media for handover.
Export can occur at project level or individual page level.

5. Happy path

This is the default flow with no branching.

A Super Admin creates a workspace and assigns an Admin.

The Admin invites users to the workspace.

The Admin creates a project inside the workspace.

The Admin assigns users to the project.

Users create pages inside the project.

Users add blocks to pages and enter structured content.

Pages are reviewed and marked approved.

A user exports a page or the full project for development handover.

6. Product principles

These are enforced rules, not aspirations.

Structure

All content lives inside a workspace.

Projects are the top-level unit of work.

Pages always exist inside projects.

Blocks only exist inside pages.

Folders are organisational only.

Content

Pages are page-shaped, not document-shaped.

Blocks are structured and configured through fields.

Users never see raw data structures or JSON.

Content is edited in context, not in isolation.

Permissions

Access is explicit. Users only see what they are assigned to.

Permissions are scoped to the workspace.

Admins manage access, not content structure.

Review state

Every page has a single visible status.

Status reflects readiness for handover, not authorship.

Status changes only through deliberate user action.

Export

Export is always manual.

Export can occur at project or page level.

Page exports include only that page’s content and media.

Export produces files only and does not publish or sync.

Export reflects the current content state at the time of export.

7. Block system (V1)

Content Stage V1 supports a fixed set of base blocks.

Hero Block

Banner Block

Content Block

Card List Block

Tab Content Block

Media Block

Each block:

Has defined fields

Is ordered vertically within a page

Does not control global styling or layout systems

Does not nest inside other blocks

Character limits may be enforced per field.

8. Data ownership rules

A user belongs to one workspace.

A project belongs to one workspace.

A page belongs to one project.

A block belongs to one page.

Content is never shared across projects.

Ownership is encoded through structure, not inferred.

9. Explicit out-of-scope (V1)

The following do not exist in V1:

Publishing or hosting

Live previews or delivery URLs

Themes, styling, or design tokens

Version history or change comparison

Reusable global blocks

Cross-project content sharing

CMS functionality

If a feature starts to resemble a CMS or publishing system, it is out of scope.

10. Build intent

This document is the authoritative definition of Content Stage V1.

When building:

Prefer clarity over flexibility.

Do not add features that are not explicitly defined here.

Leave intentional gaps rather than making assumptions.

Treat structure and constraints as product features.