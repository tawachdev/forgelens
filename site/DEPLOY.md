# ForgeLens Site Deployment

Last checked: May 24, 2026.

## Recommendation

For ForgeLens right now, use **Vercel** for the Astro site.

Why:

1. Astro static deploy works with no extra adapter config.
2. GitHub import flow is very fast for launch pages and docs.
3. Preview deploy workflow is clean for product iteration.

## Platform comparison

### Vercel

- Astro static deploy requires no extra config.
- Hobby is free; Pro starts at $20/month + usage.
- Best fit for fast product launches and frequent design updates.

### Cloudflare Pages

- Free plan has strong limits: 500 builds/month, 1 concurrent build, 100 custom domains per project, and 20,000 files/site.
- Good if you want Cloudflare ecosystem and edge-first stack.
- Strong option after initial launch if CDN/edge integration is your priority.

### Netlify

- Astro static deploy requires no extra config.
- Free plan uses a credit model (300 credit limit/month).
- Can be good, but the usage-credit model is less predictable for teams that are still learning traffic patterns.

## Recommended first deploy flow

1. Push this branch to GitHub.
2. In Vercel dashboard, import the repository.
3. Set root directory to `site`.
4. Confirm build command `pnpm build`.
5. Confirm output directory `dist`.
6. Deploy.

## CLI deployment note

I tested Vercel CLI login flow:

```bash
cd site
npx vercel whoami
```

It started device auth and asked for account login.  
After you log in once, CLI deploy is:

```bash
cd site
npx vercel --prod
```
