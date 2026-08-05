/**
 * Categories offered when picking one for a transaction, template, split, or
 * ledger filter.
 *
 * `Active` marks a category as still in current use — documented in the
 * Notion schema since it existed, but `notionClient.js` never actually read
 * it, so every category appeared in every picker regardless of what the
 * checkbox said.
 *
 * An inactive category is hidden from every *new* pick, but never dropped
 * from one a row already uses: `keepSelectedId` always survives the filter,
 * so deactivating a category can't silently blank out (or on save, lose) the
 * category on every transaction already filed under it, and can't hide a
 * category from the filter you're currently using to review its own history.
 */
export function selectableCategories(categories, type, keepSelectedId = null) {
  return (categories || [])
    .filter(c => c.type === type && (c.active !== false || c.id === keepSelectedId))
    .sort((a, b) => a.name.localeCompare(b.name));
}
