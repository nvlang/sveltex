# Introduction

Thank you for considering contributing to SvelTeX!

## Kinds of contributions

There are many ways to contribute to SvelTeX:

-   Submitting issues: bug reports, feature requests, etc.
-   Starting discussions in the repository's _Discussions_ tab: questions,
    feedback, suggestions, etc.
-   Improving the documentation:
    -   Inline comments (`... // comment`), primarily meant for implementation
        details
    -   TSDoc comments (`... /** comment */`), primarily meant for API
        documentation (incl. internal APIs)
    -   READMEs, meant to provide an overview of sibling files and directories
        (except for the root directory's README, which is meant to provide an
        overview of the entire project).
    -   Markdown files in the `docs/src` directory, which may be deployed to the
        [SvelTeX website](https://sveltex.dev/)
-   Code contributions of all sorts: bug fixes, new features, performance
    improvements, refactorings, etc.

## Before contributing

-   If you're planning to contribute a substantial change, please submit an
    issue or start a discussion first. This way, you can get feedback on your
    idea before you invest time in implementing it.
-   Do not contribute to SvelTeX if you are not willing to accept edits to your
    contributions. This includes possibly substantial changes to the code,
    documentation, and comments.
-   Do not expect promptness in responses to your contributions. I try to be
    responsive, but I have other commitments that may take precedence. Please
    remember that this is a free, open-source, non-commercial project.

## Process

To contribute to SvelTeX, fork the repository, create a branch, commit your
changes, and submit a pull request. Furthermore:

-   Please add meaningful tests for your changes that cover all new code paths
    and edge cases. If applicable, also add E2E Playwright tests.
-   Please ensure that all tests pass before submitting your pull request.
-   Please ensure that your code follows the existing code style and formatting.
-   Please ensure that your code is well-documented, and possibly update
    existing comments or documentation to reflect your changes, if necessary.
-   For commit messages, we try to roughly follow the [Conventional
    Commits](https://www.conventionalcommits.org/) specification.

## Security

If you find a security vulnerability, please do NOT open an issue. Email
[security@sveltex.dev](mailto:security@sveltex.dev) instead. This email address
is hosted with Proton Mail, so you can use PGP encryption for your message
(highly recommended).
