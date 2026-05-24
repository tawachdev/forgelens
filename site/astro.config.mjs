import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [mdx()],
  server: {
    host: true,
    port: 4321
  }
});
