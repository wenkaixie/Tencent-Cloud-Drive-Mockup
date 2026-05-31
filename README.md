
  # Education Drive Mockup

  This project adapts Tencent's Enterprise Cloud Drive (TCED) into an **Education Drive** — a product aimed at bringing TCED's enterprise file management capabilities in line with the basic functions of Google Classroom.

  The original Figma mockup this codebase was generated from is available at https://www.figma.com/design/5vSqKhpYzt3cS8I7OCWfqQ/Tencent-Cloud-Drive-Mockup.

  ## Direction

  The general goal is to reposition TCED from an enterprise tool into an education-focused platform. Key enterprise concepts are being remapped to their education equivalents:

  | TCED (Enterprise) | Education Drive |
  |---|---|
  | Enterprise Drive | Education Drive |
  | Enterprise | Education |
  | 我的企业 (My Enterprise) | 我的学校 (My School) |
  | Group | Class |
  | Group name (e.g. wenkaitest) | Class name (e.g. English 3A) |

  The target experience draws inspiration from Google Classroom's core features: class-based organisation, file sharing within classes, and simple member (student/teacher) management.

  ## Running the code

  Run `npm install` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Folder / Page Structure

  The app supports **unlimited folder nesting**. The URL path after the class ID encodes the full breadcrumb:

  ```
  /group                                  → Class home page (list of all classes)
  /group/:classId                         → Inside a class (shows top-level folders)
  /group/:classId/:folderId               → Inside a folder
  /group/:classId/:folderId/:subfolderId  → Inside a nested sub-folder
  /group/:classId/a/b/c/d/…              → Arbitrarily deep nesting
  ```

  React Router uses a splat route (`group/:classId/*`) so any depth of path is matched automatically. Each folder in localStorage recursively stores a `folders` array alongside its `files` array.

  ### How data is stored (localStorage)

  | Key | Contents |
  |---|---|
  | `groups` | Array of all class objects `{ id, name, createdAt, tags }` — seeded with English 3A on first load |
  | `folders-<classId>` | Recursive folder tree for that class: `{ id, name, createdAt, starred, files[], folders[] }` |
  | `personal-files` | Array of files on the Personal page |

  localStorage is **not** cleared on rebuild or dev server restart. It only resets if you manually clear it via DevTools → Application → Storage → Clear site data.

  ### Navigation rules

  - **Double-click** a class card on `/group` to enter it.
  - **Click a folder** anywhere in the tree to navigate deeper — the URL appends the folder's ID as the next path segment.
  - The breadcrumb at the top is fully clickable — each ancestor folder is a link that navigates back up to that depth.
  - **Back button** pops one level (or returns to `/group` from the class root).
  - **New** on `/group` opens the "Create group" modal — on confirm, the new class is saved to localStorage and you are taken straight into it.
  - Creating a new folder inside an already-open folder adds it as a sub-folder at the current depth.
  - Deleting the currently-open folder navigates back to the parent level automatically.

  