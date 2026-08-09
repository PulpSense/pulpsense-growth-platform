import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const interactionHydration = () => ({
  name: "pulpsense-client-interaction",
  hooks: {
    "astro:config:setup": ({ addClientDirective }) => {
      addClientDirective({
        name: "interaction",
        entrypoint: "./src/client-directives/interaction.ts",
      });
    },
  },
});

export default defineConfig({
  output: "static",
  trailingSlash: "always",
  integrations: [interactionHydration(), react()],
  build: { inlineStylesheets: "always" },
  vite: {
    plugins: [tailwindcss()],
  },
});
