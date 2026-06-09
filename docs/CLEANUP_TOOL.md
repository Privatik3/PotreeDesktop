# Cleanup tool — frontend implementation guide

Audience: the developer implementing the desktop-app half of the cleanup feature.
Self-contained. Pair it with the backend guide and the root architecture docs:

- System overview + coordinate system → [../../ARCHITECTURE.md](../../ARCHITECTURE.md) *(root repo)*
- HTTP contract → [../../API_CONTRACT.md](../../API_CONTRACT.md) *(root repo)*
- Backend build → [../../backend/docs/IMPLEMENTATION.md](../../backend/docs/IMPLEMENTATION.md)
- Zero-to-running setup → [../../DEVELOPER_GUIDE.md](../../DEVELOPER_GUIDE.md) *(root repo)*

> `../../` resolves because PotreeDesktop is a submodule of the project root.

---

## 1. What you're building

A **Clean** button in Potree's *Clipping* toolbar. The user drops a `.las`, draws
one or more clip boxes, clicks **Clean**, and the app:

1. sends the clip zones to the local Python backend,
2. the backend deletes the points inside them and writes `cleaned.las`,
3. the app resets the viewer and re-converts/loads `cleaned.las`.

The original `.las` is registered with the backend automatically right after it is
converted on drop, so by the time the user clicks **Clean** the backend already
has the source file.

---

## 2. Where the code lives (all in the app layer — the Potree engine is untouched)

| File | Role | State |
|---|---|---|
| `src/cleanup.js` | the whole feature (backend calls, button, clean flow) | **stubs** |
| `src/icons/clean.svg` | toolbar icon for the button | done (placeholder art) |
| `index.html` | imports `installCleanButton`, calls it inside `viewer.loadGUI(...)` | wired |
| `src/desktop.js` | calls `window.qazCleanup.registerSource(...)` after `convert_20` | wired |

Nothing in `potree/` (the engine submodule) is modified — `src/cleanup.js` only
uses public objects (`window.viewer`, `window.Potree`, `viewer.scene.volumes`).
This keeps the engine a clean vanilla checkout.

### Why a `window.qazCleanup` hook instead of imports
`cleanup.js` imports `convert_20` from `desktop.js`. To let `desktop.js` call back
into cleanup without a circular import, `cleanup.js` publishes its entry points on
`window.qazCleanup` at load, and `desktop.js` calls them defensively. Don't
"fix" this into a direct import — you'll create an import cycle.

---

## 3. Build & run

```powershell
cd PotreeDesktop
npm install                 # first time (Electron)
npm run potree:install      # first time (builds the Potree engine into libs/potree)
npm start                   # launch the app
```

After editing the Potree engine source you'd run `npm run potree:deploy`, but this
feature doesn't touch the engine, so `npm start` is enough. The backend must be
running too (see backend guide) for the live feature; the app still launches
without it (the hooks are safe no-ops / show errors).

---

## 4. Implement the stubs (in this order)

Each function in `src/cleanup.js` has a **REFERENCE IMPLEMENTATION** block in its
JSDoc — copy it in and adapt. Summary of the order and the gotchas:

### 4.1 `installCleanButton()` — make the button appear
Replace the no-op with the reference code. It appends a `32x32 img.button-icon`
to `#clipping_tools` (the toolbar Potree builds in
`potree/src/viewer/sidebar.js::initClippingTool`). Icon: `./src/icons/clean.svg`.
- Placement: appended at the **end** of the toolbar (right of the red remove-all
  "X"), which matches the empty slot in the design screenshot. To place it before
  the X, use `$("#clipping_tools").children().last().before(btn)`.
- Make it idempotent (`#clean_tool_button` guard) — `loadGUI` can run again on
  scene changes.

### 4.2 `backendHealth()` + `registerSource()` — ingest
- `registerSource(lasPath, {name, convertedDir})` POSTs `{ lasPath }` to
  `POST /pointclouds` and stores `{ id, lasPath, name, convertedDir }` in the
  module-level `currentSession`.
- It's already called from `desktop.js` (in `convert_20`'s `exit` handler) with
  `inputPaths[0]`, `pointcloudName`, and `chosenPath`. Once you implement it,
  dropping a `.las` will register it automatically.
- Optional but nice: call `backendHealth()` first and `viewer.postError(...)` if
  the backend isn't up, so the user gets a clear message instead of a silent fail.

### 4.3 `collectClipVolumes()` + `pointcloudOffset()` — read the zones
- Iterate `viewer.scene.volumes`, keep `v.clip === true`.
- For each: `v.updateMatrixWorld(true)`, then
  `worldToLocal = v.matrixWorld.clone().invert().elements` (16 floats, **column-major**).
- `type`: `"sphere"` if `v.constructor.name === "SphereVolume"`, else `"box"`.
- **Coordinate system**: matrixWorld is already in LAS coordinates in this app —
  read [../../ARCHITECTURE.md](../../ARCHITECTURE.md) §"Coordinate system" before
  doubting this. You send the inverse matrix; the backend does the rest.

### 4.4 `resetScene()` — fresh state
- Potree has `viewer.scene.removeAllClipVolumes()` but **no** `removeAllPointClouds`.
  Remove point clouds manually (loop `viewer.scene.pointclouds`, call
  `viewer.scene.scenePointCloud.remove(pc)`, then `splice`). Reference code is in
  the JSDoc.

### 4.5 `cleanPointCloud()` — orchestrate
Guard → `POST /pointclouds/{id}/clean` with `{ boxes, pointcloudOffset }` →
on success `resetScene()` → `convert_20([cleanedLasPath], <dir>, name+"_cleaned")`.
`convert_20` already spawns PotreeConverter and loads the result into the viewer,
so you get the cleaned cloud on screen for free. Reference code is in the JSDoc.
- **Iterate-again decision (document your choice):** after re-convert, either
  re-register `cleaned.las` so the user can clean repeatedly, or treat it as a
  single pass for v1. The reference notes where to add the re-registration.

---

## 5. Manual test (with backend running)

1. Start the backend (`backend/run.ps1`) — implemented per its guide.
2. `npm start`, drop `D:\SSap_Sklad_1_0.7m.las`, run the 2.0 conversion → cloud shows.
   - Console/devtools (Window → Toggle Developer Tools) should show the register
     call; the backend log shows `storage/<id>/source.las` created.
3. Open the **Clipping** section, click the clip-volume icon, draw a box over some
   points. Add a second box if you like.
4. Click **Clean**. Expect: "Removed N pts…" message → viewer clears → the cleaned
   cloud loads with the boxed points gone.
5. Rotate a clip box and repeat to confirm rotated zones are handled (the matrix
   approach makes this automatic).

Edge cases to verify: **Clean** with no boxes (shows "add a clip volume"), with no
registered cloud (shows an error), backend down (clear error, app stays usable).

---

## 6. Prior art in this repo (useful references, not required)

- `index.html` contains a **commented-out `btnExportLaz` block** that already
  demonstrates reading `viewer.scene.volumes`, taking `v.matrix.elements`, and
  spawning `libs/CPotree/filter.exe ... --area "matrix(...)"`. That native tool
  filters points by volume matrices — conceptually the same operation our Python
  backend performs. Handy for cross-checking results, and proof the volume-matrix
  approach is the established Potree way.
- `libs/CPotree/filter.exe` exists in this repo if you want to compare outputs.

Our design intentionally uses the Python backend (not `filter.exe`) per the
project plan, because the backend is where cleaning will grow (logging, storage,
future server deployment).

---

## 7. Definition of done

- [ ] Dropping a `.las` registers it (backend `storage/<id>/source.las` appears).
- [ ] **Clean** button visible in the Clipping toolbar with the icon.
- [ ] Drawing box(es) + **Clean** removes those points and reloads the cleaned cloud.
- [ ] Rotated boxes remove the correct oriented region.
- [ ] No-box / no-cloud / backend-down cases show clear messages and don't crash.
- [ ] No `throw new Error("TODO …")` remain in `src/cleanup.js`.
