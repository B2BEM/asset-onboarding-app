# b2bem-documents — shared copy

Canonical, version-controlled copy of the `b2bem-documents` skill so it can be
shared across the B2BEM group instead of living only in one person's personal
claude.ai skill library.

## Install (personal claude.ai skill library)

1. Download `SKILL.md` from this folder.
2. In claude.ai, go to **Settings → Capabilities → Skills → Upload skill**.
3. Upload a folder named `b2bem-documents` containing `SKILL.md`.

Claude Code picks the skill up automatically for anyone working in this
repository — no upload needed for repo work.

## Known gaps in this copy

`SKILL.md` references four supporting files that are **not** included here:

- `references/naming.md` — document numbering, area/type codes, file naming
- `references/structure.md` — mandatory element order, cover page, section templates
- `references/build.md` — docx-js build pattern, brand colours, helpers, validation
- `assets/b2bem_logo.png` — running-header logo (140x47 wide lockup)

Until they are added, the skill degrades: document numbering and the docx build
pattern fall back to the summaries in `SKILL.md`, and the running header uses the
bold Navy "B2BEM" wordmark instead of the logo image.

`SKILL.md` also names a companion skill, `hse-document-audit`, which is not
currently published anywhere.

## Encoding

The source copy had 77 double-encoded UTF-8 sequences (em dashes, en dashes,
middots, arrows stored as `a-tilde-euro` style mojibake). Those are repaired in
this copy. Keep this file UTF-8 with LF line endings.
