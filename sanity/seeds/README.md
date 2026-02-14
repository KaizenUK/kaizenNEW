# Sanity Seed Docs

`page-route-starters.ndjson` contains starter `page` documents for the main site routes.

Import command:

```bash
pnpm sanity dataset import sanity/seeds/page-route-starters.ndjson production --replace
```

Notes:

- Use `--replace` only if you want to overwrite docs with matching `_id` values.
- These docs are starter scaffolds for Presentation mode; replace section content with real copy/images.
- Home route uses slug `home` and is resolved to `/` by the frontend route-candidate lookup.
