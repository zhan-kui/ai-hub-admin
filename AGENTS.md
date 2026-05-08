# AGENTS.md

This file defines how Codex should modify code in this project.

This project runs on Windows 11 and is a frontend Vue project.

---

## 1. General principles

- Modify only files directly related to the current task.
- Prefer minimal patch-based edits.
- Do not rewrite entire files unless absolutely necessary.
- Do not refactor existing code unless the user explicitly asks for it.
- Do not change unrelated logic, styles, text, routes, components, or configuration.
- Do not create large unrelated diffs because of formatting.
- Always inspect the diff after editing.

---

## 2. File encoding rules

All source files in this project must remain:

```text
UTF-8 without BOM + CRLF
```
