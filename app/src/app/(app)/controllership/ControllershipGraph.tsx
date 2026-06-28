"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  useInternalNode,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Button } from "@/components/ui/button";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CONTROLLING_THRESHOLD,
  PRINCIPAL_ID,
  type ControllershipGraph as GraphData,
  type GraphCompany,
} from "@/lib/controllership";
import {
  useClearPositions,
  useClearWaypoints,
  useSavePositions,
  useSaveWaypoints,
} from "@/hooks/use-controllership";
import { ControllershipEditor } from "./ControllershipEditor";

// ─── helpers ──────────────────────────────────────────────────────────────

// Trim trailing zeros: 50 → "50%", 0.47 → "0.47%".
function pct(n: number): string {
  const s = n.toFixed(2).replace(/\.?0+$/, "");
  return `${s}%`;
}

// ─── custom nodes ───────────────────────────────────────────────────────────

// Edges float to the node border (see RoutedEdge), so the actual handle
// position is irrelevant — a single hidden source + target handle per node is
// enough for React Flow to consider the edge connected.
function NodeHandles() {
  const hidden = "!size-1 !min-h-0 !min-w-0 !border-0 !bg-transparent opacity-0";
  return (
    <>
      <Handle id="s" type="source" position={Position.Top} className={hidden} isConnectable={false} />
      <Handle id="t" type="target" position={Position.Top} className={hidden} isConnectable={false} />
    </>
  );
}

function PrincipalNode({ data }: NodeProps) {
  const label = (data as { label: string }).label;
  return (
    <div className="rounded-full border-2 border-primary bg-primary px-6 py-2.5 text-primary-foreground shadow-md">
      <span className="text-sm font-semibold">{label}</span>
      <NodeHandles />
    </div>
  );
}

function CompanyNode({ data, selected }: NodeProps) {
  const c = (data as { company: GraphCompany }).company;
  return (
    <div
      className={cn(
        "w-[210px] rounded-lg border bg-card p-3 shadow-sm transition-shadow",
        c.controlling ? "ring-2 ring-primary" : "hover:shadow-md",
        selected && "ring-2 ring-ring",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{c.name}</span>
        {c.jurisdictionCode ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {c.jurisdictionCode}
          </Badge>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums leading-none">
          {pct(c.lookThrough)}
        </span>
        {c.controlling ? (
          <Badge className="text-[10px]">Controlling</Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground">Minority</span>
        )}
      </div>
      <div className="mt-1.5 truncate text-[11px] text-muted-foreground">
        {c.valuation != null
          ? formatMoney(c.valuation, c.valuationCurrency)
          : "No valuation linked"}
      </div>
      <NodeHandles />
    </div>
  );
}

const nodeTypes = { principal: PrincipalNode, company: CompanyNode };

// ─── custom edge ────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };
const PARALLEL_SPACING = 26;

type EdgeEdit = {
  waypoints: Record<string, Pt[]>;
  setWaypoint: (edgeId: string, idx: number, p: Pt) => void;
  addWaypoint: (edgeId: string, idx: number, p: Pt) => void;
  removeWaypoint: (edgeId: string, idx: number) => void;
};
const EdgeEditContext = createContext<EdgeEdit | null>(null);

function centerOf(n: InternalNode): Pt {
  const w = n.measured?.width ?? 0;
  const h = n.measured?.height ?? 0;
  return {
    x: n.internals.positionAbsolute.x + w / 2,
    y: n.internals.positionAbsolute.y + h / 2,
  };
}

// Point on the node's border along the line from its center toward `target`.
function borderPoint(n: InternalNode, target: Pt): Pt {
  const w = n.measured?.width ?? 0;
  const h = n.measured?.height ?? 0;
  const c = centerOf(n);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const s = Math.min(w / 2 / Math.abs(dx || 1e-6), h / 2 / Math.abs(dy || 1e-6));
  return { x: c.x + dx * s, y: c.y + dy * s };
}

function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const c1 = vx * (p.x - a.x) + vy * (p.y - a.y);
  if (c1 <= 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(p.x - b.x, p.y - b.y);
  const t = c1 / c2;
  return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

// Straight polyline with floating endpoints (attach to the node side facing
// the route) through user waypoints. Double-click the line to add a point;
// drag a point to route around clashes; double-click a point to remove it.
function RoutedEdge({ id, source, target, markerEnd, style, data }: EdgeProps) {
  const ctx = useContext(EdgeEditContext);
  const { screenToFlowPosition } = useReactFlow();
  const s = useInternalNode(source);
  const t = useInternalNode(target);
  if (!s?.measured?.width || !t?.measured?.width) return null;

  const wps = ctx?.waypoints[id] ?? [];
  const sc = centerOf(s);
  const tc = centerOf(t);
  let start = borderPoint(s, wps[0] ?? tc);
  let end = borderPoint(t, wps[wps.length - 1] ?? sc);

  // Separate edges that share a node pair (straight parallel offset, no kink).
  const pIndex = Number(data?.pIndex ?? 0);
  const pCount = Number(data?.pCount ?? 1);
  if (pCount > 1) {
    const ax = end.x - start.x;
    const ay = end.y - start.y;
    const len = Math.hypot(ax, ay) || 1;
    const off = (pIndex - (pCount - 1) / 2) * PARALLEL_SPACING;
    const ox = (-ay / len) * off;
    const oy = (ax / len) * off;
    start = { x: start.x + ox, y: start.y + oy };
    end = { x: end.x + ox, y: end.y + oy };
  }

  const pts = [start, ...wps, end];
  const d = "M" + pts.map((p) => `${p.x},${p.y}`).join(" L");

  const label = data?.label as React.ReactNode;
  const mi = Math.max(0, Math.floor((pts.length - 1) / 2));
  const lx = (pts[mi].x + pts[mi + 1].x) / 2;
  const ly = (pts[mi].y + pts[mi + 1].y) / 2;

  const onAddPoint = (e: React.MouseEvent) => {
    e.stopPropagation();
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < pts.length - 1; k++) {
      const dd = distToSegment(p, pts[k], pts[k + 1]);
      if (dd < bestD) {
        bestD = dd;
        best = k;
      }
    }
    ctx?.addWaypoint(id, best, p);
  };

  const dragWaypoint = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const move = (ev: PointerEvent) =>
      ctx?.setWaypoint(id, i, screenToFlowPosition({ x: ev.clientX, y: ev.clientY }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <>
      <BaseEdge path={d} markerEnd={markerEnd} style={style} />
      {/* wide invisible hit area for double-click-to-add */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ pointerEvents: "stroke", cursor: "copy" }}
        onDoubleClick={onAddPoint}
      />
      <EdgeLabelRenderer>
        {label != null ? (
          <div
            className="pointer-events-none absolute rounded border bg-background/85 px-1 py-0.5 text-[10px] leading-none"
            style={{ transform: `translate(-50%, -150%) translate(${lx}px, ${ly}px)` }}
          >
            {label}
          </div>
        ) : null}
        {wps.map((wp, i) => (
          <div
            key={i}
            onPointerDown={dragWaypoint(i)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              ctx?.removeWaypoint(id, i);
            }}
            title="Drag to move · double-click to remove"
            className="nodrag nopan pointer-events-auto absolute size-2.5 cursor-grab rounded-full border border-background bg-foreground/60 hover:bg-foreground active:cursor-grabbing"
            style={{ transform: `translate(-50%, -50%) translate(${wp.x}px, ${wp.y}px)` }}
          />
        ))}
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes = { routed: RoutedEdge };

// ─── layered layout ─────────────────────────────────────────────────────────

const NODE_W = 210;
const GAP_X = 56;
const ROW_H = 150;

function computePositions(
  companies: GraphCompany[],
  edges: GraphData["ownershipEdges"],
): Map<string, { x: number; y: number }> {
  // Longest-path depth from the principal via edge relaxation (DAG-safe).
  const depth = new Map<string, number>([[PRINCIPAL_ID, 0]]);
  for (const c of companies) depth.set(c.id, 1); // default: held directly by you
  for (let i = 0; i <= companies.length; i++) {
    let changed = false;
    for (const e of edges) {
      const d = (depth.get(e.ownerId) ?? 0) + 1;
      if (d > (depth.get(e.ownedId) ?? 1)) {
        depth.set(e.ownedId, d);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const byDepth = new Map<number, string[]>();
  byDepth.set(0, [PRINCIPAL_ID]);
  for (const c of companies) {
    const d = depth.get(c.id) ?? 1;
    (byDepth.get(d) ?? byDepth.set(d, []).get(d)!).push(c.id);
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const [d, ids] of byDepth) {
    const totalW = ids.length * NODE_W + (ids.length - 1) * GAP_X;
    ids.forEach((id, i) => {
      positions.set(id, {
        x: i * (NODE_W + GAP_X) - totalW / 2,
        y: d * ROW_H,
      });
    });
  }
  return positions;
}

type XY = { x: number; y: number };

// ─── main component ─────────────────────────────────────────────────────────

export function ControllershipGraph({ graph }: { graph: GraphData }) {
  const { resolvedTheme } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const savePositions = useSavePositions();
  const clearPositions = useClearPositions();
  const saveWaypoints = useSaveWaypoints();
  const clearWaypoints = useClearWaypoints();

  // Manual edge waypoints (edgeId → ordered points). Seeded from the DB once;
  // changes are debounce-saved by the effect below.
  const [waypoints, setWaypoints] = useState<Record<string, Pt[]>>(
    graph.edgeWaypoints,
  );
  const waypointsDirty = useRef(false);
  useEffect(() => {
    if (!waypointsDirty.current) return;
    const handle = setTimeout(() => saveWaypoints.mutate(waypoints), 400);
    return () => clearTimeout(handle);
  }, [waypoints, saveWaypoints]);

  const nameOf = useCallback(
    (id: string) =>
      id === PRINCIPAL_ID
        ? "You"
        : (graph.companies.find((c) => c.id === id)?.name ?? id),
    [graph.companies],
  );

  // Initial nodes (computed once): persisted (DB) positions, else auto layout.
  const initialNodes = useMemo<Node[]>(() => {
    const auto = computePositions(graph.companies, graph.ownershipEdges);
    const stored = graph.nodePositions;
    const posOf = (id: string): XY => stored[id] ?? auto.get(id) ?? { x: 0, y: 0 };
    return [
      { id: PRINCIPAL_ID, type: "principal", position: posOf(PRINCIPAL_ID), data: { label: "You" } },
      ...graph.companies.map<Node>((c) => ({
        id: c.id,
        type: "company",
        position: posOf(c.id),
        data: { company: c },
      })),
    ];
    // Build once on mount; later graph changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const nodesRef = useRef<Node[]>(initialNodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Rebuild nodes when the graph changes, but keep any position the user has
  // already dragged (in-memory first, then persisted), falling back to the
  // auto layout for brand-new nodes. Node `data` always refreshes from graph.
  useEffect(() => {
    const auto = computePositions(graph.companies, graph.ownershipEdges);
    const stored = graph.nodePositions;
    setNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position]));
      const posOf = (id: string): XY =>
        prevPos.get(id) ?? stored[id] ?? auto.get(id) ?? { x: 0, y: 0 };
      return [
        {
          id: PRINCIPAL_ID,
          type: "principal",
          position: posOf(PRINCIPAL_ID),
          data: { label: "You" },
        },
        ...graph.companies.map<Node>((c) => ({
          id: c.id,
          type: "company",
          position: posOf(c.id),
          data: { company: c },
        })),
      ];
    });
  }, [graph.companies, graph.ownershipEdges, graph.nodePositions, setNodes]);

  // Persist node positions on drag end (last write wins across devices).
  const onNodeDragStop = useCallback(() => {
    savePositions.mutate(
      nodesRef.current.map((n) => ({
        nodeId: n.id,
        x: n.position.x,
        y: n.position.y,
      })),
    );
  }, [savePositions]);

  // Edge-edit context: mutate waypoints in state; the debounced effect saves.
  const edgeEdit = useMemo<EdgeEdit>(() => {
    const mutate = (fn: (m: Record<string, Pt[]>) => Record<string, Pt[]>) => {
      waypointsDirty.current = true;
      setWaypoints(fn);
    };
    return {
      waypoints,
      setWaypoint: (edgeId, idx, p) =>
        mutate((m) => {
          const arr = [...(m[edgeId] ?? [])];
          arr[idx] = p;
          return { ...m, [edgeId]: arr };
        }),
      addWaypoint: (edgeId, idx, p) =>
        mutate((m) => {
          const arr = [...(m[edgeId] ?? [])];
          arr.splice(idx, 0, p);
          return { ...m, [edgeId]: arr };
        }),
      removeWaypoint: (edgeId, idx) =>
        mutate((m) => {
          const arr = [...(m[edgeId] ?? [])];
          arr.splice(idx, 1);
          return { ...m, [edgeId]: arr };
        }),
    };
  }, [waypoints]);

  const resetLayout = useCallback(() => {
    clearPositions.mutate();
    clearWaypoints.mutate();
    waypointsDirty.current = false;
    setWaypoints({});
    const auto = computePositions(graph.companies, graph.ownershipEdges);
    setNodes((prev) =>
      prev.map((n) => ({ ...n, position: auto.get(n.id) ?? n.position })),
    );
  }, [clearPositions, clearWaypoints, graph.companies, graph.ownershipEdges, setNodes]);

  const edges = useMemo<Edge[]>(() => {
    const muted = "var(--color-muted-foreground)";
    const primary = "var(--color-primary)";
    const debt = "var(--color-chart-2)";
    const own: Edge[] = graph.ownershipEdges.map((e) => {
      const controlling = e.percentage > CONTROLLING_THRESHOLD;
      return {
        id: `own-${e.id}`,
        source: e.ownerId,
        target: e.ownedId,
        sourceHandle: "s",
        targetHandle: "t",
        type: "routed",
        data: { label: pct(e.percentage) },
        markerEnd: { type: MarkerType.ArrowClosed, color: controlling ? primary : muted },
        style: {
          stroke: controlling ? primary : muted,
          strokeWidth: controlling ? 2 : 1.5,
        },
      };
    });
    const debtEdges: Edge[] = graph.loans.map((l) => ({
      id: `loan-${l.id}`,
      source: l.lenderId,
      target: l.borrowerId,
      sourceHandle: "s",
      targetHandle: "t",
      type: "routed",
      animated: true,
      data: {
        label: `${formatMoney(l.principal, l.currency)}${l.interestRate != null ? ` @ ${l.interestRate}%` : ""}`,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color: debt },
      style: { stroke: debt, strokeWidth: 1.5, strokeDasharray: "6 4" },
    }));

    // Tag edges that share a node pair so RoutedEdge can offset them into
    // straight parallel lines (until the user adds their own waypoints).
    const all = [...own, ...debtEdges];
    const groups = new Map<string, Edge[]>();
    for (const e of all) {
      const key = [e.source, e.target].sort().join("::");
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
    }
    for (const list of groups.values()) {
      list.forEach((e, i) => {
        e.data = { ...(e.data ?? {}), pIndex: i, pCount: list.length };
      });
    }
    return all;
  }, [graph.ownershipEdges, graph.loans]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === "company") setSelectedId(node.id);
    },
    [],
  );

  const selected = selectedId
    ? (graph.companies.find((c) => c.id === selectedId) ?? null)
    : null;
  const selectedHistory = selectedId ? (graph.stakeHistory[selectedId] ?? []) : [];
  const selectedLoans = selectedId
    ? graph.loans.filter(
        (l) => l.lenderId === selectedId || l.borrowerId === selectedId,
      )
    : [];

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Controllership &amp; taxes
          </h1>
          <p className="text-sm text-muted-foreground">
            Click a company for details. Drag nodes to arrange; double-click a
            line to add a routing point, drag points to bend it, double-click a
            point to remove. Solid = equity, dashed = loans.
          </p>
        </div>
        <ControllershipEditor graph={graph} />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/20">
        <EdgeEditContext.Provider value={edgeEdit}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          colorMode={resolvedTheme === "dark" ? "dark" : "light"}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          nodesConnectable={false}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: false }}
        >
          <Background gap={18} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable className="!bg-card" />
          <Panel position="top-right">
            <Button variant="outline" size="sm" onClick={resetLayout}>
              Reset layout
            </Button>
          </Panel>
          {graph.companies.length === 0 ? (
            <Panel position="top-center">
              <span className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
                No companies yet — seed or add some to see the graph.
              </span>
            </Panel>
          ) : null}
        </ReactFlow>
        </EdgeEditContext.Provider>
      </div>

      {/* Per-company detail drawer */}
      <Sheet
        open={selected != null}
        onOpenChange={(o) => !o && setSelectedId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {selected.name}
                  {selected.controlling ? (
                    <Badge className="text-[10px]">Controlling</Badge>
                  ) : null}
                </SheetTitle>
                <SheetDescription>
                  {selected.jurisdictionName ?? "Jurisdiction —"} ·{" "}
                  {selected.entityType ?? "entity —"} · {selected.code}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 px-4 pb-6">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Stat label="Your direct stake">
                    {selected.directStake != null ? pct(selected.directStake) : "—"}
                  </Stat>
                  <Stat label="Look-through interest">
                    {pct(selected.lookThrough)}
                  </Stat>
                  <Stat label="Valuation">
                    {selected.valuation != null
                      ? formatMoney(selected.valuation, selected.valuationCurrency)
                      : "Not linked"}
                  </Stat>
                  <Stat label="Currency">
                    {selected.functionalCurrency ?? "—"}
                  </Stat>
                </dl>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Investment rounds
                  </h3>
                  {selected.linkedInvestmentIds.length ? (
                    <ul className="space-y-1 text-sm">
                      {selected.linkedInvestmentIds.map((id) => (
                        <li key={id} className="text-muted-foreground">
                          {graph.investments.find((i) => i.id === id)?.name ?? id}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      None linked — edit this company (Data tables → Companies →
                      ✎) to add rounds.
                    </p>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Stake history
                  </h3>
                  {selectedHistory.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Owner</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedHistory.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell>{nameOf(h.ownerId)}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {pct(h.percentage)}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {h.effectiveFrom}
                            </TableCell>
                            <TableCell className="tabular-nums text-muted-foreground">
                              {h.effectiveTo ?? "current"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No ownership records.
                    </p>
                  )}
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Loans
                  </h3>
                  {selectedLoans.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Direction</TableHead>
                          <TableHead className="text-right">Principal</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedLoans.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs">
                              {nameOf(l.lenderId)} → {nameOf(l.borrowerId)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatMoney(l.principal, l.currency)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {l.interestRate != null ? `${l.interestRate}%` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No loans involving this company.
                    </p>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{children}</dd>
    </div>
  );
}
