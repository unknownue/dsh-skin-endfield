import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
//#region src/settings.ts
/**
* Durable settings schema for the skin, shared by both halves.
*
* The Host half registers this schema as the namespace that backs the Skin
* settings page; the browser half reads the same resolved section through
* `ctx.settingsScope`, so there is exactly one definition of the shape and the
* default values cannot drift between the two.
*
* `settings` is a plain module with no dependencies so the browser bundle can
* import it without pulling anything Node-only into the client closure.
*/
const SKIN_SETTINGS_NAMESPACE = "dsh-skin-endfield";
/**
* The values the skin ships with. Any schema default below must match one.
*
* Two colour settings, because the skin remaps two different families of the
* shell's palette and they answer different questions:
*   - `accent` repaints the shell's *brand/status* family, which the skin had
*     hardcoded to the game's mint. It is the loud one: the send button, the
*     module icon on an active workspace, the "Preview" badge, links and the
*     composer caret. `scripts/probe-green.mjs` was written to find exactly which
*     elements these are on the live GUI.
*   - `tint` is the skin's own chartreuse focus/selection outline, which is
*     deliberately not a shell token (see decor.ts section 11).
*/
const SKIN_SETTINGS_DEFAULTS = {
	/** The shell's brand/status family: button fills, module icons, badges, links. */
	accent: "#00FFA2",
	/** Accent used for the selection/focus outline and its bloom. */
	tint: "#D0E94F",
	/**
	* Whether the composer card and the message bubble keep their filled surface.
	*
	* `false` is the flat reading: the corner brackets, a hairline frame and the
	* canvas do the work where a grey panel used to be. Kept as a setting, not a
	* constant, because it is a taste call with no right answer — the fill is what
	* makes those two read as panels, and dropping it is what makes them read as
	* part of the page.
	*/
	surfaceFill: false,
	/** Strength of the outer bloom, 0 disables it (the outline stays). */
	bloom: .28,
	/** 0 gives right angles; a positive value re-rounds the flattened surfaces. */
	cornerRadius: 0,
	/** Endfield's `//` marker on tool-block headers and section headings. */
	labelPrefix: true,
	/**
	* The three ambient effects, each independent and each OFF by default.
	*
	* They are separate switches rather than one "effects" toggle because they answer
	* different questions and do not have to travel together: the top-bar light is a
	* chrome treatment on the shell's own bar, the page mark is an image printed on the
	* transcript panel, and the dot block is a bounded piece of print in its
	* upper-right corner. Any subset is a legitimate configuration.
	*
	* OFF by default on purpose: this layer paints on top of (or behind) content the
	* shell owns, so a fresh install must look exactly like the skin without them. A
	* user opts in per effect.
	*/
	headerLight: false,
	/** The image printed on the transcript panel. */
	mark: false,
	/** The halftone block in the transcript's upper-right corner. */
	dotBlock: false,
	/**
	* How the mark is set, and where it is pinned.
	*
	* `horizontal` prints the image the way it was drawn; `vertical` turns it a quarter turn and
	* sets it down the right-hand margin, which is what a wordmark wants. The anchor is one of the
	* panel's four corners; the geometry for each combination is in decor.ts 18b, and the rotated
	* cases are computed rather than nudged by hand.
	*/
	markOrientation: "horizontal",
	markAnchor: "top-right",
	/**
	* How strongly the mark prints, and how large it is set.
	*
	* It paints over the transcript's own canvas (the canvas is opaque, so a print underneath it is
	* simply invisible -- measured in scripts/probe-decal-live.mjs), which is why the opacity is the
	* knob between "watermark" and "stain" and why 0.12 is the value that ships.
	*/
	markOpacity: .12,
	/** Multiplier on the mark's long side: 1 is 46% of the panel, about 600px. */
	markScale: 1,
	/**
	* Which drawing to print when no custom image is set.
	*
	* `skin` is the page mark the skin ships as its default (the full lockup); the other three are
	* the same family drawn at other proportions — the lettering alone, the stamp, and the two
	* composed. All four are this repository's own drawings.
	*/
	markPlate: "skin",
	/**
	* A custom image, as the URL the host half serves it from, or empty for "use the plate".
	*
	* The settings page uploads a picked file through `/skin-endfield/user/upload`, and the host
	* writes it into the user's own data directory (outside this repository), so the value stored
	* here is a small URL and never a megabyte of base64 in the settings document.
	*/
	markImage: ""
};
/** The two ways the mark can be set. */
const MARK_ORIENTATIONS = ["horizontal", "vertical"];
/** The panel corners a mark can be pinned to. */
const MARK_ANCHORS = [
	"top-right",
	"top-left",
	"bottom-right",
	"bottom-left"
];
/**
* Where the mark's artwork and the user's uploads are served from, named once for both halves.
*
* Two routes rather than one because they are two different things: the drawings that ship with
* the skin are read-only files inside the package, while an uploaded image lives in the user's
* data directory and is written by the host at the user's request. Keeping them apart is what
* lets the GET side of each be a five-line guard.
*/
const PLATE_ROUTE = "/skin-endfield/logo";
/** The user's own uploads: GET serves one, POST /upload writes one. */
const USER_ROUTE = "/skin-endfield/user";
const USER_UPLOAD_PATH = `${USER_ROUTE}/upload`;
/** Where the host puts uploads, under the user's data directory (never in this repository). */
const USER_DIR_PREFIX = "skin-endfield";
const USER_DIR_NAME = "marks";
/** Uploads are capped so one picture cannot fill the settings of a machine. */
const UPLOAD_MAX_BYTES = 2097152;
const UPLOAD_TYPES = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/gif": "gif"
};
const PLATES = {
	wordmark: {
		files: ["wordmark.png"],
		label: "Wordmark (wide)",
		aspect: 1342 / 200
	},
	badge: {
		files: ["badge.png"],
		label: "Badge (stamp)",
		aspect: 265 / 300
	},
	lockup: {
		files: ["badge.png", "wordmark.png"],
		label: "Lockup (badge + wordmark)",
		aspect: 4
	}
};
/** The plates a user can pick: the page mark that ships as the default, or one of the three. */
const MARK_PLATES = ["skin", ...Object.keys(PLATES)];
PLATES.wordmark.files[0];
PLATES.badge.files[0];
/**
* The root class that arms one plate, spelled here rather than in the stylesheet module.
*
* Three places need it to agree — the settings path that toggles it, the decor sheet that keys
* the rule on it, and the live check that arms it by hand — and a class name is exactly the kind
* of string that gets renamed in two of the three.
*/
const PLATE_CLASS_PREFIX = "endfield-plate-";
const plateClass = (plate) => `${PLATE_CLASS_PREFIX}${plate}`;
MARK_PLATES.map(plateClass);
//#endregion
//#region src/index.ts
/**
* Host half of dsh-skin-endfield.
*
* The host row exists for three reasons:
*   1. it makes this package a loader entry, which is what makes the harness
*      pick up the `dsh.client` browser bundle at all;
*   2. it serves two read-only directories the browser half cannot embed: the
*      vendored open-source font faces at `/skin-endfield/fonts/`, and the decal
*      plate at `/skin-endfield/logo/`, so neither needs a data: URI or a CDN;
*   3. it registers the durable settings namespace behind the Skin settings
*      page, so the accent tint survives a reload instead of living in memory.
*
* It intentionally provides no Cordis service of its own: the DSH seam rules
* forbid a second provider in the same scope, and a skin has no service to
* offer. Registering a settings *namespace* is not providing a service — it is
* a registration effect on this plugin's fiber.
*/
const name = "dsh-skin-endfield";
/**
* Injected service names this plugin needs before it runs. A settings service
* is deliberately NOT listed: namespacing is optional here, and listing it would
* make the whole plugin wait on a service that the skin can happily run without.
* The settings namespace is registered from a nested `ctx.inject(["settings"])`
* instead — see `registerSkinSettings`.
*/
const inject = ["webServer"];
/**
* Durable skin settings.
*
* The defaults here are duplicated in `SKIN_SETTINGS_DEFAULTS` on purpose: the
* schema is the authority for what the Host will accept and persist, while the
* constant is the authority the browser falls back on when no settings service
* is composed at all, and what the settings page shows before a value loads.
* `scripts/verify-settings-parity.mjs` resolves this schema against an empty
* section and compares every field with that constant, so the two cannot drift
* silently — a split would make a fresh install look different from a stored one.
*/
const SkinSettingsSchema = z.object({
	accent: z.string().default(SKIN_SETTINGS_DEFAULTS.accent),
	tint: z.string().default(SKIN_SETTINGS_DEFAULTS.tint),
	surfaceFill: z.boolean().default(SKIN_SETTINGS_DEFAULTS.surfaceFill),
	bloom: z.number().min(0).max(1).default(SKIN_SETTINGS_DEFAULTS.bloom),
	cornerRadius: z.number().min(0).max(24).default(SKIN_SETTINGS_DEFAULTS.cornerRadius),
	labelPrefix: z.boolean().default(SKIN_SETTINGS_DEFAULTS.labelPrefix),
	headerLight: z.boolean().default(SKIN_SETTINGS_DEFAULTS.headerLight),
	mark: z.boolean().default(SKIN_SETTINGS_DEFAULTS.mark),
	dotBlock: z.boolean().default(SKIN_SETTINGS_DEFAULTS.dotBlock),
	markOrientation: z.union(MARK_ORIENTATIONS.map((value) => z.const(value))).default(SKIN_SETTINGS_DEFAULTS.markOrientation),
	markAnchor: z.union(MARK_ANCHORS.map((value) => z.const(value))).default(SKIN_SETTINGS_DEFAULTS.markAnchor),
	markOpacity: z.number().min(0).max(1).default(SKIN_SETTINGS_DEFAULTS.markOpacity),
	markScale: z.number().min(.4).max(1.8).default(SKIN_SETTINGS_DEFAULTS.markScale),
	markPlate: z.union(MARK_PLATES.map((plate) => z.const(plate))).default(SKIN_SETTINGS_DEFAULTS.markPlate),
	markImage: z.string().default(SKIN_SETTINGS_DEFAULTS.markImage)
});
const HERE = dirname(fileURLToPath(import.meta.url));
/** `lib/` -> package root; fonts and the decal plate are shipped under `assets/`. */
const FONT_DIR = join(HERE, "..", "assets", "fonts");
/**
* The decal plates live in their own directory rather than under a general `assets` route, and the
* harvested reference sets (screenshots, primitive sheets, in-game frames) are not in the repository
* at all any more — they were 26 MB of the tree and about the same again in history, so they live
* outside it (assets/manifest.md). Between the two facts, the routes this plugin registers can stay
* a short, auditable list: fonts and plates, nothing else.
*/
const LOGO_DIR = join(HERE, "..", "assets", "logo");
const FONT_ROUTE = "/skin-endfield/fonts";
/**
* The plate route is spelled in `settings.ts` and re-exported here, because three files have to
* agree on it: this handler, the decor sheet that paints the plate, and the settings page that
* previews it. A rename that reaches two of the three is a blank decal no type check would catch.
*/
const LOGO_ROUTE = PLATE_ROUTE;
/**
* Where an uploaded image goes: the user's own DSH data directory, never this package.
*
* A mark the user picked belongs to the user, so it must survive a reinstall of the plugin and
* must not appear as an untracked file in a repository checkout. `DSH_SKIN_MARKS_DIR` overrides
* the location, which is what lets the host checks upload into a temporary directory instead of
* the real one.
*/
function marksDir() {
	const override = process.env.DSH_SKIN_MARKS_DIR;
	return override !== void 0 && override !== "" ? override : join(homedir(), ".dsh", USER_DIR_PREFIX, USER_DIR_NAME);
}
/**
* Read a JSON request body with a ceiling, so a runaway client cannot fill memory.
*
* Cordis hands the handler a Node request; there is no framework in front of it, so the body has
* to be collected here. The limit is twice the image cap because the payload is base64 (4/3) plus
* the data-URL prefix and the JSON wrapper.
*/
async function readJsonBody(req, limit) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = chunk;
		size += buffer.length;
		if (size > limit) throw new Error("the request body is too large");
		chunks.push(buffer);
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
/** A data URL of one of the four accepted image types, and nothing else. */
const DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/;
/**
* Accept one uploaded image.
*
* The browser reads the picked file and posts it here, so the checks that matter are all on this
* side: an allow-list of image types (an SVG would be a script carrier, and anything else is not
* an image at all), a size ceiling, and a filename derived from the content's SHA-1 rather than
* from anything the client sent — which makes the name inert, makes a re-upload idempotent, and
* means the directory can be listed without surprises.
*/
async function handleUpload(req, res) {
	const respond = (status, body) => {
		res.statusCode = status;
		res.setHeader("content-type", "application/json");
		res.end(JSON.stringify(body));
	};
	try {
		const body = await readJsonBody(req, UPLOAD_MAX_BYTES * 2);
		const dataUrl = body !== null && typeof body === "object" ? body.dataUrl : void 0;
		if (typeof dataUrl !== "string") return respond(400, { error: "expected { dataUrl }" });
		const match = DATA_URL.exec(dataUrl);
		if (match === null) return respond(415, { error: "only PNG, JPEG, WebP or GIF data URLs are accepted" });
		const bytes = Buffer.from(match[2] ?? "", "base64");
		if (bytes.length === 0) return respond(400, { error: "the image is empty" });
		if (bytes.length > 2097152) return respond(413, { error: `that image is ${(bytes.length / 1048576).toFixed(1)} MB; the limit is ${(UPLOAD_MAX_BYTES / 1048576).toFixed(0)} MB` });
		const ext = UPLOAD_TYPES[match[1]];
		const name = `mark-${createHash("sha1").update(bytes).digest("hex").slice(0, 12)}.${ext}`;
		const dir = marksDir();
		mkdirSync(dir, { recursive: true });
		writeFileSync(join(dir, name), bytes);
		respond(200, {
			url: `${USER_ROUTE}/${name}`,
			bytes: bytes.length
		});
	} catch (error) {
		respond(400, { error: error instanceof Error ? error.message : String(error) });
	}
}
const MIME = {
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
	".png": "image/png",
	".svg": "image/svg+xml",
	".txt": "text/plain; charset=utf-8"
};
/**
* Serve one directory read-only. `path` is normalised and then checked against that directory,
* so `..` cannot escape it.
*/
function serveFrom(dir, route, rawUrl, res) {
	const pathOnly = (rawUrl ?? "").split("?")[0] ?? "";
	const relative = decodeURIComponent(pathOnly.slice(route.length)).replace(/^\/+/, "");
	const target = normalize(join(dir, relative));
	if (!target.startsWith(dir + sep)) {
		res.statusCode = 403;
		res.end("forbidden");
		return;
	}
	let size;
	try {
		const stat = statSync(target);
		if (!stat.isFile()) throw new Error("not a file");
		size = stat.size;
	} catch {
		res.statusCode = 404;
		res.end("not found");
		return;
	}
	const dot = target.lastIndexOf(".");
	const ext = dot >= 0 ? target.slice(dot).toLowerCase() : "";
	res.setHeader("content-type", MIME[ext] ?? "application/octet-stream");
	res.setHeader("content-length", String(size));
	res.setHeader("cache-control", "public, max-age=86400");
	createReadStream(target).pipe(res);
}
/**
* Register the durable settings namespace when a settings service is composed.
*
* `settings` is reachable only through a nested `inject`: reading an undeclared
* service off the context does not yield `undefined`, it throws
* (`cannot get property "settings" without inject`), so a defensive
* `if (ctx.settings === undefined)` is itself the crash. The nested inject is
* what makes the service optional in the way this plugin wants — the callback
* runs once a provider is composed and simply never runs otherwise, leaving the
* skin on its built-in defaults.
*
* This is the pattern the harness's own `dsh-client-ui-theme` uses for the same
* seam (`ctx.inject(["settings"], settingsCtx => settingsCtx.settings.register(...))`).
*/
function registerSkinSettings(ctx) {
	ctx.inject(["settings"], (settingsCtx) => {
		try {
			settingsCtx.settings?.register(SKIN_SETTINGS_NAMESPACE, SkinSettingsSchema);
			settingsCtx.logger?.info?.(`dsh-skin-endfield: settings namespace "${SKIN_SETTINGS_NAMESPACE}" registered`);
		} catch (error) {
			settingsCtx.logger?.warn?.(`dsh-skin-endfield: settings registration failed (${error instanceof Error ? error.message : String(error)}) — the skin continues on its built-in defaults.`);
		}
	});
}
function apply(ctx) {
	registerSkinSettings(ctx);
	if (ctx.webServer === void 0) {
		ctx.logger?.warn?.("dsh-skin-endfield: ctx.webServer unavailable — the vendored fonts will not be served; the skin falls back to the system font stack.");
		return;
	}
	ctx.effect?.(() => ctx.webServer?.register({
		kind: "prefix",
		path: FONT_ROUTE,
		handler: (req, res) => {
			serveFrom(FONT_DIR, FONT_ROUTE, req.url, res);
		}
	}), "dsh-skin-endfield: font route");
	ctx.effect?.(() => ctx.webServer?.register({
		kind: "prefix",
		path: LOGO_ROUTE,
		handler: (req, res) => {
			serveFrom(LOGO_DIR, LOGO_ROUTE, req.url, res);
		}
	}), "dsh-skin-endfield: plate route");
	/**
	* The user's own marks: GET serves one, POST /upload writes one.
	*
	* One route rather than two because they are the same directory and the same guard; the only
	* difference is the method, and the upload path is intercepted before it can be read as a
	* filename (there is no file called `upload`, so the worst case without the interception would
	* be a 404).
	*/
	ctx.effect?.(() => ctx.webServer?.register({
		kind: "prefix",
		path: USER_ROUTE,
		handler: (req, res) => {
			const path = (req.url ?? "").split("?")[0] ?? "";
			if (req.method === "POST" && path === USER_UPLOAD_PATH) return handleUpload(req, res);
			if (req.method !== "GET" && req.method !== "HEAD") {
				res.statusCode = 405;
				res.setHeader("allow", "GET, HEAD, POST");
				res.end("method not allowed");
				return;
			}
			return serveFrom(marksDir(), USER_ROUTE, req.url, res);
		}
	}), "dsh-skin-endfield: user mark route");
	ctx.logger?.info?.(`dsh-skin-endfield: serving fonts at ${FONT_ROUTE}, plates at ${LOGO_ROUTE}, and uploads at ${USER_ROUTE}`);
}
//#endregion
export { FONT_ROUTE, LOGO_ROUTE, SkinSettingsSchema, apply, inject, marksDir, name };

//# sourceMappingURL=index.js.map