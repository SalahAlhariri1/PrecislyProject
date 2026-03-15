// Tavily API integration — web search + URL extraction for the agent

import { tavily } from '@tavily/core';

function getClient() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');
  return tavily({ apiKey });
}

export async function tavily_search(
  query: string
): Promise<Array<{ title: string; url: string; content: string; published_date?: string }>> {
  try {
    const client = getClient();
    const response = await client.search(query, {
      maxResults: 5,
      searchDepth: 'basic',
    });

    return (response.results || []).map((r) => ({
      title: r.title || '',
      url: r.url || '',
      content: r.content || '',
      published_date: (r as Record<string, unknown>).published_date as string | undefined,
    }));
  } catch (err) {
    console.error('[tavily] search error:', err);
    return [];
  }
}

export async function tavily_extract(
  url: string
): Promise<{ title: string; content: string }> {
  try {
    const client = getClient();
    const response = await client.extract([url]);

    const first = response.results?.[0];
    return {
      title: first?.url || url,
      content: first?.rawContent || 'Could not extract content from this URL.',
    };
  } catch (err) {
    console.error('[tavily] extract error:', err);
    return { title: url, content: 'Failed to fetch URL content.' };
  }
}
