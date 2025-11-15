/**
 * Generate the Builder editor URL for a content entry
 * @param entryId - The Builder content entry ID
 * @returns The full Builder editor URL
 */
export function getBuilderEditUrl(entryId: string): string {
  return `https://builder.io/content/${entryId}`;
}
