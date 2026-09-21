/**
 * A URL for a file shipped in the build, resolved against the base path the app
 * was built for.
 *
 * Everything used to be written as an absolute `/brand/...` or `/ocr/...`, which
 * is correct only when the app is served from the root of its origin. V01 has
 * to put the app on a host the owner can open from a phone, and the obvious
 * one serves a project at `/<repo>/`, where every one of those paths is a 404.
 *
 * `import.meta.env.BASE_URL` is `/` by default, so this changes nothing until a
 * build actually sets a base path.
 */
export function assetPath(path: string) {
  const base = import.meta.env.BASE_URL || "/"
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
}

/** The same thing, absolute, for APIs that will not take a relative URL. */
export function absoluteAssetUrl(path: string) {
  return new URL(assetPath(path), window.location.href).href
}
