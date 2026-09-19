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
	labelPrefix: true
};
//#endregion
//#region src/index.ts
/**
* Host half of dsh-skin-endfield.
*
* The host row exists for three reasons:
*   1. it makes this package a loader entry, which is what makes the harness
*      pick up the `dsh.client` browser bundle at all;
*   2. it serves the vendored open-source font faces from `/skin-endfield/fonts/`
*      so the browser half never needs a data: URI or an external CDN;
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
	labelPrefix: z.boolean().default(SKIN_SETTINGS_DEFAULTS.labelPrefix)
});
const HERE = dirname(fileURLToPath(import.meta.url));
/** `lib/` -> package root; fonts are shipped in `assets/fonts`. */
const FONT_DIR = join(HERE, "..", "assets", "fonts");
const FONT_ROUTE = "/skin-endfield/fonts";
const MIME = {
	".woff2": "font/woff2",
	".woff": "font/woff",
	".ttf": "font/ttf",
	".txt": "text/plain; charset=utf-8"
};
/**
* Serve `assets/fonts` read-only. `path` is normalised and then checked against
* the font directory, so `..` cannot escape it.
*/
function handleFontRequest(rawUrl, res) {
	const pathOnly = (rawUrl ?? "").split("?")[0] ?? "";
	const relative = decodeURIComponent(pathOnly.slice(20)).replace(/^\/+/, "");
	const target = normalize(join(FONT_DIR, relative));
	if (!target.startsWith(FONT_DIR + sep)) {
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
			handleFontRequest(req.url, res);
		}
	}), "dsh-skin-endfield: font route");
	ctx.logger?.info?.(`dsh-skin-endfield: serving fonts at ${FONT_ROUTE}`);
}
//#endregion
export { FONT_ROUTE, SkinSettingsSchema, apply, inject, name };

//# sourceMappingURL=index.js.map