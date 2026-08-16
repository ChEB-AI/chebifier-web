// src/lib/random-id.js
// Drop-in replacement for `randomId` from @mui/x-data-grid-generator, which was
// only pulled in for this one helper (and dragged in the whole premium data grid
// + exceljs dependency tree with it).

export function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older/non-secure contexts where crypto.randomUUID is missing.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
