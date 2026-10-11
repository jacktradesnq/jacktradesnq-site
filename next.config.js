/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  // Build time, inlined in the client bundle: a time-limited promo (PerpsBlock)
  // built after its end date must not show up in the static HTML at all.
  env: { NEXT_PUBLIC_BUILD_TS: String(Date.now()) },
};
module.exports = nextConfig;
