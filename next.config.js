/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  // Build time, inlined in the client bundle: a time-limited promo (PerpsBlock)
  // built after its end date must not show up in the static HTML at all.
  env: { NEXT_PUBLIC_BUILD_TS: String(Date.now()) },
  // content/prop-firms/codes.md, imported as text by app/prop-firms/futures.ts: the page
  // prints a code or « via my link » from the same file the promo feed reads.
  webpack: (config) => {
    config.module.rules.push({ test: /\.md$/, type: 'asset/source' });
    return config;
  },
};
module.exports = nextConfig;
