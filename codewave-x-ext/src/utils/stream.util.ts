import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import tarfs from "tar-fs";

export const createTarGzStream = (root: string, files: string[]) => {
  const pack = tarfs.pack(root, {
    entries: files,
    map: (header: any) => {
      header.mode = header.type === "directory" ? 0o755 : 0o644;
      return header;
    },
  });
  const gzip = zlib.createGzip({ level: 6 });
  return pack.pipe(gzip);
};
