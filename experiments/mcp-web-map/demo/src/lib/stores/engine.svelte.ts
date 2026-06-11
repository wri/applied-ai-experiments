import { browser } from '$app/environment';
import { getEngine, webmcpEngine, type EngineId, type ToolEngine } from '../mcp/engine';

const STORAGE_KEY = 'mcp-web-map:engine';

// Holds the active tool engine and (for WebMCP) its initialization status,
// so the toggle UI can surface readiness/errors.
class EngineStore {
  current = $state<EngineId>('bridge');
  webmcpReady = $state(false);
  webmcpError = $state<string | null>(null);
  webmcpInfo = $state<Record<string, unknown> | null>(null);

  constructor() {
    if (browser) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'bridge' || saved === 'webmcp') this.current = saved;
    }
  }

  get engine(): ToolEngine {
    return getEngine(this.current);
  }

  async setEngine(id: EngineId): Promise<void> {
    this.current = id;
    if (browser) localStorage.setItem(STORAGE_KEY, id);
    if (id === 'webmcp') await this.initWebMCP();
  }

  async initWebMCP(): Promise<void> {
    const res = await webmcpEngine.init();
    this.webmcpReady = res.ok;
    this.webmcpError = res.ok ? null : res.reason ?? 'WebMCP unavailable';
    this.webmcpInfo = (res.info as Record<string, unknown>) ?? null;
  }
}

export const engineStore = new EngineStore();
