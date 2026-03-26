import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function cloneValue(value) {
  return structuredClone(value);
}

export class JsonFileStore {
  #filePath;
  #defaultValue;

  constructor({ filePath, defaultValue }) {
    this.#filePath = filePath;
    this.#defaultValue = cloneValue(defaultValue);
  }

  read() {
    try {
      const fileContent = readFileSync(this.#filePath, "utf8");
      return JSON.parse(fileContent);
    } catch (error) {
      if (error.code === "ENOENT") {
        return cloneValue(this.#defaultValue);
      }

      throw error;
    }
  }

  write(nextValue) {
    mkdirSync(dirname(this.#filePath), { recursive: true });
    const temporaryPath = `${this.#filePath}.tmp`;

    try {
      writeFileSync(temporaryPath, `${JSON.stringify(nextValue, null, 2)}\n`, "utf8");
      renameSync(temporaryPath, this.#filePath);
    } catch (error) {
      rmSync(temporaryPath, { force: true });
      throw error;
    }
  }
}
