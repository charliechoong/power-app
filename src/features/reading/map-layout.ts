import type { Book } from "./model";

export const MAP_NODE_WIDTH = 214;
export const MAP_NODE_HEIGHT = 132;

export function layoutReadingMap(books: Book[]) {
  const byId = new Map(books.map((book) => [book.id, book]));
  const depths = new Map<string, number>();
  const depthOf = (id: string, visiting = new Set<string>()): number => {
    if (depths.has(id)) return depths.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const book = byId.get(id);
    const parents =
      book?.prerequisiteIds.filter((parent) => byId.has(parent)) ?? [];
    const depth = parents.length
      ? 1 + Math.max(...parents.map((parent) => depthOf(parent, visiting)))
      : 0;
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  };
  books.forEach((book) => depthOf(book.id));
  const hasLinks = books.some((book) =>
    book.prerequisiteIds.some((id) => byId.has(id)),
  );
  const nodes = books.map((book, index) => {
    if (!hasLinks)
      return {
        book,
        x: 20 + (index % 3) * 248,
        y: 20 + Math.floor(index / 3) * 158,
      };
    const depth = depths.get(book.id) ?? 0;
    const position = books
      .slice(0, index)
      .filter((previous) => depths.get(previous.id) === depth).length;
    return { book, x: 20 + depth * 310, y: 20 + position * 160 };
  });
  const positions = new Map(nodes.map((node) => [node.book.id, node]));
  const edges = nodes.flatMap((node) =>
    node.book.prerequisiteIds.flatMap((id) => {
      const source = positions.get(id);
      return source ? [{ source, target: node }] : [];
    }),
  );
  return {
    nodes,
    edges,
    width: Math.max(
      books.length && !hasLinks ? Math.min(books.length, 3) * 248 + 20 : 0,
      ...nodes.map((node) => node.x + MAP_NODE_WIDTH + 20),
      280,
    ),
    height: Math.max(
      ...nodes.map((node) => node.y + MAP_NODE_HEIGHT + 20),
      172,
    ),
  };
}
