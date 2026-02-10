/**
 * LCS-based diff algorithm for text comparison
 */

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  stats: {
    added: number;
    removed: number;
    unchanged: number;
  };
}

/**
 * Compute the Longest Common Subsequence (LCS) matrix
 */
function computeLCS(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Backtrack through the LCS matrix to produce diff lines
 */
function backtrack(
  dp: number[][],
  oldLines: string[],
  newLines: string[],
): DiffLine[] {
  let i = oldLines.length;
  let j = newLines.length;

  // Collect operations in reverse order
  const operations: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // Lines are the same
      operations.push({
        type: 'unchanged',
        content: oldLines[i - 1],
        oldLineNumber: i,
        newLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      // Line was added
      operations.push({
        type: 'added',
        content: newLines[j - 1],
        newLineNumber: j,
      });
      j--;
    } else if (i > 0) {
      // Line was removed
      operations.push({
        type: 'removed',
        content: oldLines[i - 1],
        oldLineNumber: i,
      });
      i--;
    }
  }

  // Reverse to get correct order
  return operations.reverse();
}

/**
 * Compute diff between two text strings
 */
export function computeDiff(oldText: string, newText: string): DiffResult {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const dp = computeLCS(oldLines, newLines);
  const lines = backtrack(dp, oldLines, newLines);

  const stats = {
    added: lines.filter((l) => l.type === 'added').length,
    removed: lines.filter((l) => l.type === 'removed').length,
    unchanged: lines.filter((l) => l.type === 'unchanged').length,
  };

  return { lines, stats };
}

/**
 * Generate unified diff format
 */
export function generateUnifiedDiff(result: DiffResult): string {
  const output: string[] = [];

  for (const line of result.lines) {
    const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
    output.push(prefix + line.content);
  }

  return output.join('\n');
}
