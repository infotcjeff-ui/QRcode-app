/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // 解決 @vladmandic/face-api 使用 ESM + 動態 require 造成的 webpack bundler 問題
  // 這些套件只會在瀏覽器端以 dynamic import() 載入，不需 SSR bundle
  experimental: {
    serverComponentsExternalPackages: [
      "@tensorflow/tfjs",
      "@tensorflow/tfjs-core",
      "@tensorflow/tfjs-converter",
      "@tensorflow/tfjs-backend-cpu",
      "@tensorflow/tfjs-backend-webgl",
      "@tensorflow/tfjs-backend-webgpu",
    ],
  },
  webpack(config, { isServer }) {
    // face-api 只能在 client-side 執行 (需要 canvas / video API)
    // 確保 webpack 不對其 TensorFlow.js 依賴產生 static analysis 錯誤
    config.externals = config.externals || [];
    if (!isServer) {
      // 將 tensorflow 相關套件列為 webpack externals，避免在 client bundle 中靜態分析
      config.externals.push({
        "@tensorflow/tfjs": "commonjs @tensorflow/tfjs",
        "@tensorflow/tfjs-core": "commonjs @tensorflow/tfjs-core",
        "@tensorflow/tfjs-converter": "commonjs @tensorflow/tfjs-converter",
        "@tensorflow/tfjs-backend-cpu": "commonjs @tensorflow/tfjs-backend-cpu",
        "@tensorflow/tfjs-backend-webgl": "commonjs @tensorflow/tfjs-backend-webgl",
      });
    }
    return config;
  },
};

export default nextConfig;