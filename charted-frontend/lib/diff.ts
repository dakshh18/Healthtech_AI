export type Seg = { type: "same" | "add" | "del"; text: string };

function push(segs: Seg[], type: Seg["type"], text: string) {
  const last = segs[segs.length - 1];
  if (last && last.type === type) last.text += text;
  else segs.push({ type, text });
}

// Word-level diff via LCS. Whitespace tokens are kept so spacing is preserved.
export function wordDiff(a: string, b: string): Seg[] {
  const A = a.split(/(\s+)/);
  const B = b.split(/(\s+)/);
  const m = A.length;
  const n = B.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segs: Seg[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (A[i] === B[j]) {
      push(segs, "same", A[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push(segs, "del", A[i++]);
    } else {
      push(segs, "add", B[j++]);
    }
  }
  while (i < m) push(segs, "del", A[i++]);
  while (j < n) push(segs, "add", B[j++]);
  return segs;
}

export function hasChange(segs: Seg[]): boolean {
  return segs.some((s) => s.type !== "same");
}
