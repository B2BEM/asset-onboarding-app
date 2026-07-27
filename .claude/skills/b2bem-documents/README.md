# b2bem-documents — shared copy

Version-controlled copy of the `b2bem-documents` skill so it can be shared
across the B2BEM group instead of living only in one person's personal
claude.ai skill library.

## Source of truth

Rebuilt from the SharePoint master-of-record:

```
B2BEM - Internal
  01. Business Management/06. Claude Ref/01.Claude/02. skills-main/b2bem-documents/
```

Do **not** take copies from `_superseded/` — those are retired. Do not take
copies from the personal claude.ai workspace — that copy is drifted (see below).

## Contents

| File | Status |
|---|---|
| `SKILL.md` | Present. Encoding repaired — see below. |
| `references/naming.md` | Present, from the master. |
| `references/structure.md` | Present, from the master. |
| `references/build.md` | Present, from the master. |
| `assets/b2bem_logo.png` | **Missing** — see below. |

## The logo is not in this repo

`assets/b2bem_logo.png` (208 KB, the wide horizontal lockup, source
`Website_topper Logo.png`) could not be transferred from SharePoint — the Graph
`/content` endpoint rejects binary reads through the connector.

Copy it manually from the master folder above into `assets/` before packaging
this skill for upload. Without it the running header falls back to a bold Navy
"B2BEM" wordmark, which the builder handles cleanly but is not the house style.

## Encoding fault (fixed here, still present upstream)

The master `SKILL.md` contains **77 double-encoded UTF-8 sequences** — em
dashes, en dashes, middots and arrows stored as mojibake, the result of UTF-8
bytes being decoded as cp1252 and re-saved. They are repaired in this copy.

**The upstream master has not been fixed.** Anyone re-pulling from SharePoint
will reintroduce them. The three `references/*.md` files are clean.

## Install

**Claude Code** — automatic for anyone working in this repository. No action.

**claude.ai web / desktop / Cowork** — these surfaces read only the cloud skill
library, so local files never reach them. Package this folder (with the logo
added) as a `.skill` zip whose entries are `b2bem-documents/...` and upload via
Settings → Capabilities → Skills, with the intended workspace active.

Note the workspace trap recorded in the 2026-07-25 upload pack: the account has
a personal workspace and a **B2bem Enterprise Specialists (Team)** workspace,
and skills uploaded to one are invisible in the other.

## Related

`SKILL.md` names a companion skill, `hse-document-audit`, which is not present
in the claude.ai library. It appears in the 2026-07-25 upload-pack manifest, so
a bundle exists on SharePoint but has not been published.
