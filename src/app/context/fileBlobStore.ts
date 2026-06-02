/**
 * Shared in-memory store for file blob URLs.
 * Files uploaded through any page (GroupDetailView, CollectionSubmitPage, etc.)
 * register their blob URLs here so they can be previewed from any view within
 * the same browser session.
 */
export const fileBlobUrls = new Map<string, string>();
