const fs = require('fs');
const path = require('path');

const INSTALLER_LIMIT_BYTES = 10000000;  // 10 MB
const INSTALLED_LIMIT_BYTES = 15000000;  // 15 MB
const BINARY_LIMIT_BYTES = 8000000;      // 8 MB
const WEB_ASSET_LIMIT_BYTES = 1500000;   // 1.5 MB

function checkSize(filePath, limit, label) {
  if (!fs.existsSync(filePath)) {
    console.log(`[Size Check] ${label}: File ${filePath} not found, skipping.`);
    return;
  }
  const stat = fs.statSync(filePath);
  console.log(`[Size Check] ${label}: ${stat.size} bytes (Limit: ${limit} bytes)`);
  if (stat.size > limit) {
    console.error(`[Size Check FAIL] ${label} exceeded size limit! ${stat.size} > ${limit}`);
    process.exitCode = 1;
    throw new Error(`Size limit exceeded for ${label}`);
  }
}

// 1. Check Rust Binary
const rustBinary = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'vantalock_core');
checkSize(rustBinary, BINARY_LIMIT_BYTES, 'Single Binary');

// 2. Check Web Assets
const rendererDir = path.join(__dirname, '..', 'src', 'renderer');
let webAssetsBytes = 0;
if (fs.existsSync(rendererDir)) {
  fs.readdirSync(rendererDir).forEach(f => {
    const p = path.join(rendererDir, f);
    if (fs.statSync(p).isFile()) webAssetsBytes += fs.statSync(p).size;
  });
}
console.log(`[Size Check] Web Assets: ${webAssetsBytes} bytes (Limit: ${WEB_ASSET_LIMIT_BYTES} bytes)`);
if (webAssetsBytes > WEB_ASSET_LIMIT_BYTES) {
  console.error(`[Size Check FAIL] Web assets exceeded limit! ${webAssetsBytes} > ${WEB_ASSET_LIMIT_BYTES}`);
  process.exitCode = 1;
  throw new Error('Size limit exceeded for Web Assets');
}

console.log('[Size Check PASS] All checked artifacts comply with Section 1 size limits.');
