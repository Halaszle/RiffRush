export function decodePcm16Base64(chunkBase64) {
  const raw = Buffer.from(chunkBase64, "base64");
  return decodePcm16Buffer(raw);
}

export function decodePcm16Buffer(raw) {
  const sampleCount = Math.floor(raw.length / 2);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = raw.readInt16LE(index * 2) / 32768;
  }

  return samples;
}
