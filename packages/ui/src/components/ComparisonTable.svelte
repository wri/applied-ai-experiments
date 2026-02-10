<script lang="ts">
  interface Column {
    id: string;
    label: string;
    highlight?: boolean;
  }

  interface Row {
    label: string;
    values: Record<string, string | number | boolean>;
    format?: (value: any, colId: string) => string;
    sentiment?: (value: any, colId: string) => 'positive' | 'negative' | 'neutral';
  }

  interface Props {
    columns: Column[];
    rows: Row[];
    title?: string;
    class?: string;
  }

  let {
    columns,
    rows,
    title,
    class: className = '',
  }: Props = $props();

  function formatValue(row: Row, colId: string): string {
    const value = row.values[colId];
    if (row.format) {
      return row.format(value, colId);
    }
    if (typeof value === 'boolean') {
      return value ? '✓' : '✗';
    }
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value ?? '-');
  }

  function getSentiment(row: Row, colId: string): 'positive' | 'negative' | 'neutral' {
    const value = row.values[colId];
    if (row.sentiment) {
      return row.sentiment(value, colId);
    }
    if (typeof value === 'boolean') {
      return value ? 'positive' : 'negative';
    }
    return 'neutral';
  }

  const sentimentColors = {
    positive: 'var(--success-text)',
    negative: 'var(--error-text)',
    neutral: 'var(--tx)',
  };
</script>

<div
  class="ui-comparison-table {className}"
  style="
    background: var(--bg-2);
    border: 1px solid var(--ui);
    border-radius: var(--radius-md);
    overflow: hidden;
  "
>
  {#if title}
    <div style="
      padding: 0.75rem 1rem;
      background: var(--bg-3);
      border-bottom: 1px solid var(--ui);
      font-family: var(--font-ui);
      font-weight: 500;
      color: var(--tx);
    ">
      {title}
    </div>
  {/if}

  <div style="overflow-x: auto;">
    <table style="
      width: 100%;
      border-collapse: collapse;
      font-family: var(--font-ui);
      font-size: 0.875rem;
    ">
      <thead>
        <tr>
          <th style="
            padding: 0.75rem 1rem;
            text-align: left;
            background: var(--bg-3);
            color: var(--tx-2);
            font-weight: 500;
            border-bottom: 1px solid var(--ui);
            position: sticky;
            left: 0;
            z-index: 1;
          ">
            <!-- Empty header cell for row labels -->
          </th>
          {#each columns as col}
            <th style="
              padding: 0.75rem 1rem;
              text-align: center;
              background: {col.highlight ? 'oklch(from var(--primary) l c h / 0.1)' : 'var(--bg-3)'};
              color: {col.highlight ? 'var(--primary)' : 'var(--tx-2)'};
              font-weight: 500;
              border-bottom: 1px solid var(--ui);
              {col.highlight ? 'border-left: 2px solid var(--primary); border-right: 2px solid var(--primary);' : ''}
              white-space: nowrap;
            ">
              {col.label}
              {#if col.highlight}
                <span style="
                  display: block;
                  font-size: 0.7rem;
                  font-weight: 400;
                  color: var(--primary);
                  margin-top: 0.125rem;
                ">
                  Recommended
                </span>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as row, rowIndex}
          <tr>
            <td style="
              padding: 0.75rem 1rem;
              background: var(--bg-2);
              color: var(--tx-2);
              font-weight: 500;
              border-bottom: {rowIndex < rows.length - 1 ? '1px solid var(--ui)' : 'none'};
              position: sticky;
              left: 0;
              z-index: 1;
              white-space: nowrap;
            ">
              {row.label}
            </td>
            {#each columns as col}
              {@const sentiment = getSentiment(row, col.id)}
              <td style="
                padding: 0.75rem 1rem;
                text-align: center;
                background: {col.highlight ? 'oklch(from var(--primary) l c h / 0.05)' : 'transparent'};
                color: {sentimentColors[sentiment]};
                border-bottom: {rowIndex < rows.length - 1 ? '1px solid var(--ui)' : 'none'};
                {col.highlight ? 'border-left: 2px solid var(--primary); border-right: 2px solid var(--primary);' : ''}
                font-variant-numeric: tabular-nums;
              ">
                {formatValue(row, col.id)}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
