import { readFile } from "node:fs/promises";

const FRAME_SIZE = 2048;

function readAscii(buffer, start, length) {
  return buffer.toString("ascii", start, start + length);
}

function parseWavFile(buffer) {
  if (readAscii(buffer, 0, 4) !== "RIFF" || readAscii(buffer, 8, 4) !== "WAVE") {
    throw new Error("Unsupported WAV container. Expected RIFF/WAVE.");
  }

  let offset = 12;
  let formatChunk = null;
  let dataChunk = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = readAscii(buffer, offset, 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;
    const chunkDataEnd = chunkDataStart + chunkSize;

    if (chunkDataEnd > buffer.length) {
      throw new Error("Corrupted WAV file: chunk exceeds buffer length.");
    }

    if (chunkId === "fmt ") {
      formatChunk = {
        audioFormat: buffer.readUInt16LE(chunkDataStart),
        channelCount: buffer.readUInt16LE(chunkDataStart + 2),
        sampleRate: buffer.readUInt32LE(chunkDataStart + 4),
        bitsPerSample: buffer.readUInt16LE(chunkDataStart + 14)
      };
    }

    if (chunkId === "data") {
      dataChunk = buffer.subarray(chunkDataStart, chunkDataEnd);
    }

    offset = chunkDataEnd + (chunkSize % 2);
  }

  if (!formatChunk || !dataChunk) {
    throw new Error("Incomplete WAV file. Missing fmt or data chunk.");
  }

  if (formatChunk.audioFormat !== 1) {
    throw new Error("Only PCM WAV files are supported.");
  }

  if (formatChunk.bitsPerSample !== 16) {
    throw new Error("Only 16-bit PCM WAV files are supported.");
  }

  const bytesPerSample = formatChunk.bitsPerSample / 8;
  const frameStride = bytesPerSample * formatChunk.channelCount;
  const sampleCount = Math.floor(dataChunk.length / frameStride);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const sampleOffset = index * frameStride;
    const sampleValue = dataChunk.readInt16LE(sampleOffset);
    samples[index] = sampleValue / 32768;
  }

  return {
    sampleRate: formatChunk.sampleRate,
    samples
  };
}

function wait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function createWavFileFrameSource(filePath) {
  const fileBuffer = await readFile(filePath);
  const { sampleRate, samples } = parseWavFile(fileBuffer);
  const frameDelayMs = Math.max(20, Math.round((FRAME_SIZE / sampleRate) * 1000));

  return {
    sampleRate,
    frameSize: FRAME_SIZE,
    async *stream(signal) {
      let sampleOffset = 0;
      let timestampMs = 0;

      while (sampleOffset < samples.length) {
        if (signal.aborted) {
          return;
        }

        await wait(frameDelayMs);

        const frameSamples = new Float32Array(FRAME_SIZE);
        frameSamples.set(samples.subarray(sampleOffset, sampleOffset + FRAME_SIZE));

        yield {
          timestampMs,
          samples: frameSamples
        };

        sampleOffset += FRAME_SIZE;
        timestampMs += frameDelayMs;
      }
    }
  };
}
