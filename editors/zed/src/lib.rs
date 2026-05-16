//! Zed extension for SvelTeX (`.sveltex`).
//!
//! This extension does two things:
//!
//!   1. It registers the `SvelTeX` language (bound to the `.sveltex` file
//!      extension) and ships the `sveltex` tree-sitter grammar plus the query
//!      files under `languages/sveltex/`. That wiring is entirely declarative
//!      — see `extension.toml` and `languages/sveltex/config.toml` — and needs
//!      no code.
//!
//!   2. It launches `@nvl/sveltex-language-server` over stdio. That *does*
//!      need code: Zed asks the extension for a [`zed::Command`] describing
//!      how to start the server, which is what [`SveltexExtension::
//!      language_server_command`] returns.
//!
//! The language server is a Node program. `@nvl/sveltex-language-server`
//! ships `bin/server.js`, a tiny dependency-free entry point whose only job is
//! to call the package's `startServer()` — itself a thin stdio wrapper around
//! the transport-agnostic core. Running `node bin/server.js --stdio` is
//! therefore all that is required.
//!
//! Server resolution is workspace-first: if the project already depends on
//! `@nvl/sveltex-language-server` (the common case — it is a dependency of the
//! VS Code extension and a natural dev-dependency of a SvelTeX project), that
//! local copy is used. Otherwise the extension installs the package into its
//! own working directory via Zed's npm helpers, exactly as Zed's first-party
//! Svelte extension installs `svelte-language-server`.

use std::fs;

use zed_extension_api::{self as zed, LanguageServerId, Result};

/// The npm package that provides the SvelTeX language server.
const SERVER_PACKAGE: &str = "@nvl/sveltex-language-server";

/// Path, relative to the package root, of the server's stdio entry point.
/// `@nvl/sveltex-language-server`'s `package.json` exposes this exact file as
/// both its `bin` and an explicit `./bin/server.js` export.
const SERVER_ENTRY: &str = "bin/server.js";

struct SveltexExtension {
    /// Whether the npm package has already been installed (or confirmed
    /// present) during this Zed session. Re-installing on every
    /// `language_server_command` call would be wasteful, so the first
    /// successful resolution latches this.
    did_install: bool,
}

impl SveltexExtension {
    /// Resolves the absolute path of `bin/server.js`.
    ///
    /// Resolution order:
    ///
    ///   1. A workspace-local install: `<worktree>/node_modules/@nvl/
    ///      sveltex-language-server/bin/server.js`. Honouring the project's
    ///      own dependency means the editor and any CLI/CI use of SvelTeX
    ///      agree on one server version.
    ///   2. An extension-managed install: the package is fetched with Zed's
    ///      npm helpers into the extension's working directory and the entry
    ///      point resolved relative to that.
    fn server_script_path(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<String> {
        // (1) Workspace-local install.
        if let Some(path) = workspace_server_path(worktree) {
            return Ok(path);
        }

        // (2) Extension-managed install. `npm_package_installed_version`
        // reports the version already present in the extension's working
        // directory (if any); the package is (re)installed only when missing
        // or out of date, and only once per session.
        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        let installed = zed::npm_package_installed_version(SERVER_PACKAGE)?;
        let latest = zed::npm_package_latest_version(SERVER_PACKAGE)?;

        // (Re)install when the package is missing or not at the latest
        // version. Once a session has confirmed an up-to-date copy, skip the
        // install entirely on subsequent calls.
        let up_to_date = installed.as_deref() == Some(latest.as_str());
        if !up_to_date || !self.did_install {
            if !up_to_date {
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::Downloading,
                );
                if let Err(error) =
                    zed::npm_install_package(SERVER_PACKAGE, &latest)
                {
                    // A failed update must not be fatal if a usable copy is
                    // already on disk; only surface the error when there is
                    // nothing to fall back to.
                    if installed.is_none() {
                        return Err(error);
                    }
                }
            }
            self.did_install = true;
        }

        let entry = extension_server_path();
        if fs::metadata(&entry).map(|m| m.is_file()).unwrap_or(false) {
            Ok(entry)
        } else {
            Err(format!(
                "the SvelTeX language server was installed but its entry \
                 point was not found at `{entry}`. Add \
                 `{SERVER_PACKAGE}` to your project's dependencies, or check \
                 that the package layout has not changed."
            ))
        }
    }
}

/// Returns the workspace-local `bin/server.js` path, if the project has
/// `@nvl/sveltex-language-server` installed in its `node_modules`.
fn workspace_server_path(worktree: &zed::Worktree) -> Option<String> {
    let root = worktree.root_path();
    let candidate = format!(
        "{root}/node_modules/{SERVER_PACKAGE}/{SERVER_ENTRY}",
        root = root.trim_end_matches('/'),
    );
    match fs::metadata(&candidate) {
        Ok(meta) if meta.is_file() => Some(candidate),
        _ => None,
    }
}

/// Returns the `bin/server.js` path for an extension-managed install. Zed's
/// `npm_install_package` installs into `node_modules` under the extension's
/// current working directory, so the entry point is a fixed relative path
/// from there.
fn extension_server_path() -> String {
    format!("node_modules/{SERVER_PACKAGE}/{SERVER_ENTRY}")
}

impl zed::Extension for SveltexExtension {
    fn new() -> Self {
        Self { did_install: false }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let script = self.server_script_path(language_server_id, worktree)?;

        // Launch `node bin/server.js --stdio`. `bin/server.js` calls
        // `startServer()`, whose `createConnection(ProposedFeatures.all)`
        // inspects `process.argv`; the `--stdio` flag selects the stdin/
        // stdout transport that Zed speaks.
        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![script, "--stdio".to_string()],
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(SveltexExtension);
