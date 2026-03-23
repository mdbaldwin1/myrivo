export function summarizePendingQueueLatency(createdAtValues: string[], nowMs = Date.now()) {
  const ages = createdAtValues.map((value) => Math.max(0, (nowMs - new Date(value).getTime()) / (60 * 60 * 1000)));
  const avg = ages.length > 0 ? ages.reduce((sum, hours) => sum + hours, 0) / ages.length : 0;
  const oldest = ages.length > 0 ? Math.max(...ages) : 0;

  return {
    pendingAvgAgeHours: Number(avg.toFixed(2)),
    pendingOldestAgeHours: Number(oldest.toFixed(2))
  };
}
