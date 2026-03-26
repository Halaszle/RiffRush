const OPCODE_TEXT = 0x1;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

function buildFrame(opcode, payloadBuffer) {
  const payloadLength = payloadBuffer.length;
  let headerLength = 2;

  if (payloadLength >= 126 && payloadLength < 65536) {
    headerLength += 2;
  } else if (payloadLength >= 65536) {
    headerLength += 8;
  }

  const frame = Buffer.alloc(headerLength + payloadLength);
  frame[0] = 0x80 | opcode;

  if (payloadLength < 126) {
    frame[1] = payloadLength;
    payloadBuffer.copy(frame, 2);
    return frame;
  }

  if (payloadLength < 65536) {
    frame[1] = 126;
    frame.writeUInt16BE(payloadLength, 2);
    payloadBuffer.copy(frame, 4);
    return frame;
  }

  frame[1] = 127;
  frame.writeBigUInt64BE(BigInt(payloadLength), 2);
  payloadBuffer.copy(frame, 10);
  return frame;
}

export function encodeTextFrame(text) {
  return buildFrame(OPCODE_TEXT, Buffer.from(text, "utf8"));
}

export function encodeCloseFrame() {
  return buildFrame(OPCODE_CLOSE, Buffer.alloc(0));
}

export function encodePongFrame(payload = Buffer.alloc(0)) {
  return buildFrame(OPCODE_PONG, payload);
}

export function decodeFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const firstByte = buffer[offset];
    const secondByte = buffer[offset + 1];
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) !== 0;

    let payloadLength = secondByte & 0x7f;
    let currentOffset = offset + 2;

    if (payloadLength === 126) {
      if (currentOffset + 2 > buffer.length) {
        break;
      }

      payloadLength = buffer.readUInt16BE(currentOffset);
      currentOffset += 2;
    } else if (payloadLength === 127) {
      if (currentOffset + 8 > buffer.length) {
        break;
      }

      payloadLength = Number(buffer.readBigUInt64BE(currentOffset));
      currentOffset += 8;
    }

    const maskLength = masked ? 4 : 0;

    if (currentOffset + maskLength + payloadLength > buffer.length) {
      break;
    }

    const mask = masked ? buffer.subarray(currentOffset, currentOffset + 4) : null;
    currentOffset += maskLength;

    const payload = Buffer.from(buffer.subarray(currentOffset, currentOffset + payloadLength));

    if (mask) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] ^= mask[index % 4];
      }
    }

    frames.push({
      opcode,
      payload
    });

    offset = currentOffset + payloadLength;
  }

  return {
    frames,
    remainingBuffer: buffer.subarray(offset)
  };
}

export const WebSocketOpcode = {
  CLOSE: OPCODE_CLOSE,
  PING: OPCODE_PING,
  PONG: OPCODE_PONG,
  TEXT: OPCODE_TEXT
};
