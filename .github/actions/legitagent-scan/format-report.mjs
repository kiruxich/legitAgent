export function countHigh(sarif) {
  const results = sarif?.runs?.[0]?.results ?? [];
  return results.filter((r) => r.level === 'error').length;
}

export function formatReport(sarif) {
  const results = sarif?.runs?.[0]?.results ?? [];
  const lines = ['<!-- legitagent-scan -->', '## legitAgent', ''];
  if (results.length === 0) {
    lines.push('Нарушений не найдено.');
    return lines.join('\n') + '\n';
  }
  for (const r of results) {
    const uri = r.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? '';
    lines.push(`- \`${r.ruleId}\` (${r.level}) — ${uri}`);
  }
  return lines.join('\n') + '\n';
}
