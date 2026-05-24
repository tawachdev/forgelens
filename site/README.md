# ForgeLens Site (Astro)

Product website built with Astro.

Routes:

1. `/` landing page
2. `/docs` docs hub + guides
3. `/examples` command workflows
4. `/launch` demo storyboard page

Docs are authored in MDX under:

- `site/src/content/docs/*.mdx`

Run locally from repo root:

```bash
pnpm --dir site install
pnpm --dir site dev
```

Build static output:

```bash
pnpm --dir site build
```

Deployment notes:

- `site/DEPLOY.md`
