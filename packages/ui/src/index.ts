// =============================================================================
// @wri-datalab/ui - Svelte Component Library with Prototype Design System
// =============================================================================
//
// Usage:
//   import { Button, Panel, ThemeSwitcher, ApiKeyManager } from '@wri-datalab/ui';
//   import '@wri-datalab/ui/styles';
//
// =============================================================================

// Core UI Components
export { default as Button } from './components/Button.svelte';
export { default as Card } from './components/Card.svelte';
export { default as Panel } from './components/Panel.svelte';
export { default as Badge } from './components/Badge.svelte';
export { default as Alert } from './components/Alert.svelte';
export { default as Input } from './components/Input.svelte';
export { default as Select } from './components/Select.svelte';
export { default as Spinner } from './components/Spinner.svelte';
export { default as ThemeSwitcher } from './components/ThemeSwitcher.svelte';
export { default as StepIndicator } from './components/StepIndicator.svelte';
export { default as EmptyState } from './components/EmptyState.svelte';
export { default as SearchInput } from './components/SearchInput.svelte';
export { default as Tabs } from './components/Tabs.svelte';

// New UI Components (Tier 1 - Foundational)
export { default as Toggle } from './components/Toggle.svelte';
export { default as Textarea } from './components/Textarea.svelte';
export { default as Slider } from './components/Slider.svelte';
export { default as CopyButton } from './components/CopyButton.svelte';
export { default as Skeleton } from './components/Skeleton.svelte';

// New UI Components (Tier 2 - External Dependencies)
export { default as CodeBlock } from './components/CodeBlock.svelte';
export { default as Markdown } from './components/Markdown.svelte';

// New UI Components (Tier 3 - Composite/Complex)
export { default as Modal } from './components/Modal.svelte';
export { default as JsonViewer } from './components/JsonViewer.svelte';
export { default as DiffView } from './components/DiffView.svelte';

// Toast System
export { Toast, ToastContainer, toastStore, toast } from './components/toast';
export type { ToastType, ToastOptions, ToastStore } from './components/toast';

// New UI Components (Tier 4 - AI-Specific)
export { default as TokenCounter } from './components/TokenCounter.svelte';
export { default as StreamingText } from './components/StreamingText.svelte';
export { default as StreamingMarkdown } from './components/StreamingMarkdown.svelte';
export { default as ChatMessage } from './components/ChatMessage.svelte';
export { default as ThinkingSummary } from './components/ThinkingSummary.svelte';
export { default as LatencyBadge } from './components/LatencyBadge.svelte';
export { default as ComparisonTable } from './components/ComparisonTable.svelte';
export { default as CostDisplay } from './components/CostDisplay.svelte';

// Utilities
export { computeDiff, generateUnifiedDiff, type DiffLine, type DiffResult } from './utils/diff';
export {
  formatTokens,
  formatLatency,
  formatBytes,
  formatPercent,
  formatRelativeTime,
  formatTimestamp,
} from './utils/formatters';
export { getHighlighter, highlightCode, isHighlighterReady } from './utils/highlighter';

// BYOK Integration Components
export { default as ApiKeyManager } from './byok/ApiKeyManager.svelte';
export { default as ProviderSelector } from './byok/ProviderSelector.svelte';
export { default as ModelSelector } from './byok/ModelSelector.svelte';

// BYOK Types
export type {
  ModelConfig,
  ProviderConfig,
  ModelSelectorConfig,
} from './byok/types';

// User Settings Components
export { default as UserSettings } from './components/user-settings/UserSettings.svelte';
export { default as UserSettingsTrigger } from './components/user-settings/UserSettingsTrigger.svelte';
export { default as UserSettingsPopover } from './components/user-settings/UserSettingsPopover.svelte';

// Demo Layout Components
export { default as DemoHeader } from './components/DemoHeader.svelte';
export { default as DemoFooter } from './components/DemoFooter.svelte';
export { default as DemoLayout } from './components/DemoLayout.svelte';

// Re-export BYOK stores and utilities for convenience
export {
  createBYOKStores,
  setBYOKContext,
  getBYOKContext,
  createProviderReadyStore,
  createReadyProvidersStore,
  initializeBYOK,
  type BYOKStores,
  type ChatStreamStore,
} from '@byo-keys/svelte';
