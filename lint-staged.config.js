const config = {
  'apps/funnels/src/**/*.{ts,tsx,astro}':
    'prettier --config apps/funnels/prettier.config.mjs --write',
  '{apps,packages}/**/*.{js,jsx,ts,tsx}': ['eslint --fix', 'eslint'],
  '{apps,packages}/**/*.ts?(x)': () => 'pnpm check-types',
  '*.json': ['prettier --write'],
};

export default config;
