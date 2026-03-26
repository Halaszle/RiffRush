import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const port = Number(process.env.PORT ?? 4173);
const rootDirectory = join(process.cwd(), "apps/web/public");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

export function createStaticServer({ publicRoot = rootDirectory } = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePath = normalize(pathname).replace(/^([/\\])+/, "");
    const filePath = resolve(publicRoot, safePath);

    if (!filePath.startsWith(resolve(publicRoot))) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    if (!existsSync(filePath)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const fileStat = await stat(filePath);

    if (fileStat.isDirectory()) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream"
    });

    createReadStream(filePath).pipe(response);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createStaticServer().listen(port, () => {
    console.log(`RiffRush web shell listening on http://127.0.0.1:${port}`);
  });
}
