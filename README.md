# GROME Project Page

Static project page for **GROME: GROunding Factorized MEmory into Video World Models**.

## Preview locally

Run a local HTTP server from this directory (the interactive modules require HTTP):

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>. No package installation or build step is required.

## Publish with GitHub Pages

1. Create a GitHub repository and upload the contents of this directory to its `main` branch.
2. In the repository, open **Settings → Pages**.
3. Select **Deploy from a branch**, choose `main` and `/(root)`, then save.

The page uses relative asset paths and can run from a GitHub project site subpath.

## Contents

`index.html` is the page entry point. Styles and scripts are local; Three.js and its controls are included under `assets/vendor`, and all required media and viewer data are included in this distribution.
