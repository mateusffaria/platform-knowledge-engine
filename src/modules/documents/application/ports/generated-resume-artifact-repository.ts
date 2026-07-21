import { GeneratedResumeArtifact } from "../../domain/resume-document.js"

export interface GeneratedResumeArtifactRepository {
  findLatestByRenderingIdentity(renderingIdentity: string): Promise<GeneratedResumeArtifact | undefined>
  save(artifact: GeneratedResumeArtifact): Promise<GeneratedResumeArtifact>
}
