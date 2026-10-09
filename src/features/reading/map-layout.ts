import type { Book } from "./model";

export const MAP_NODE_WIDTH = 214;
export const MAP_NODE_HEIGHT = 132;

export function layoutReadingMap(books: Book[], availableWidth = 760) {
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
  const width = Math.max(200, availableWidth);
  const columns = width >= 760 ? 3 : width >= 520 ? 2 : 1;
  const columnWidth = (width - 32) / columns;
  const nodeWidth = Math.min(MAP_NODE_WIDTH, columnWidth - 20);
  const maxDepth = Math.max(0, ...depths.values());
  const layered = hasLinks && maxDepth < columns;
  const ordered = hasLinks
    ? books
        .map((book, index) => ({ book, index }))
        .sort(
          (a, b) =>
            (depths.get(a.book.id) ?? 0) - (depths.get(b.book.id) ?? 0) ||
            a.index - b.index,
        )
        .map(({ book }) => book)
    : books;
  const counts = new Map<number, number>();
  const nodes = ordered.map((book, index) => {
    const column = layered ? (depths.get(book.id) ?? 0) : index % columns;
    const row = layered
      ? (counts.get(column) ?? 0)
      : Math.floor(index / columns);
    counts.set(column, row + 1);
    return {
      book,
      x: 16 + column * columnWidth + (columnWidth - nodeWidth) / 2,
      y: 20 + row * 160,
    };
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
    width,
    nodeWidth,
    height: Math.max(
      ...nodes.map((node) => node.y + MAP_NODE_HEIGHT + 20),
      172,
    ),
  };
}

export function readingMapEdgePath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  nodeWidth: number,
) {
  if (target.x >= source.x + nodeWidth + 8) {
    const x1 = source.x + nodeWidth + 3;
    const x2 = target.x - 10;
    const y1 = source.y + MAP_NODE_HEIGHT / 2;
    const y2 = target.y + MAP_NODE_HEIGHT / 2;
    const bend = Math.max(24, (x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
  }
  if (target.x + nodeWidth + 8 < source.x) {
    const x1 = source.x - 3;
    const x2 = target.x + nodeWidth + 10;
    const y1 = source.y + MAP_NODE_HEIGHT / 2;
    const y2 = target.y + MAP_NODE_HEIGHT / 2;
    const bend = Math.max(24, (x1 - x2) / 2);
    return `M ${x1} ${y1} C ${x1 - bend} ${y1}, ${x2 + bend} ${y2}, ${x2} ${y2}`;
  }
  const x1 = source.x + nodeWidth / 2;
  const x2 = target.x + nodeWidth / 2;
  const down = target.y >= source.y;
  const y1 = source.y + (down ? MAP_NODE_HEIGHT + 3 : -3);
  const y2 = target.y + (down ? -10 : MAP_NODE_HEIGHT + 10);
  const bend = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${bend}, ${x2} ${bend}, ${x2} ${y2}`;
}
