const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// PNG generator using node zlib and pure buffer manipulation
function createPNG(width, height, drawFn) {
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc(height * (rowSize + 1)); // +1 filter byte per line

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowSize + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression method 0
  ihdrData.writeUInt8(0, 11); // filter method 0
  ihdrData.writeUInt8(0, 12); // interlace method 0
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

// CRC32 implementation
let crcTable = null;
function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
}

function crc32(buf) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Pixel drawing for Retro Basketball icon
function drawBasketballPixel(x, y, width, height, isMaskable = false) {
  const cx = width / 2;
  const cy = height / 2;
  const r = (width / 2) * (isMaskable ? 0.72 : 0.85); // Safe zone padding for maskable

  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);

  // Background
  if (dist > r) {
    if (isMaskable) {
      // Solid dark background for maskable safe margin
      return [9, 9, 11, 255];
    }
    // Transparent or dark rounded border
    return [0, 0, 0, 0];
  }

  // Outer black border of basketball
  if (dist >= r - Math.max(2, width * 0.04)) {
    return [15, 23, 42, 255];
  }

  // Seam lines check
  const nx = dx / r;
  const ny = dy / r;
  const seamW = 0.07;

  // Horizontal center seam
  const isHorizSeam = Math.abs(ny) < seamW;
  // Vertical center seam
  const isVertSeam = Math.abs(nx) < seamW;
  // Curved seams (ellipses)
  const isLeftCurve = Math.abs(Math.pow(nx + 0.45, 2) + Math.pow(ny * 0.9, 2) - 0.75) < seamW * 1.5;
  const isRightCurve = Math.abs(Math.pow(nx - 0.45, 2) + Math.pow(ny * 0.9, 2) - 0.75) < seamW * 1.5;

  if (isHorizSeam || isVertSeam || isLeftCurve || isRightCurve) {
    return [24, 24, 27, 255]; // Black seam
  }

  // Specular reflection highlight on top-left
  const lightDist = Math.hypot(dx + r * 0.35, dy + r * 0.35);
  if (lightDist < r * 0.25) {
    return [254, 215, 170, 255]; // Pale peach highlight
  }

  // Orange basketball gradient
  const shadeFactor = Math.max(0, Math.min(1, (nx * 0.5 + ny * 0.5 + 1) / 2));
  const red = Math.round(234 * (1 - shadeFactor * 0.35) + 30);
  const green = Math.round(88 * (1 - shadeFactor * 0.4) + 15);
  const blue = 12;

  return [red, green, blue, 255];
}

const outDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Generate icons
console.log('Generating PWA icons...');
const icon180 = createPNG(180, 180, (x, y, w, h) => drawBasketballPixel(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), icon180);

const icon192 = createPNG(192, 192, (x, y, w, h) => drawBasketballPixel(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), icon192);

const icon512 = createPNG(512, 512, (x, y, w, h) => drawBasketballPixel(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), icon512);

const iconMaskable = createPNG(512, 512, (x, y, w, h) => drawBasketballPixel(x, y, w, h, true));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), iconMaskable);

console.log('Successfully generated all PWA icons!');
