const config = {
  '{apps,packages}/**/*.{js,jsx,ts,tsx}': ['eslint --fix', 'eslint'],
  '{apps,packages}/**/*.ts?(x)': () => 'pnpm check-types',
  '*.json': ['prettier --write'],
};

export default config;
