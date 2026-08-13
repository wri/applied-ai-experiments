<script lang="ts">
  import { Panel, Button, EmptyState, Badge, formatRelativeTime, toast } from '@wri-datalab/ui';
  import type { RunHistory } from './run-history';
  import type { RunRecord } from '../types';
  import { recordToReplaySession } from '../replay/record';
  import { downloadJson } from '../export/download';

  interface Props {
    history: RunHistory;
    /** Called when the user restores a past run's config */
    onrestore?: (record: RunRecord) => void;
    collapsed?: boolean;
  }

  let { history, onrestore, collapsed = $bindable(true) }: Props = $props();

  let records = $state<RunRecord[]>([]);

  export async function refresh(): Promise<void> {
    records = await history.list({ limit: 50 });
  }

  $effect(() => {
    void refresh();
  });

  async function handleDuplicate(id: string) {
    await history.duplicate(id);
    await refresh();
    toast.success('Run duplicated');
  }

  async function handleRemove(id: string) {
    await history.remove(id);
    await refresh();
  }

  function handleExportReplay(record: RunRecord) {
    const { session, redactions } = recordToReplaySession(record, { title: record.label });
    downloadJson(session, `${record.experiment}-replay.json`);
    if (redactions > 0) {
      toast.error(
        `Exported with ${redactions} secret(s) redacted — review the file before committing.`
      );
    } else {
      toast.success('Replay session exported — review, then commit to src/lib/replay/');
    }
  }

  async function handleClear() {
    await history.clear();
    await refresh();
    toast.success('History cleared');
  }
</script>

<Panel title="Run history" collapsible bind:collapsed>
  {#snippet actions()}
    <Button variant="ghost" size="sm" onclick={() => history.exportJson()}>Export JSON</Button>
    <Button variant="ghost" size="sm" onclick={handleClear}>Clear all</Button>
  {/snippet}

  {#if !history.available}
    <EmptyState title="History unavailable" description="IndexedDB is not available in this browser." />
  {:else if records.length === 0}
    <EmptyState
      title="No runs yet"
      description="Runs are stored locally in your browser (IndexedDB) — nothing is sent to a server."
    />
  {:else}
    <ul class="llm-lab-history">
      {#each records as record (record.id)}
        <li class="llm-lab-history__row">
          <div class="llm-lab-history__info">
            <span class="llm-lab-history__label">{record.label ?? 'Run'}</span>
            <Badge>{record.responses.length} response{record.responses.length === 1 ? '' : 's'}</Badge>
            <span class="llm-lab-history__time">{formatRelativeTime(new Date(record.createdAt))}</span>
          </div>
          <div class="llm-lab-history__actions">
            {#if onrestore}
              <Button variant="secondary" size="sm" onclick={() => onrestore(record)}>Restore</Button>
            {/if}
            <Button variant="ghost" size="sm" onclick={() => handleDuplicate(record.id)}>Duplicate</Button>
            <Button variant="ghost" size="sm" onclick={() => handleExportReplay(record)}>Export replay</Button>
            <Button variant="ghost" size="sm" onclick={() => handleRemove(record.id)}>Delete</Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</Panel>

<style>
  .llm-lab-history {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .llm-lab-history__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border, #333);
    flex-wrap: wrap;
  }

  .llm-lab-history__row:last-child {
    border-bottom: none;
  }

  .llm-lab-history__info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .llm-lab-history__label {
    font-size: 0.85rem;
    font-weight: 500;
  }

  .llm-lab-history__time {
    font-size: 0.75rem;
    color: var(--text-secondary, #888);
  }

  .llm-lab-history__actions {
    display: flex;
    gap: 0.25rem;
  }
</style>
