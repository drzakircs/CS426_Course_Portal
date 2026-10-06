# CS-426 — Parallel & Distributed Computing Course Portal

A responsive GitHub Pages course website for **CS-426 — Parallel & Distributed Computing**.

**Instructor:** Dr. Zakir Khan  
**Designation:** Assistant Professor, Department of Computer Science  
**Campus:** Air University Aerospace & Aviation Campus, Kamra

The course content in `data/course.json` is based on the supplied CS-426 course guide. The guide does **not** specify the program, semester, or academic year/session value, and it does not name a specific programming language. Those fields are therefore left unassigned rather than invented.

## Project Structure

```text
CS426_Course_Portal/
│
├── index.html
├── 404.html
├── README.md
│
├── assets/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── app.js
│
├── data/
│   └── course.json
│
└── materials/
    └── README.md
```

## One-Time Repository Configuration

The normal GitHub Pages/Jekyll material discovery works without GitHub API calls. The API configuration is retained as a fallback for local/static hosting where Jekyll/Liquid is unavailable.

Open `assets/js/app.js` and update only these constants when your repository is known:

```js
const GITHUB_REPO = 'USERNAME/REPOSITORY';
const GITHUB_BRANCH = 'main';
const MATERIALS_DIR = 'materials';
```

Example:

```js
const GITHUB_REPO = 'example-user/CS426-PDC';
const GITHUB_BRANCH = 'main';
const MATERIALS_DIR = 'materials';
```

Do not change `MATERIALS_DIR` unless you also rename the `materials/` directory.

## How to Upload New Learning Material

For routine weekly updates, the instructor only needs to:

1. Create the HTML learning material.
2. Include the appropriate **Week number** in the filename.
3. Upload the HTML file into `/materials/`.
4. Commit the change to the `main` branch.
5. GitHub Pages rebuilds automatically and the material appears under the matching week.

Example:

```text
CourseName_Week03_Lecture.html
CourseName_Week03_Examples.html
CourseName_Week03_Practice.html
```

All three files automatically appear under **Week 03**. No manual editing of `index.html`, `app.js`, `course.json`, or the weekly cards is required.

## Supported Week Filename Conventions

The week detector is case-insensitive and supports the following styles:

```text
Week1
Week01
Week_1
Week_01
Week-1
Week-01
week 1
week 01
```

Examples:

```text
PDC_Week1.html
PDC_Week01.html
PDC_Week_02_Lecture.html
PDC_Week-02_CodeExamples.html
PDC_week 02 Practice.html
```

The actual filename is never changed. The displayed label is cleaned for readability, for example:

```text
CS426_Parallel_Distributed_Computing_Week02_CodeExamples.html
```

is displayed approximately as:

```text
Week02 Code Examples
```

## Multiple Files Per Week

Any number of HTML files may be uploaded for a week. Matching files are sorted naturally by filename and shown under that week's **Learning Material** section.

Each material has two actions:

- **View** — loads the HTML file inside the embedded viewer on the same course page and scrolls to the viewer.
- **Open** — opens the original HTML file in a new browser tab.

If no HTML material is available for a week, the card shows only:

```text
LEARNING MATERIAL    Not uploaded yet
```

## Long Filenames

Material rows use a fixed action area so long filenames cannot hide the **View** or **Open** buttons.

When a displayed filename exceeds the available width, JavaScript detects the overflow and enables a right-to-left CSS animation. The text pauses at both ends and repeats. Short filenames remain stationary. Users who request reduced motion through their operating system receive a non-animated, horizontally scrollable filename area.

## Delete Learning Material

To remove material from the portal:

1. Delete the corresponding HTML file from `/materials/`.
2. Commit the deletion.
3. Wait for GitHub Pages to rebuild.

The material automatically disappears from the matching week.

## Replace or Update Learning Material

To update an existing material file:

1. Keep the same filename if you want the same week and displayed order.
2. Replace the file contents in `/materials/`.
3. Commit the change.

If you rename the file, keep a supported `Week...` pattern in the new filename.

## Enable GitHub Pages

After pushing the project to GitHub:

1. Open the repository on GitHub.
2. Go to **Settings** → **Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main**.
5. Select folder **/(root)**.
6. Save.

GitHub Pages will publish the course portal after the first build completes.

## How Automatic Material Discovery Works

### Primary method: GitHub Pages / Jekyll

`index.html` contains a small Liquid/Jekyll manifest generated from `site.static_files`. During the GitHub Pages build, Jekyll identifies HTML files inside `/materials/` and embeds their names and paths into the page.

This avoids making a GitHub API request every time a student opens the website.

### Fallback method: GitHub API

If Liquid/Jekyll has not processed the page, the JavaScript can query the configured repository through the GitHub Contents API. This is useful for other static hosts and some local testing workflows.

The fallback works only after `GITHUB_REPO` is changed from the placeholder value to the real `USERNAME/REPOSITORY`.

## Local Testing

Because the portal loads `data/course.json` with `fetch()`, modern browsers may block full functionality when `index.html` is opened directly through a `file://` URL.

For local testing, use any simple static-site preview such as VS Code Live Server or another local HTTP server. No server-side technology is required for deployment; the published site remains plain HTML, CSS, JavaScript, and GitHub Pages/Jekyll.

## Course Data

`data/course.json` contains:

- course information
- course description
- CLOs, GA mapping, and Bloom taxonomy levels
- delivery framework
- grading components
- assessment calendar
- textbooks and reference books
- all 15 teaching weeks and 30 theory sessions
- session topics, complete coverage, learning focus, CLO mapping, and assessment activity

The source course guide contains GA numbers but does not provide separate PLO labels. The portal therefore displays the documented GA mapping and explicitly indicates that a PLO mapping is not specified.

## Cache Busting

The page currently loads versioned assets as:

```html
<link rel="stylesheet" href="assets/css/style.css?v=1">
<script src="assets/js/app.js?v=1"></script>
```

When CSS or JavaScript is changed substantially, increase the version value in `index.html`, for example from `v=1` to `v=2`, to help browsers obtain the latest files.

## Course Fields Still to Configure

The uploaded course guide leaves **Semester / Academic Session** blank and does not state the **Program**. These are represented as `null` in `data/course.json` and shown on the website as **Not specified**.

When official values are available, update only these fields near the top of `data/course.json`:

```json
"program": "...",
"semester": "...",
"academicYear": "..."
```

No weekly content or material-discovery code needs to be changed.
