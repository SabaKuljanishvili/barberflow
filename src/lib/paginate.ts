// PostgREST caps each response (max_rows, 1000 on hosted Supabase), so a
// single .limit(50_000) silently truncates. Page with .range() instead.

type Page<T> = { data: T[] | null; error: { message: string } | null };

export async function fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<Page<T>>, size = 1000, max = 100_000): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; from < max; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return all;
}
