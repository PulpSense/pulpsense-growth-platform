const config = {
  'apps/funnels/**/*.{js,jsx,ts,tsx}': () => [
    'pnpm --filter @pulpsense/funnels lint --fix',
    'pnpm --filter @pulpsense/funnels lint',
  ],
  'apps/funnels/**/*.ts?(x)': () =>
    'pnpm --filter @pulpsense/funnels check-types',
  'apps/automations/**/*.ts': () =>
    'pnpm --filter @pulpsense/automations check-types',
  '*.json': ['prettier --write'],
};

export default config;
