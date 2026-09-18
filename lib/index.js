import { createReadStream, statSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
//#region src/index.ts
/**
* Host half of dsh-skin-endfield.
*
* The host row exists for two reasons:
*   1. it makes this package a loader entry, which is what makes the harness
*      pick up the `dsh.client` browser bundle at all;
*   2. it serves the vendored open-source font faces from `/skin-endfield/fonts/`
*      so the browser half never needs a data: URI or an external CDN.
*
* It intentionally provides no Cordis service: the DSH seam rules forbid a
* second provider in the same scope, and a skin has no service to offer.
*/
const name = "dsh-skin-endfield";
/** Injected service names this plugin needs on the host plane. */
const inject = ["webServer"];
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
* Serve `assets/fonts` read-only. `path` is normalised and then checked
* against the font directory, so `..` cannot escape it.
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
function apply(ctx) {
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
export { FONT_ROUTE, apply, inject, name };

//# sourceMappingURL=index.js.map