import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  trailingSlash: true,
  reactStrictMode: true,
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Robots-Tag',
          value: 'noindex, nofollow, noarchive, noimageindex',
        },
      ],
    },
  ],
};

export default withBundleAnalyzer(nextConfig);
