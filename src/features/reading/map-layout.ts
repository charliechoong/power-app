import type { Book } from "./model";

export const MAP_NODE_WIDTH = 214;
export const MAP_NODE_HEIGHT = 132;

function orderConnectedLayers(
  books: Book[],
  depths: Map<string, number>,
  maxDepth: number,
) {
  const originalOrder = new Map(books.map((book, index) => [book.id, index]));
  const layers = Array.from({ length: maxDepth + 1 }, (_, depth) =>
    books.filter((book) => depths.get(book.id) === depth),
  );
  const ranks = new Map<string, number>();
  const averageRank = (ids: string[]) => {
    const values = ids.flatMap((id) => {
      const rank = ranks.get(id);
      return rank === undefined ? [] : [rank];
    });
    return values.length
      ? values.reduce((total, rank) => total + rank, 0) / values.length
      : Number.POSITIVE_INFINITY;
  };
  const sortLayer = (layer: Book[], linkedIds: (book: Book) => string[]) => {
    layer.sort(
      (left, right) =>
        averageRank(linkedIds(left)) - averageRank(linkedIds(right)) ||
        originalOrder.get(left.id)! - originalOrder.get(right.id)!,
    );
    layer.forEach((book, index) => ranks.set(book.id, index));
  };

  layers[0].forEach((book, index) => ranks.set(book.id, index));
  for (let depth = 1; depth <= maxDepth; depth++) {
    sortLayer(layers[depth], (book) => book.prerequisiteIds);
  }
  for (let depth = maxDepth - 1; depth >= 0; depth--) {
    sortLayer(layers[depth], (book) =>
      books
        .filter((candidate) => candidate.prerequisiteIds.includes(book.id))
        .map((candidate) => candidate.id),
    );
  }
  return layers.flat();
}

function orderByDependencyGroups(books: Book[], byId: Map<string, Book>) {
  const ordered: Book[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (book: Book) => {
    if (visited.has(book.id) || visiting.has(book.id)) return;
    visiting.add(book.id);
    book.prerequisiteIds.forEach((id) => {
      const earlier = byId.get(id);
      if (earlier) visit(earlier);
    });
    visiting.delete(book.id);
    visited.add(book.id);
    ordered.push(book);
  };
  books.filter((book) => book.prerequisiteIds.length).forEach(visit);
  books.forEach(visit);
  return ordered;
}

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
  const ordered = layered
    ? orderConnectedLayers(books, depths, maxDepth)
    : hasLinks
      ? orderByDependencyGroups(books, byId)
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
      return source
        ? [{ source, target: node, sourceOffset: 0, targetOffset: 0 }]
        : [];
    }),
  );
  for (const node of nodes) {
    const incoming = edges
      .filter((edge) => edge.target === node)
      .sort((a, b) => a.source.y - b.source.y);
    const incomingSpacing = Math.min(24, 72 / Math.max(1, incoming.length - 1));
    incoming.forEach((edge, index) => {
      edge.targetOffset = (index - (incoming.length - 1) / 2) * incomingSpacing;
    });
    const outgoing = edges
      .filter((edge) => edge.source === node)
      .sort((a, b) => a.target.y - b.target.y);
    const outgoingSpacing = Math.min(24, 72 / Math.max(1, outgoing.length - 1));
    outgoing.forEach((edge, index) => {
      edge.sourceOffset = (index - (outgoing.length - 1) / 2) * outgoingSpacing;
    });
  }
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
  sourceOffset = 0,
  targetOffset = 0,
) {
  if (target.x >= source.x + nodeWidth + 8) {
    const x1 = source.x + nodeWidth + 3;
    const x2 = target.x - 10;
    const y1 = source.y + MAP_NODE_HEIGHT / 2 + sourceOffset;
    const y2 = target.y + MAP_NODE_HEIGHT / 2 + targetOffset;
    const bend = Math.max(24, (x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
  }
  if (target.x + nodeWidth + 8 < source.x) {
    const x1 = source.x - 3;
    const x2 = target.x + nodeWidth + 10;
    const y1 = source.y + MAP_NODE_HEIGHT / 2 + sourceOffset;
    const y2 = target.y + MAP_NODE_HEIGHT / 2 + targetOffset;
    const bend = Math.max(24, (x1 - x2) / 2);
    return `M ${x1} ${y1} C ${x1 - bend} ${y1}, ${x2 + bend} ${y2}, ${x2} ${y2}`;
  }
  const y1 = source.y + MAP_NODE_HEIGHT / 2 + sourceOffset;
  const y2 = target.y + MAP_NODE_HEIGHT / 2 + targetOffset;
  if (targetOffset < 0) {
    const x1 = source.x - 3;
    const x2 = target.x - 10;
    const laneX = Math.min(x1, x2) - 17;
    return `M ${x1} ${y1} H ${laneX} V ${y2} H ${x2}`;
  }
  const x1 = source.x + nodeWidth + 3;
  const x2 = target.x + nodeWidth + 10;
  const laneX = Math.max(x1, x2) + 17;
  return `M ${x1} ${y1} H ${laneX} V ${y2} H ${x2}`;
}
