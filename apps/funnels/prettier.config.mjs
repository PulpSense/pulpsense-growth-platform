import * as astroPlugin from "prettier-plugin-astro";
import * as tailwindPlugin from "prettier-plugin-tailwindcss";

/** @type {import("prettier").Config} */
const config = {
  plugins: [astroPlugin, tailwindPlugin],
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
      },
    },
  ],
};

export default config;
