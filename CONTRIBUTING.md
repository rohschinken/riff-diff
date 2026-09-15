# Contributing to Riff-Diff

Thank you for your interest in Riff-Diff!

This project is GPL-3.0 licensed. By contributing, you agree that your contributions will be licensed under the same terms.

---

## Getting Started

1. **Find or open an issue** — check the [issue tracker](https://github.com/rohschinken/riff-diff/issues) to see if someone is already working on it.
2. **Fork the repository** and create a feature branch (`git switch -c feature/my-feature`).
3. **Set up your development environment** (see [docs/development.md](docs/development.md#getting-started)).
4. **Write your change**, following the guidelines below.
5. **Submit a pull request** against `main`.

---

## Reporting Issues

Before opening an issue, please search existing issues and pull requests to avoid duplicates.

### Bug reports

Use the GitHub issue template and include:

- Riff-Diff version (shown in the app header, e.g. `v1.3.0`) and which build you use (web, Windows, macOS, Linux/Flatpak)
- Browser/OS versions if using the web version
- Steps to reproduce
- Expected vs. actual behavior
- If possible, the two `.gp`/`.gp7`/`.gp8` files that trigger the bug — **or** a description of the songs if the files are copyrighted
- Screenshots or a screen recording, when helpful

### Feature requests

Describe the problem you want to solve and how the feature should behave. Tell us what's out of scope for you so we can judge impact.

---

## Development Workflow

This project is **test-first**:

1. Write a failing test that describes the expected behavior.
2. Implement until the test passes.
3. Make sure the whole suite is green before submitting.

### Verify your changes

```bash
npm test        # run the full test suite (Vitest + happy-dom)
npm run build   # type-check (tsc -b) + production build
```

All new code must be covered by tests. The suite uses `@testing-library` on happy-dom; tests are co-located with source (`src/**/*.test.{ts,tsx}`).

### Code style

- TypeScript with strict mode; use the project's existing conventions (no Prettier/ESLint config is enforced — match the surrounding code).
- No runtime external dependencies for pure logic — the diff engine in `src/diff/` must stay dependency-free and testable.
- Update the docs if you change behavior: `README.md` for user-facing changes and `docs/architecture.md` for design/architecture changes.

### Commit conventions

Use conventional commit messages:

- `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`
- Keep the commit focused on one change
- Example: `fix: preserve scroll position when zooming`

---

## Pull Requests

- Target `main`.
- Keep PRs small and focused — one logical change per PR.
- A passing build and green test suite are required.
- Mention the issue number your PR addresses (e.g. `Closes #12`).
- Be responsive to review feedback; maintainers and community members may suggest changes.

### Pull request checklist

- [ ] Tests pass (`npm test`)
- [ ] Build passes (`npm run build`)
- [ ] New behavior is covered by tests
- [ ] Docs updated if user-facing behavior changed
- [ ] Commit messages follow the conventional format

---

## Code of Conduct

Be respectful and constructive. Harassment, discrimination, and personal attacks will not be tolerated — in issues, PRs, or elsewhere.

---

## Need Help?

Open a [discussion](https://github.com/rohschinken/riff-diff/discussions) for questions, or comment on the relevant issue.