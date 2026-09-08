const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 };

export function countHigh(sarif, minimumConfidence = 'low') {
  const results = sarif?.runs?.[0]?.results ?? [];
  const minimum = CONFIDENCE_RANK[minimumConfidence] ?? CONFIDENCE_RANK.low;
  return results.filter(
    (r) => r.level === 'error' && (CONFIDENCE_RANK[r.properties?.confidence] ?? CONFIDENCE_RANK.low) >= minimum,
  ).length;
}

export function formatReport(sarif) {
  const results = sarif?.runs?.[0]?.results ?? [];
  const lines = ['<!-- legitagent-scan -->', '## legitAgent', ''];
  if (results.length === 0) {
    lines.push('Находок нет.');
    return lines.join('\n') + '\n';
  }
  for (const r of results) {
    const uri = r.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? '';
    const kind = r.properties?.kind ?? 'risk';
    const confidence = r.properties?.confidence ?? 'low';
    lines.push(`- \`${r.ruleId}\` (${r.level}, ${kind}, confidence ${confidence}) — ${uri}`);
  }
  return lines.join('\n') + '\n';
}
