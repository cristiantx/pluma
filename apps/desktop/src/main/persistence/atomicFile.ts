import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm } from "node:fs/promises";
import path from "node:path";

export async function writeTextFileAtomic(
  filePath: string,
  contents: string
): Promise<void> {
  const directoryPath = path.dirname(filePath);
  const tempPath = path.join(
    directoryPath,
    `.${path.basename(filePath)}.pluma-${randomUUID()}.tmp`
  );

  await mkdir(directoryPath, { recursive: true });

  try {
    const handle = await open(tempPath, "wx");

    try {
      await handle.writeFile(contents, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    await rename(tempPath, filePath);
  } finally {
    await rm(tempPath, { force: true });
  }
}
