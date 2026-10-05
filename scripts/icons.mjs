import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const header = Buffer.alloc(4); header.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([header, name, data, crc]);
}
function icon(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = (x + 0.5) / size, ny = (y + 0.5) / size;
    const r = Math.hypot(nx - 0.5, ny - 0.5);
    const alpha = Math.min(1, Math.max(0, (0.4 - r) * size));
    const eye = (Math.abs(nx - 0.41) < 0.026 || Math.abs(nx - 0.59) < 0.026) && Math.abs(ny - 0.48) < 0.062;
    const offset = y * (size * 4 + 1) + 1 + x * 4;
    const color = eye ? [40, 62, 66] : [Math.round(223 - r * 60), Math.round(249 - r * 45), Math.round(228 + r * 28)];
    color.forEach((value, index) => { pixels[offset + index] = value; }); pixels[offset + 3] = Math.round(alpha * 255);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
export async function generateIcons() {
  const path = 'apps/desktop/assets'; await mkdir(path, { recursive: true });
  const png = icon(256), tray = icon(32);
  const icoHeader = Buffer.alloc(22); icoHeader.writeUInt16LE(1, 2); icoHeader.writeUInt16LE(1, 4);
  icoHeader.writeUInt16LE(1, 10); icoHeader.writeUInt16LE(32, 12); icoHeader.writeUInt32LE(png.length, 14); icoHeader.writeUInt32LE(22, 18);
  await Promise.all([writeFile(`${path}/icon.png`, png), writeFile(`${path}/tray.png`, tray), writeFile(`${path}/icon.ico`, Buffer.concat([icoHeader, png]))]);
}
