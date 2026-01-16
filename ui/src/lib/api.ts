/**
 * API Client for the Autonomous Coding UI
 */

import type {
  ProjectSummary,
  ProjectDetail,
  ProjectPrompts,
  FeatureListResponse,
  Feature,
  FeatureCreate,
  AgentStatusResponse,
  AgentActionResponse,
  SetupStatus,
  ApiKeyResponse,
  Settings,
  SettingsUpdate,
  DirectoryListResponse,
  PathValidationResponse,
  AssistantConversation,
  AssistantConversationDetail,
  ProjectSettings,
  ProjectSettingsUpdate,
  Idea,
  IdeaCategory,
  IdeaCategoryInfo,
  IdeationPrompt,
  GenerateIdeasResponse,
} from './types'

const API_BASE = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// Projects API
// ============================================================================

export async function listProjects(): Promise<ProjectSummary[]> {
  return fetchJSON('/projects')
}

export async function createProject(
  name: string,
  path: string,
  specMethod: 'claude' | 'manual' = 'manual'
): Promise<ProjectSummary> {
  return fetchJSON('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, path, spec_method: specMethod }),
  })
}

export async function getProject(name: string): Promise<ProjectDetail> {
  return fetchJSON(`/projects/${encodeURIComponent(name)}`)
}

export async function deleteProject(name: string): Promise<void> {
  await fetchJSON(`/projects/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

export async function getProjectPrompts(name: string): Promise<ProjectPrompts> {
  return fetchJSON(`/projects/${encodeURIComponent(name)}/prompts`)
}

export async function updateProjectPrompts(
  name: string,
  prompts: Partial<ProjectPrompts>
): Promise<void> {
  await fetchJSON(`/projects/${encodeURIComponent(name)}/prompts`, {
    method: 'PUT',
    body: JSON.stringify(prompts),
  })
}

// ============================================================================
// Features API
// ============================================================================

export async function listFeatures(projectName: string): Promise<FeatureListResponse> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/features`)
}

export async function createFeature(projectName: string, feature: FeatureCreate): Promise<Feature> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/features`, {
    method: 'POST',
    body: JSON.stringify(feature),
  })
}

export async function getFeature(projectName: string, featureId: number): Promise<Feature> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/features/${featureId}`)
}

export async function deleteFeature(projectName: string, featureId: number): Promise<void> {
  await fetchJSON(`/projects/${encodeURIComponent(projectName)}/features/${featureId}`, {
    method: 'DELETE',
  })
}

export async function skipFeature(projectName: string, featureId: number): Promise<void> {
  await fetchJSON(`/projects/${encodeURIComponent(projectName)}/features/${featureId}/skip`, {
    method: 'PATCH',
  })
}

// ============================================================================
// Agent API
// ============================================================================

export async function getAgentStatus(projectName: string): Promise<AgentStatusResponse> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/agent/status`)
}

export async function startAgent(
  projectName: string,
  yoloMode: boolean = false
): Promise<AgentActionResponse> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/agent/start`, {
    method: 'POST',
    body: JSON.stringify({ yolo_mode: yoloMode }),
  })
}

export async function stopAgent(projectName: string): Promise<AgentActionResponse> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/agent/stop`, {
    method: 'POST',
  })
}

export async function pauseAgent(projectName: string): Promise<AgentActionResponse> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/agent/pause`, {
    method: 'POST',
  })
}

export async function resumeAgent(projectName: string): Promise<AgentActionResponse> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/agent/resume`, {
    method: 'POST',
  })
}

// ============================================================================
// Rate Limit API
// ============================================================================

import type { RateLimitStatus } from './types'

export async function getRateLimitStatus(projectName: string): Promise<RateLimitStatus> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/agent/rate-limit`)
}

export async function cancelAutoResume(projectName: string): Promise<AgentActionResponse> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/agent/rate-limit/cancel-resume`, {
    method: 'POST',
  })
}

export async function clearRateLimit(projectName: string): Promise<AgentActionResponse> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/agent/rate-limit/clear`, {
    method: 'POST',
  })
}

// ============================================================================
// Spec Creation API
// ============================================================================

export interface SpecFileStatus {
  exists: boolean
  status: 'complete' | 'in_progress' | 'not_started' | 'error' | 'unknown'
  feature_count: number | null
  timestamp: string | null
  files_written: string[]
}

export async function getSpecStatus(projectName: string): Promise<SpecFileStatus> {
  return fetchJSON(`/spec/status/${encodeURIComponent(projectName)}`)
}

// ============================================================================
// Setup API
// ============================================================================

export async function getSetupStatus(): Promise<SetupStatus> {
  return fetchJSON('/setup/status')
}

export async function healthCheck(): Promise<{ status: string }> {
  return fetchJSON('/health')
}

export async function getApiKeyStatus(): Promise<ApiKeyResponse> {
  return fetchJSON('/setup/api-key')
}

export async function saveApiKey(apiKey: string): Promise<ApiKeyResponse> {
  return fetchJSON('/setup/api-key', {
    method: 'POST',
    body: JSON.stringify({ api_key: apiKey }),
  })
}

// ============================================================================
// Settings API
// ============================================================================

export async function getSettings(): Promise<Settings> {
  return fetchJSON('/settings')
}

export async function updateSettings(settings: SettingsUpdate): Promise<Settings> {
  return fetchJSON('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

// ============================================================================
// Project Settings API (per-project model configuration)
// ============================================================================

export async function getProjectSettings(projectName: string): Promise<ProjectSettings> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/settings`)
}

export async function updateProjectSettings(
  projectName: string,
  settings: ProjectSettingsUpdate
): Promise<ProjectSettings> {
  return fetchJSON(`/projects/${encodeURIComponent(projectName)}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

// ============================================================================
// Filesystem API
// ============================================================================

export async function listDirectory(path?: string): Promise<DirectoryListResponse> {
  const params = path ? `?path=${encodeURIComponent(path)}` : ''
  return fetchJSON(`/filesystem/list${params}`)
}

export async function createDirectory(fullPath: string): Promise<{ success: boolean; path: string }> {
  // Backend expects { parent_path, name }, not { path }
  // Split the full path into parent directory and folder name

  // Remove trailing slash if present
  const normalizedPath = fullPath.endsWith('/') ? fullPath.slice(0, -1) : fullPath

  // Find the last path separator
  const lastSlash = normalizedPath.lastIndexOf('/')

  let parentPath: string
  let name: string

  // Handle Windows drive root (e.g., "C:/newfolder")
  if (lastSlash === 2 && /^[A-Za-z]:/.test(normalizedPath)) {
    // Path like "C:/newfolder" - parent is "C:/"
    parentPath = normalizedPath.substring(0, 3) // "C:/"
    name = normalizedPath.substring(3)
  } else if (lastSlash > 0) {
    parentPath = normalizedPath.substring(0, lastSlash)
    name = normalizedPath.substring(lastSlash + 1)
  } else if (lastSlash === 0) {
    // Unix root path like "/newfolder"
    parentPath = '/'
    name = normalizedPath.substring(1)
  } else {
    // No slash - invalid path
    throw new Error('Invalid path: must be an absolute path')
  }

  if (!name) {
    throw new Error('Invalid path: directory name is empty')
  }

  return fetchJSON('/filesystem/create-directory', {
    method: 'POST',
    body: JSON.stringify({ parent_path: parentPath, name }),
  })
}

export async function validatePath(path: string): Promise<PathValidationResponse> {
  return fetchJSON('/filesystem/validate', {
    method: 'POST',
    body: JSON.stringify({ path }),
  })
}

// ============================================================================
// Assistant Chat API
// ============================================================================

export async function listAssistantConversations(
  projectName: string
): Promise<AssistantConversation[]> {
  return fetchJSON(`/assistant/conversations/${encodeURIComponent(projectName)}`)
}

export async function getAssistantConversation(
  projectName: string,
  conversationId: number
): Promise<AssistantConversationDetail> {
  return fetchJSON(
    `/assistant/conversations/${encodeURIComponent(projectName)}/${conversationId}`
  )
}

export async function createAssistantConversation(
  projectName: string
): Promise<AssistantConversation> {
  return fetchJSON(`/assistant/conversations/${encodeURIComponent(projectName)}`, {
    method: 'POST',
  })
}

export async function deleteAssistantConversation(
  projectName: string,
  conversationId: number
): Promise<void> {
  await fetchJSON(
    `/assistant/conversations/${encodeURIComponent(projectName)}/${conversationId}`,
    { method: 'DELETE' }
  )
}

// ============================================================================
// Ideation & Backlog API
// ============================================================================

export async function getIdeationCategories(): Promise<IdeaCategoryInfo[]> {
  return fetchJSON('/ideation/categories')
}

export async function getIdeationPrompts(category: IdeaCategory): Promise<IdeationPrompt[]> {
  return fetchJSON(`/ideation/prompts/${category}`)
}

export async function generateIdeas(
  projectName: string,
  category: IdeaCategory,
  promptId: string,
  count: number = 10
): Promise<GenerateIdeasResponse> {
  return fetchJSON(`/ideation/${encodeURIComponent(projectName)}/generate`, {
    method: 'POST',
    body: JSON.stringify({ category, prompt_id: promptId, count }),
  })
}

export async function getIdeas(projectName: string): Promise<Idea[]> {
  return fetchJSON(`/ideation/${encodeURIComponent(projectName)}/ideas`)
}

export async function createIdea(
  projectName: string,
  idea: Omit<Idea, 'id' | 'createdAt' | 'promoted'>
): Promise<Idea> {
  return fetchJSON(`/ideation/${encodeURIComponent(projectName)}/ideas`, {
    method: 'POST',
    body: JSON.stringify(idea),
  })
}

export async function deleteIdea(projectName: string, ideaId: string): Promise<void> {
  await fetchJSON(`/ideation/${encodeURIComponent(projectName)}/ideas/${ideaId}`, {
    method: 'DELETE',
  })
}

export async function promoteIdea(projectName: string, ideaId: string): Promise<Feature> {
  return fetchJSON(`/ideation/${encodeURIComponent(projectName)}/ideas/${ideaId}/promote`, {
    method: 'POST',
  })
}

// ============================================================================
// File Content API (for Spec Editor)
// ============================================================================

export async function loadFile(projectName: string, relativePath: string): Promise<string> {
  const response = await fetch(
    `${API_BASE}/filesystem/file?project=${encodeURIComponent(projectName)}&path=${encodeURIComponent(relativePath)}`
  )
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }
  return response.text()
}

export async function saveFile(
  projectName: string,
  relativePath: string,
  content: string
): Promise<void> {
  await fetchJSON('/filesystem/file', {
    method: 'POST',
    body: JSON.stringify({ project: projectName, path: relativePath, content }),
  })
}
