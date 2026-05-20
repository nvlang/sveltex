---
'@nvl/sveltex': patch
---

When the `mathjax` backend is selected with a non-default `math.font`,
SvelTeX now probes the matching `@mathjax/mathjax-<font>-font` package
upfront via `import.meta.resolve` and surfaces a missing one through the
end-of-build missing-dependencies summary. Previously, an uninstalled
non-default font package would only manifest as an opaque "Cannot find
module" error deep inside MathJax's lazy font loader, with no hint about
which package to install.

The default font (`newcm`) is unaffected: `@mathjax/src` already declares
`@mathjax/mathjax-newcm-font` as a regular dependency, so it's always
present whenever `@mathjax/src` is.
