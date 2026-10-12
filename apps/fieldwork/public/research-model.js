// Shared research enums and URL validation. All writes are server operations.
export const researchStatuses = ['Exploring', 'Waiting', 'Ready', 'Archived'];
export const findingTypes = ['Observation', 'Hypothesis', 'Question'];
export function webUrl(value) {
  if (!value?.trim()) return '';
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Use a full https:// or http:// link.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Use an http:// or https:// link without credentials.');
  return url.href;
}
export function parseLinks(value) {
  return [
    ...new Set(
      String(value || '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ].map((value) => {
    const url = webUrl(value);
    const parsed = new URL(url);
    return { url, label: `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}` };
  });
}
