import { createReadStream, statSync } from "node:fs";
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
	* chrome treatment on the shell's own bar, the wordmark is a page mark in the
	* transcript's right margin, and the dot block is a bounded piece of print in its
	* upper-right corner. Any subset is a legitimate configuration, and each one is
	* confined to its own zone so that no combination can overlap another.
	*
	* OFF by default on purpose: this layer paints on top of (or behind) content the
	* shell owns, so a fresh install must look exactly like the skin without them. A
	* user opts in per effect.
	*/
	headerLight: false,
	/** The vertical ENDFIELD mark in the transcript's right margin. */
	mark: false,
	/** The halftone block in the transcript's upper-right corner. */
	dotBlock: false,
	/**
	* How the page mark is set: the vertical wordmark, or the printed logo plate.
	*
	* Two renderings of one idea, not two effects -- they occupy the same corner, and a page has
	* room for one mark in it. The plate is the default because a decal reads as printing on the
	* page at any size, while the wordmark only works as a small vertical strip (it is outline
	* text: set large it competes with the transcript, set small it stops being legible).
	* Both ship because the choice is taste, and the earlier round's lettering is not something
	* a later round gets to delete on the user's behalf.
	*/
	markStyle: "decal",
	/**
	* The mark's text. Kept as a setting rather than a constant because the mark is the
	* one effect whose value depends on the person using it -- someone who does not want
	* the studio's wordmark can put a project, a branch or a role call sign there
	* instead. Normalised (upper-cased, trimmed, length-capped) before it is painted.
	*/
	markText: "ENDFIELD",
	/**
	* How strongly the printed plate reads, and how large it is set.
	*
	* The decal is drawn UNDER the transcript on purpose -- it is a print on the page, not a
	* sticker on the glass -- so its opacity is what decides whether it is a watermark or a
	* stain, and 0.12 is the value that reads on the dark canvas without touching legibility.
	* Measured, not guessed: `scripts/probe-decal-live.mjs` prints the ink it contributes.
	*/
	decalOpacity: .12,
	/** Multiplier on the plate's width. 1 puts it at 46% of the panel, which is about 600px. */
	decalScale: 1,
	/**
	* Which plate prints.
	*
	* `skin` is the page mark the skin ships as its default (the full lockup); the other three are
	* the same family drawn at other proportions — the lettering alone, the stamp, and the two
	* composed. All four are this repository's own drawings.
	*/
	decalPlate: "skin"
};
/**
* The plate's own address and proportions, named once for both halves.
*
* The URL is spelled here rather than in each place it is used because three unrelated files
* need it to agree: the host half serves it, the decor sheet paints it, and the settings page
* previews it. A route rename that reaches two of the three is a blank decal that no type check
* would catch.
*/
const DECAL_ROUTE = "/skin-endfield/logo";
const PLATES = {
	wordmark: {
		files: ["wordmark.png"],
		label: "Wordmark (wide)"
	},
	badge: {
		files: ["badge.png"],
		label: "Badge (stamp)"
	},
	lockup: {
		files: ["badge.png", "wordmark.png"],
		label: "Lockup (badge + wordmark)"
	}
};
/** The plates a user can pick: the page mark that ships as the default, or one of the three. */
const DECAL_PLATES = ["skin", ...Object.keys(PLATES)];
PLATES.wordmark.files[0];
PLATES.badge.files[0];
/**
* The root class that arms one plate, spelled here rather than in the stylesheet module.
*
* Three places need it to agree — the settings path that toggles it, the decor sheet that keys
* the rule on it, and the live check that arms it by hand — and a class name is exactly the kind
* of string that gets renamed in two of the three.
*/
const DECAL_PLATE_CLASS_PREFIX = "endfield-plate-";
const decalPlateClass = (plate) => `${DECAL_PLATE_CLASS_PREFIX}${plate}`;
DECAL_PLATES.map(decalPlateClass);
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
	markStyle: z.union([z.const("decal"), z.const("text")]).default(SKIN_SETTINGS_DEFAULTS.markStyle),
	markText: z.string().default(SKIN_SETTINGS_DEFAULTS.markText),
	decalOpacity: z.number().min(0).max(1).default(SKIN_SETTINGS_DEFAULTS.decalOpacity),
	decalScale: z.number().min(.4).max(1.8).default(SKIN_SETTINGS_DEFAULTS.decalScale),
	decalPlate: z.union(DECAL_PLATES.map((plate) => z.const(plate))).default(SKIN_SETTINGS_DEFAULTS.decalPlate)
});
const HERE = dirname(fileURLToPath(import.meta.url));
/** `lib/` -> package root; fonts and the decal plate are shipped under `assets/`. */
const FONT_DIR = join(HERE, "..", "assets", "fonts");
/**
* The decal plate lives in its own directory rather than under a general `assets` route.
*
* `assets/screenshots`, `assets/in-game-frames` and `assets/ui-primitives` are design
* REFERENCES: they exist so this skin's chrome could be measured against the game, and they are
* explicitly not part of what the skin ships. A route that served `assets/` wholesale would put
* them one URL away from every browser that loads the skin, so only the plate's own directory
* is exposed — the compliance line in the README is worth exactly as much as this constant.
*/
const LOGO_DIR = join(HERE, "..", "assets", "logo");
const FONT_ROUTE = "/skin-endfield/fonts";
/**
* The plate route is spelled in `settings.ts` and re-exported here, because three files have to
* agree on it: this handler, the decor sheet that paints the plate, and the settings page that
* previews it. A rename that reaches two of the three is a blank decal no type check would catch.
*/
const LOGO_ROUTE = DECAL_ROUTE;
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
	}), "dsh-skin-endfield: logo route");
	ctx.logger?.info?.(`dsh-skin-endfield: serving fonts at ${FONT_ROUTE} and the decal at ${LOGO_ROUTE}`);
}
//#endregion
export { FONT_ROUTE, LOGO_ROUTE, SkinSettingsSchema, apply, inject, name };

//# sourceMappingURL=index.js.map