import type { Book } from "./model";

export const MAP_NODE_WIDTH = 214;
export const MAP_NODE_HEIGHT = 132;
export const MAP_ROW_SPACING = 204;

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

function connectedComponents(books: Book[], byId: Map<string, Book>) {
  const neighbors = new Map(books.map((book) => [book.id, new Set<string>()]));
  for (const book of books) {
    for (const id of book.prerequisiteIds) {
      if (!byId.has(id)) continue;
      neighbors.get(book.id)!.add(id);
      neighbors.get(id)!.add(book.id);
    }
  }
  const seen = new Set<string>();
  return books.flatMap((book) => {
    if (seen.has(book.id)) return [];
    const group = new Set<string>();
    const pending = [book.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      group.add(id);
      pending.push(...neighbors.get(id)!);
    }
    return [books.filter((item) => group.has(item.id))];
  });
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
  const width = Math.max(200, availableWidth);
  const columns = width >= 760 ? 3 : width >= 520 ? 2 : 1;
  const columnWidth = (width - 32) / columns;
  const nodeWidth = Math.min(MAP_NODE_WIDTH, columnWidth - 20);
  const nodes: { book: Book; x: number; y: number }[] = [];
  const lanes = new Map<string, { left: number; right: number }>();
  let nextColumn = 0;
  let bandRow = 0;
  let bandHeight = 0;
  let bandStart = 0;
  const centerBand = () => {
    const shift = ((columns - nextColumn) * columnWidth) / 2;
    if (!shift) return;
    const movedLanes = new Set<{ left: number; right: number }>();
    for (const node of nodes.slice(bandStart)) {
      node.x += shift;
      const lane = lanes.get(node.book.id)!;
      if (movedLanes.has(lane)) continue;
      lane.left += shift;
      lane.right += shift;
      movedLanes.add(lane);
    }
  };
  for (const component of connectedComponents(books, byId)) {
    const maxDepth = Math.max(...component.map((book) => depths.get(book.id)!));
    const ordered = orderConnectedLayers(component, depths, maxDepth);
    const layers = Array.from({ length: maxDepth + 1 }, (_, depth) =>
      ordered.filter((book) => depths.get(book.id) === depth),
    );
    const blockWidth = Math.min(
      columns,
      Math.max(...layers.map((layer) => layer.length)),
    );
    if (nextColumn + blockWidth > columns) {
      centerBand();
      bandRow += bandHeight;
      nextColumn = 0;
      bandHeight = 0;
      bandStart = nodes.length;
    }
    const rows = layers.flatMap((layer) => {
      const chunks: Book[][] = [];
      for (let index = 0; index < layer.length; index += blockWidth)
        chunks.push(layer.slice(index, index + blockWidth));
      return chunks;
    });
    const blockLeft =
      16 + nextColumn * columnWidth + (columnWidth - nodeWidth) / 2;
    const lane = {
      left: blockLeft - 18,
      right: blockLeft + (blockWidth - 1) * columnWidth + nodeWidth + 18,
    };
    rows.forEach((row, rowIndex) => {
      const centeredColumn = nextColumn + (blockWidth - row.length) / 2;
      row.forEach((book, columnIndex) => {
        nodes.push({
          book,
          x:
            16 +
            (centeredColumn + columnIndex) * columnWidth +
            (columnWidth - nodeWidth) / 2,
          y: 20 + (bandRow + rowIndex) * MAP_ROW_SPACING,
        });
        lanes.set(book.id, lane);
      });
    });
    nextColumn += blockWidth;
    bandHeight = Math.max(bandHeight, rows.length);
  }
  centerBand();
  const positions = new Map(nodes.map((node) => [node.book.id, node]));
  const edges = nodes.flatMap((node) =>
    node.book.prerequisiteIds.flatMap((id) => {
      const source = positions.get(id);
      return source
        ? [{ source, target: node, sourceOffset: 0, targetOffset: 0, laneX: 0 }]
        : [];
    }),
  );
  for (const node of nodes) {
    const incoming = edges
      .filter((edge) => edge.target === node)
      .sort((a, b) => a.source.x - b.source.x || a.source.y - b.source.y);
    const incomingSpacing = Math.min(24, 72 / Math.max(1, incoming.length - 1));
    incoming.forEach((edge, index) => {
      edge.targetOffset = (index - (incoming.length - 1) / 2) * incomingSpacing;
    });
    const outgoing = edges
      .filter((edge) => edge.source === node)
      .sort((a, b) => a.target.x - b.target.x || a.target.y - b.target.y);
    const outgoingSpacing = Math.min(24, 72 / Math.max(1, outgoing.length - 1));
    outgoing.forEach((edge, index) => {
      edge.sourceOffset = (index - (outgoing.length - 1) / 2) * outgoingSpacing;
    });
  }
  for (const edge of edges) {
    const lane = lanes.get(edge.source.book.id)!;
    const sourceCenter = edge.source.x + nodeWidth / 2;
    const targetCenter = edge.target.x + nodeWidth / 2;
    edge.laneX =
      targetCenter > sourceCenter ||
      (targetCenter === sourceCenter && edge.targetOffset > 0)
        ? lane.right
        : lane.left;
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
  laneX?: number,
) {
  const x1 = source.x + nodeWidth / 2 + sourceOffset;
  const x2 = target.x + nodeWidth / 2 + targetOffset;
  const y1 = source.y + MAP_NODE_HEIGHT + 3;
  const y2 = target.y - 10;
  if (target.y - source.y > MAP_ROW_SPACING) {
    const detourX = laneX ?? Math.min(source.x, target.x) - 18;
    return `M ${x1} ${y1} V ${y1 + 14} H ${detourX} V ${y2 - 14} H ${x2} V ${y2}`;
  }
  const bend = (y2 - y1) / 2;
  return `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
}
