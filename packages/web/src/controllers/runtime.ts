import type { RuntimeModelCatalog, RuntimeTool } from '@melody-sync/types'
import * as api from '@/api/client'

const modelCatalogCache = new Map<string, RuntimeModelCatalog>()
let runtimeToolsCache: RuntimeTool[] | null = null

export async function getRuntimeTools(): Promise<RuntimeTool[]> {
  if (runtimeToolsCache) return runtimeToolsCache

  const result = await api.getRuntimeTools()
  if (!result.ok) throw new Error(result.error)
  runtimeToolsCache = result.data
  return result.data
}

export async function getRuntimeModelCatalog(tool: string): Promise<RuntimeModelCatalog> {
  const cacheKey = tool.trim()
  if (modelCatalogCache.has(cacheKey)) {
    return modelCatalogCache.get(cacheKey)!
  }

  const result = await api.getRuntimeModelCatalog(cacheKey)
  if (!result.ok) throw new Error(result.error)
  modelCatalogCache.set(cacheKey, result.data)
  return result.data
}
