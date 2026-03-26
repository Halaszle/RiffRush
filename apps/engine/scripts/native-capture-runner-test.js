import assert from "node:assert/strict";
import {
  extractJsonPayloadFromOutput,
  parseJsonOutputLine
} from "../src/audio/native-capture-runner.js";

const mixedDeviceOutput = `
D:\\ProjektyApp\\RiffRush\\apps\\native-capture-bridge\\native-capture-bridge.csproj : warning NU1900: Could not load vulnerability data.
[{"backend":"wavein","deviceId":"wavein:0","deviceNumber":0,"name":"Mic","isDefault":true}]
`;

const parsedDevices = extractJsonPayloadFromOutput(mixedDeviceOutput, "Native device list");
assert.ok(Array.isArray(parsedDevices));
assert.equal(parsedDevices[0].backend, "wavein");
assert.equal(parsedDevices[0].deviceId, "wavein:0");

const mixedPreflightOutput = `
Build started...
{"ok":true,"selectedDevice":{"backend":"wasapi","deviceId":"wasapi:0","deviceNumber":0,"name":"Mic"},"resolved":{"captureProfile":"low-latency","backend":"wasapi","bufferMs":25,"numberOfBuffers":2,"useEventSync":true,"sampleRate":48000,"captureDurationMs":1000}}
`;

const parsedPreflight = extractJsonPayloadFromOutput(
  mixedPreflightOutput,
  "Native capture preflight"
);
assert.equal(parsedPreflight.ok, true);
assert.equal(parsedPreflight.selectedDevice.backend, "wasapi");

assert.equal(
  parseJsonOutputLine(
    "D:\\ProjektyApp\\RiffRush\\apps\\native-capture-bridge\\native-capture-bridge.csproj : warning NU1900: Could not load vulnerability data.",
    "Native capture stream"
  ),
  null
);

const parsedChunk = parseJsonOutputLine(
  '{"type":"chunk","sampleRate":48000,"chunkBase64":"AAAA"}',
  "Native capture stream"
);
assert.equal(parsedChunk.type, "chunk");
assert.equal(parsedChunk.sampleRate, 48000);

assert.throws(
  () => parseJsonOutputLine('{"type":"chunk"', "Native capture stream"),
  /malformed JSON output line/i
);

console.log("Native capture runner test passed.");
