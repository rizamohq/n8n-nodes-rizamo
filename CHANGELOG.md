# Changelog

## 0.1.1

- Create Post takes account IDs as a list or separated by commas, so an expression can map them from a sheet. The trigger takes profile IDs the same way.
- Five workflow templates in `templates/`.

## 0.1.0

- Rizamo node: posts (create as a draft, scheduled, queued or published now, get, get many, publish now, delete), media (upload, import from a URL, get), accounts, profiles, analytics, inbox threads, comments and short links.
- Rizamo Trigger: every Rizamo event, limited to some profiles if you choose, with each delivery's signature checked.
- Rizamo API credential (an API key).
