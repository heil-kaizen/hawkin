export function calculateRankScore(rank: number): number {
  if (rank >= 1 && rank <= 10) return 2;
  if (rank >= 11 && rank <= 50) return 1;
  if (rank >= 51 && rank <= 100) return 0.5;
  return 0;
}

export function calculateMcapSignal(mcap: number): number {
  if (mcap < 1_000_000) return 2;
  if (mcap >= 1_000_000 && mcap <= 5_000_000) return 1;
  if (mcap > 5_000_000) return 0.5;
  return 0;
}

export function calculateWalletScore(tokens: { rank: number; mcap: number }[]): number {
  const tokenCount = tokens.length;
  
  let totalRankScore = 0;
  let totalMcapSignal = 0;
  
  for (const token of tokens) {
    totalRankScore += calculateRankScore(token.rank);
    totalMcapSignal += calculateMcapSignal(token.mcap);
  }
  
  return (tokenCount * 2) + totalRankScore + totalMcapSignal;
}
