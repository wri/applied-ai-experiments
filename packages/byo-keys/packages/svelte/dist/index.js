// src/stores.ts
import { writable, derived, readable, get } from "svelte/store";
import { getContext, setContext } from "svelte";
function createBYOKStores(client) {
  const stateStore = writable(client.getState());
  client.subscribe((event) => {
    if (event.type === "state:changed") {
      stateStore.set(event.state);
    }
  });
  const keys = derived(stateStore, ($state) => $state.keys);
  const initialized = derived(stateStore, ($state) => $state.initialized);
  const providers = readable(client.listProviders(), () => {
  });
  const models = derived(stateStore, ($state) => {
    const result = {};
    for (const [id, status] of Object.entries($state.keys)) {
      result[id] = status.models ?? [];
    }
    return result;
  });
  const selectedModels = derived(stateStore, ($state) => {
    const result = {};
    for (const [id, status] of Object.entries($state.keys)) {
      result[id] = status.selectedModel;
    }
    return result;
  });
  async function setKey(providerId, key, metadata) {
    return client.setKey(providerId, key, metadata);
  }
  async function removeKey(providerId) {
    return client.removeKey(providerId);
  }
  function hasKey(providerId) {
    return get(keys)[providerId]?.hasKey ?? false;
  }
  async function chat(providerId, request) {
    return client.chat(providerId, request);
  }
  function chatStream(providerId, request) {
    return client.chatStream(providerId, request);
  }
  function selectModel(providerId, modelId) {
    client.selectModel(providerId, modelId);
  }
  async function refreshModels(providerId) {
    return client.refreshModels(providerId);
  }
  function createChatStream(providerId, request) {
    const content = writable("");
    const thinking = writable("");
    const streaming = writable(false);
    const isThinking = writable(false);
    const error = writable(null);
    const usage = writable(null);
    let abortController = null;
    async function start() {
      content.set("");
      thinking.set("");
      error.set(null);
      usage.set(null);
      streaming.set(true);
      isThinking.set(false);
      abortController = new AbortController();
      try {
        for await (const chunk of client.chatStream(providerId, request)) {
          if (abortController.signal.aborted) break;
          switch (chunk.type) {
            case "delta":
              content.update((c) => c + chunk.content);
              break;
            case "thinking_delta":
              isThinking.set(true);
              thinking.update((t) => t + chunk.thinking);
              break;
            case "thinking_complete":
              isThinking.set(false);
              break;
            case "usage":
              usage.set({
                inputTokens: chunk.usage.inputTokens,
                outputTokens: chunk.usage.outputTokens,
                thinkingTokens: chunk.usage.thinkingTokens
              });
              break;
            case "error":
              error.set(new Error(chunk.error.message));
              break;
          }
        }
      } catch (e) {
        if (!abortController.signal.aborted) {
          error.set(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        streaming.set(false);
        isThinking.set(false);
        abortController = null;
      }
    }
    function abort() {
      abortController?.abort();
    }
    return {
      content: { subscribe: content.subscribe },
      thinking: { subscribe: thinking.subscribe },
      streaming: { subscribe: streaming.subscribe },
      isThinking: { subscribe: isThinking.subscribe },
      error: { subscribe: error.subscribe },
      usage: { subscribe: usage.subscribe },
      start,
      abort
    };
  }
  return {
    keys: { subscribe: keys.subscribe },
    providers: { subscribe: providers.subscribe },
    initialized: { subscribe: initialized.subscribe },
    state: { subscribe: stateStore.subscribe },
    models: { subscribe: models.subscribe },
    selectedModels: { subscribe: selectedModels.subscribe },
    setKey,
    removeKey,
    hasKey,
    getClient: () => client,
    initialize: () => client.initialize(),
    chat,
    chatStream,
    createChatStream,
    selectModel,
    refreshModels
  };
}
var BYOK_CONTEXT_KEY = /* @__PURE__ */ Symbol("byok-llm");
function setBYOKContext(stores) {
  setContext(BYOK_CONTEXT_KEY, stores);
}
function getBYOKContext() {
  const stores = getContext(BYOK_CONTEXT_KEY);
  if (!stores) {
    throw new Error(
      "BYOK context not found. Make sure to call setBYOKContext in a parent component."
    );
  }
  return stores;
}
function createProviderReadyStore(stores, providerId) {
  return derived(stores.keys, ($keys) => {
    const status = $keys[providerId];
    return status?.hasKey === true && status?.isValid === true;
  });
}
function createReadyProvidersStore(stores) {
  return derived([stores.keys, stores.providers], ([$keys, $providers]) => {
    return $providers.filter((p) => {
      const status = $keys[p.config.id];
      return !p.config.requiresKey || status?.hasKey && status?.isValid;
    });
  });
}
async function initializeBYOK(stores) {
  if (typeof window === "undefined") {
    console.warn("initializeBYOK called on server, skipping");
    return;
  }
  await stores.initialize();
}
export {
  createBYOKStores,
  createProviderReadyStore,
  createReadyProvidersStore,
  getBYOKContext,
  initializeBYOK,
  setBYOKContext
};
