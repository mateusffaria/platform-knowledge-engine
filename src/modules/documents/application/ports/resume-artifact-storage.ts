export interface StoredResumeFiles {
  artifactPath: string
  manifestPath: string
}

export interface ResumeArtifactStorage {
  resolveOutputPath(input: { requestedPath?: string; jobDescriptionId: string; language: string; length: string; identity: string; extension: string }): string
  write(input: { outputPath: string; artifact: Uint8Array; manifest: Uint8Array; force: boolean }): Promise<StoredResumeFiles>
  readArtifact(path: string): Promise<Uint8Array | undefined>
  materialize(input: { sourceArtifactPath: string; sourceManifestPath: string; outputPath: string; checksum: string; force: boolean }): Promise<StoredResumeFiles>
  remove(files: StoredResumeFiles): Promise<void>
}
