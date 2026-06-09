/**
 * cleanup.js — Point-cloud cleanup feature (frontend half).
 * =========================================================
 *
 * This module is the desktop app's bridge to the Python cleanup backend. It:
 *   1. registers a dropped .las with the backend          (registerSource)
 *   2. adds a "Clean" button to Potree's Clipping toolbar  (installCleanButton)
 *   3. collects the user's clip zones as matrices          (collectClipVolumes)
 *   4. asks the backend to delete points in those zones    (cleanPointCloud)
 *   5. resets the viewer and re-converts the cleaned .las  (resetScene + convert_20)
 *
 * It runs in the Electron renderer, so Node APIs (require) AND browser APIs
 * (fetch) are both available (see main.js webPreferences.nodeIntegration).
 *
 * Globals it relies on (created in index.html):
 *   - window.viewer : the Potree.Viewer instance
 *   - window.Potree : the Potree namespace (from libs/potree/potree.js)
 *
 * ---------------------------------------------------------------------------
 * STATUS: DOCUMENTED STUBS. Signatures, wiring points, and the exact reference
 * implementation for each function live in the JSDoc / inline comments below
 * and in docs/CLEANUP_TOOL.md. Bodies are intentionally NOT implemented:
 * functions called during normal app use (registerSource, installCleanButton)
 * are SAFE NO-OPS that log a TODO so the existing app keeps working; functions
 * only reachable once you wire the button throw so you notice they're pending.
 *
 * Contract reference (do not diverge): ../../API_CONTRACT.md  (root repo)
 * Architecture / coordinate system:    ../../ARCHITECTURE.md  (root repo)
 * ---------------------------------------------------------------------------
 */

import * as THREE from "../libs/three.js/build/three.module.js";
import { convert_20 } from "./desktop.js";

/** Base URL of the local FastAPI backend. Keep in sync with backend/app/config.py. */
export const BACKEND_URL = "http://127.0.0.1:8000";

/**
 * The active cleanup session, set by registerSource() after a .las is dropped.
 * @typedef {Object} CleanupSession
 * @property {string} id            backend session id (from POST /pointclouds)
 * @property {string} lasPath       original .las path on disk
 * @property {string} name          display/base name used for the converted folder
 * @property {string} convertedDir  folder the local PotreeConverter wrote into
 * @type {CleanupSession|null}
 */
let currentSession = null;

/** @returns {CleanupSession|null} the active session, or null if none. */
export function getCurrentSession() {
	return currentSession;
}

// ---------------------------------------------------------------------------
// 1. Backend connectivity
// ---------------------------------------------------------------------------

/**
 * Ping the backend. Call before registering so you can warn the user early if
 * the backend isn't running.
 * @returns {Promise<boolean>} true if GET /health returned {status:"ok"}.
 *
 * REFERENCE IMPLEMENTATION (fill in):
 *   try {
 *     const r = await fetch(`${BACKEND_URL}/health`);
 *     if (!r.ok) return false;
 *     const j = await r.json();
 *     return j.status === "ok";
 *   } catch (_) { return false; }
 */
export async function backendHealth() {
	throw new Error("TODO: implement backendHealth() — see JSDoc + docs/CLEANUP_TOOL.md");
}

/**
 * Register a dropped .las with the backend (POST /pointclouds). Stores the
 * returned id in `currentSession`. SAFE NO-OP until implemented so the drop →
 * convert pipeline keeps working.
 *
 * Called from: src/desktop.js, in the converter completion handlers
 *              (convert_20's `exit` AND convert_17's `close`) — the single
 *              registration point, covering BOTH cases automatically:
 *                (a) the user's initial .las drop (either converter version), and
 *                (b) the re-conversion of cleaned.las after a Clean (iteration).
 *              You do not need to call this from anywhere else.
 *
 * @param {string} lasPath      absolute path of the source .las
 * @param {Object} [opts]
 * @param {string} [opts.name]          base name for later re-conversion
 * @param {string} [opts.convertedDir]  folder the local converter wrote into
 * @returns {Promise<CleanupSession|null>}
 *
 * REFERENCE IMPLEMENTATION (fill in):
 *   const res = await fetch(`${BACKEND_URL}/pointclouds`, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ lasPath }),
 *   });
 *   if (!res.ok) { viewer.postError(`Backend register failed: ${res.status}`); return null; }
 *   const { id } = await res.json();
 *   currentSession = { id, lasPath, name: opts.name ?? "", convertedDir: opts.convertedDir ?? "" };
 *   viewer.postMessage(`Registered with cleanup backend (session ${id.slice(0,8)}…)`, { duration: 4000 });
 *   return currentSession;
 */
export async function registerSource(lasPath, opts = {}) {
	// SAFE NO-OP: do not break the drop pipeline while unimplemented.
	console.warn("[cleanup] registerSource() is a stub — TODO. lasPath:", lasPath, opts);
	return null;
}

// ---------------------------------------------------------------------------
// 2. Reading the clip zones from Potree
// ---------------------------------------------------------------------------

/**
 * Collect every ACTIVE clip volume as a backend ClipVolume payload entry.
 *
 * Reads viewer.scene.volumes and keeps only `volume.clip === true`
 * (see PotreeDesktop/potree/src/viewer/Scene.js). For each, it sends the
 * INVERSE of matrixWorld as a flat 16-float array (THREE.js column-major), which
 * the backend uses to test point membership. See ARCHITECTURE.md "Coordinate
 * system" for why matrixWorld is already in LAS coordinates.
 *
 * @returns {{type:("box"|"sphere"), worldToLocal:number[]}[]}
 *
 * REFERENCE IMPLEMENTATION (fill in):
 *   const out = [];
 *   for (const v of viewer.scene.volumes) {
 *     if (v.clip !== true) continue;
 *     v.updateMatrixWorld(true);                       // ensure fresh transform
 *     const inv = v.matrixWorld.clone().invert();      // world -> local
 *     const type = (v.constructor && v.constructor.name === "SphereVolume") ? "sphere" : "box";
 *     out.push({ type, worldToLocal: inv.elements.slice() }); // 16 floats, column-major
 *   }
 *   return out;
 */
export function collectClipVolumes() {
	throw new Error("TODO: implement collectClipVolumes() — see JSDoc + docs/CLEANUP_TOOL.md");
}

/**
 * pointcloud.position [x,y,z] of the first loaded cloud, sent to the backend
 * for debug/validation only (the backend does not require it).
 * @returns {number[]|null}
 *
 * REFERENCE IMPLEMENTATION (fill in):
 *   const pc = viewer.scene.pointclouds[0];
 *   return pc ? [pc.position.x, pc.position.y, pc.position.z] : null;
 */
export function pointcloudOffset() {
	throw new Error("TODO: implement pointcloudOffset() — see JSDoc");
}

// ---------------------------------------------------------------------------
// 3. Resetting the viewer to a fresh state
// ---------------------------------------------------------------------------

/**
 * Remove all point clouds and clip volumes so the cleaned cloud loads into a
 * clean scene. Potree has removeAllClipVolumes() but NO removeAllPointClouds(),
 * so the point clouds are removed manually.
 *
 * @returns {void}
 *
 * REFERENCE IMPLEMENTATION (fill in):
 *   // point clouds
 *   while (viewer.scene.pointclouds.length > 0) {
 *     const pc = viewer.scene.pointclouds[0];
 *     viewer.scene.scenePointCloud.remove(pc);
 *     viewer.scene.pointclouds.splice(0, 1);
 *   }
 *   // clip volumes (+ polygon clip volumes)
 *   viewer.scene.removeAllClipVolumes();
 *   // optional: viewer.scene.removeAllMeasurements();
 */
export function resetScene() {
	throw new Error("TODO: implement resetScene() — see JSDoc + docs/CLEANUP_TOOL.md");
}

// ---------------------------------------------------------------------------
// 4. The Clean action (orchestration)
// ---------------------------------------------------------------------------

/**
 * Full clean flow, triggered by the Clean toolbar button:
 *   guard -> POST /clean -> resetScene() -> convert_20(cleanedLas) -> reload.
 *
 * @returns {Promise<void>}
 *
 * REFERENCE IMPLEMENTATION (fill in — see docs/CLEANUP_TOOL.md "Clean flow"):
 *   if (!currentSession) { viewer.postError("No cloud registered with the backend yet."); return; }
 *   const boxes = collectClipVolumes();
 *   if (boxes.length === 0) { viewer.postMessage("Add at least one clip volume first.", {duration:4000}); return; }
 *
 *   viewer.postMessage("Cleaning… sending clip zones to backend.", {duration: 10000});
 *   let result;
 *   try {
 *     const res = await fetch(`${BACKEND_URL}/pointclouds/${currentSession.id}/clean`, {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ boxes, pointcloudOffset: pointcloudOffset() }),
 *     });
 *     if (!res.ok) { viewer.postError(`Clean failed: ${res.status} ${await res.text()}`); return; }
 *     result = await res.json();   // { cleanedLasPath, removed, kept }
 *   } catch (e) { viewer.postError(`Clean request error: ${e.message}`); return; }
 *
 *   viewer.postMessage(`Removed ${result.removed} pts. Reloading cleaned cloud…`, {duration: 8000});
 *   resetScene();
 *
 *   // Re-convert the cleaned .las with the existing pipeline. Pick a target dir
 *   // next to the cleaned file; convert_20 loads it into the viewer on finish.
 *   const np = require("path");
 *   const cleaned = result.cleanedLasPath;
 *   const dir = np.join(np.dirname(cleaned), `${currentSession.name || "cloud"}_cleaned_converted`);
 *   convert_20([cleaned], dir, `${currentSession.name || "cloud"}_cleaned`);
 *
 *   // ITERATION IS AUTOMATIC: convert_20's exit handler calls
 *   // window.qazCleanup.registerSource(inputPaths[0]=cleaned), so after the
 *   // reload `currentSession` points at the cleaned file (a NEW backend session/
 *   // id). The user can immediately draw new boxes and click Clean again. You do
 *   // NOT need to re-register here. (See desktop.js convert_20 exit handler.)
 */
export async function cleanPointCloud() {
	throw new Error("TODO: implement cleanPointCloud() — see JSDoc + docs/CLEANUP_TOOL.md");
}

// ---------------------------------------------------------------------------
// 5. The Clean button (UI)
// ---------------------------------------------------------------------------

/**
 * Inject the "Clean" button into Potree's Clipping toolbar (#clipping_tools),
 * matching the existing tool-icon style (32x32 img.button-icon). MUST be called
 * AFTER the sidebar is built — i.e. inside viewer.loadGUI(...) in index.html.
 *
 * Placement: appended at the END of #clipping_tools (to the right of the red
 * "remove all" X — the empty slot highlighted in the design screenshot). To put
 * it before the X instead, use `.children().last().before(btn)`.
 *
 * SAFE NO-OP until implemented (so loadGUI doesn't error).
 *
 * @returns {void}
 *
 * REFERENCE IMPLEMENTATION (fill in):
 *   const bar = $("#clipping_tools");
 *   if (bar.length === 0) { console.warn("[cleanup] #clipping_tools not found yet"); return; }
 *   if ($("#clean_tool_button").length > 0) return;            // idempotent
 *   const icon = "./src/icons/clean.svg";                       // app-level asset (this repo)
 *   const btn = $(`<img id="clean_tool_button" src="${icon}"
 *                   title="Clean: delete points inside clip zones"
 *                   style="width:32px;height:32px" class="button-icon" />`);
 *   btn.click(() => cleanPointCloud());
 *   bar.append(btn);                                            // end of toolbar
 */
export function installCleanButton() {
	// SAFE NO-OP: do not break viewer.loadGUI() while unimplemented.
	console.warn("[cleanup] installCleanButton() is a stub — TODO (see docs/CLEANUP_TOOL.md)");
}

// ---------------------------------------------------------------------------
// Integration hook for desktop.js
// ---------------------------------------------------------------------------
// desktop.js must call registerSource() after it converts a dropped .las, but
// cleanup.js already imports convert_20 FROM desktop.js. To avoid a circular
// import, we expose the entry points on `window` here (this module is imported
// by index.html, so this runs at startup) and desktop.js calls them defensively
// as `window.qazCleanup?.registerSource?.(...)`.
if (typeof window !== "undefined") {
	window.qazCleanup = {
		registerSource,
		cleanPointCloud,
		getCurrentSession,
		installCleanButton,
	};
}
