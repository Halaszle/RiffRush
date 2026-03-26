import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function buildWavBuffer(pcmBuffer, sampleRate) {
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);

  return buffer;
}

export function createWavArtifactWriter({ sessionId, sampleRate }) {
  const pcmChunks = [];

  return {
    appendPcmChunk(chunkBuffer) {
      pcmChunks.push(Buffer.from(chunkBuffer));
    },

    async finalize() {
      const outputPath = resolve(`./tmp/session-artifacts/${sessionId}.wav`);
      const pcmBuffer = Buffer.concat(pcmChunks);

      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, buildWavBuffer(pcmBuffer, sampleRate));

      return outputPath;
    }
  };
}
