/** @type {import('next').NextConfig} */
const nextConfig = {
  // DuckDB 네이티브 바인딩은 서버 번들에서 외부 처리한다.
  serverExternalPackages: ['@duckdb/node-api'],
};

export default nextConfig;
