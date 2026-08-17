# b2bem-documents — shared copy

Version-controlled copy of the `b2bem-documents` skill so it can be shared
across the B2BEM group instead of living only in one person's personal
claude.ai skill library.

## Source of truth

Synced from the SharePoint master-of-record:

```
B2BEM - Internal
  01. Business Management/06. Claude Ref/01.Claude/02. skills-main/b2bem-documents/
```

Do **not** take copies from `_superseded/` — those are retired. Do not take
copies from the personal claude.ai workspace — that copy is drifted.

**SharePoint is upstream of this repo, not the reverse.** When the two differ,
pull master → repo. Never push repo → master; the master is edited directly by
its owners and carries changes this repo will not have seen.

## Contents

Synced against the master as at **2026-08-14** (`SKILL.md` metadata
`last_updated: 2026-08-05`). Byte counts below are the master's, which uses CRLF
line endings for all files except `naming.md`; this repo stores LF, so local
`wc -c` reads lower by one byte per line.

| File | Master bytes | Status |
|---|---|---|
| `SKILL.md` | 29,777 | In sync |
| `references/naming.md` | 10,781 | In sync (LF upstream) |
| `references/structure.md` | 19,658 | In sync |
| `references/build.md` | 35,846 | In sync |
| `assets/b2bem_logo.png` | 208,733 | **Missing** — see below |
| `assets/kduffy_signature.png` | 14,041 | **Missing** — see below |
| `assets/sclaydon_signature.png` | 2,620 | **Missing** — see below |

## The binary assets are not in this repo

None of the three PNGs in `assets/` could be transferred from SharePoint — the
Graph `/content` endpoint rejects binary reads through the connector (HTTP 400).

Copy them manually from the master folder above into `assets/` before packaging
this skill for upload:

- `b2bem_logo.png` — the wide horizontal lockup (source `Website_topper Logo.png`).
  Without it the running header falls back to a bold Navy "B2BEM" wordmark, which
  the builder handles cleanly but is not the house style.
- `kduffy_signature.png` — auto-applied to the Author row.
- `sclaydon_signature.png` — auto-applied to the Reviewer row when S. Claydon is
  the reviewer.

A missing signature file degrades to a blank cell and never breaks a build, so a
document built without them is structurally valid but unsigned.

## Encoding fault — fixed upstream, closed

The master `SKILL.md` previously carried 77 double-encoded UTF-8 sequences (em
dashes, en dashes, middots and arrows stored as mojibake — UTF-8 bytes decoded as
cp1252 and re-saved). **This was repaired upstream on 2026-08-05.** The owners
kept the faulty file beside it as `SKILL.md.BACKUP-2026-08-01-mojibake`
(28,975 bytes) for reference.

No action remains. A fresh pull from SharePoint is now clean.

## Control change to note (05/08/2026)

The Reviewer row is now **auto-signed** for S. Claydon, at the director's
instruction. Previously it was deliberately left blank so that a blank Reviewer
signature was what stopped an unreviewed document reading as executed.

That technical control is gone. The build no longer proves review took place —
issuing the document is now the act that asserts it. Do not issue a document
S. Claydon has not actually reviewed. S. Ziegelaar has no signature graphic and
still signs by hand.

## Install

**Claude Code** — automatic for anyone working in this repository. No action.

**claude.ai web / desktop / Cowork** — these surfaces read only the cloud skill
library, so local files never reach them. Package this folder (with the three
PNGs added) as a `.skill` zip whose entries are `b2bem-documents/...` and upload
via Settings → Capabilities → Skills, with the intended workspace active.

Note the workspace trap recorded in the 2026-07-25 upload pack: the account has
a personal workspace and a **B2bem Enterprise Specialists (Team)** workspace,
and skills uploaded to one are invisible in the other.

## Related

`SKILL.md` names a companion skill, `hse-document-audit`, which is not present
in the claude.ai library. It appears in the 2026-07-25 upload-pack manifest, so
a bundle exists on SharePoint but has not been published.
