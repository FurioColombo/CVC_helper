import { lstatSync, realpathSync } from "node:fs"
import {
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { randomUUID } from "node:crypto"
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path"

export function resolveBenchmarkOutputPath(
  candidatePath,
  fileSystem = { lstatSync, realpathSync },
) {
  let metadata
  try {
    metadata = fileSystem.lstatSync(candidatePath)
  } catch (error) {
    if (error?.code === "ENOENT") return candidatePath
    throw error
  }

  if (metadata.isSymbolicLink()) {
    throw new Error("Refusing to write benchmark results through a symlink")
  }
  if (metadata.nlink > 1) {
    throw new Error("Refusing to write benchmark results through a hard link")
  }
  return fileSystem.realpathSync(candidatePath)
}

export function isPathWithinDirectory(targetPath, directoryPath) {
  const pathFromDirectory = relative(
    resolve(directoryPath),
    resolve(targetPath),
  )
  return (
    pathFromDirectory === "" ||
    (!isAbsolute(pathFromDirectory) &&
      pathFromDirectory !== ".." &&
      !pathFromDirectory.startsWith(`..${sep}`))
  )
}

export function toGitPathspec(pathFromRepositoryRoot) {
  return pathFromRepositoryRoot.replace(/[\\/]/g, "/")
}

export function isAllowedBenchmarkResultPath(
  resultsPath,
  repositoryRoot,
  isIgnored,
  isTracked = false,
) {
  return (
    !isPathWithinDirectory(resultsPath, repositoryRoot) ||
    (!isTracked && isIgnored)
  )
}

export function writeBenchmarkResultsSafely(
  expectedPath,
  content,
  revalidatePath,
  fileSystem = {
    closeSync,
    fsyncSync,
    openSync,
    renameSync,
    rmSync,
    writeFileSync,
  },
) {
  const temporaryPath = join(
    dirname(expectedPath),
    `.${basename(expectedPath)}.${randomUUID()}.tmp`,
  )
  let fileDescriptor

  try {
    if (revalidatePath() !== expectedPath) {
      throw new Error("Benchmark results path changed during the run")
    }
    fileDescriptor = fileSystem.openSync(temporaryPath, "wx", 0o600)
    fileSystem.writeFileSync(fileDescriptor, content, "utf8")
    fileSystem.fsyncSync(fileDescriptor)
    fileSystem.closeSync(fileDescriptor)
    fileDescriptor = undefined

    // Recheck immediately before installing the completed file. The rename is
    // atomic and replaces a newly introduced symlink instead of following it.
    if (revalidatePath() !== expectedPath) {
      throw new Error("Benchmark results path changed during the run")
    }
    fileSystem.renameSync(temporaryPath, expectedPath)
  } finally {
    if (fileDescriptor !== undefined) fileSystem.closeSync(fileDescriptor)
    fileSystem.rmSync(temporaryPath, { force: true })
  }
}
