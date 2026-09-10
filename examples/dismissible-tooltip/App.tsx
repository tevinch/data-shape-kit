import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type ScatterPointItem,
  type TooltipContentProps,
} from "recharts";

import { useDismissibleTooltip } from "./useDismissibleTooltip.js";

type Point = {
  id: string;
  label: string;
  x: number;
  y: number;
  note: string;
};

const points: readonly Point[] = [
  { id: "point-A", label: "Point A", x: 12, y: 18, note: "A steady starting value." },
  { id: "point-B", label: "Point B", x: 29, y: 36, note: "The highest value in this sample." },
  { id: "point-C", label: "Point C", x: 47, y: 24, note: "A moderate closing value." },
];

function isPoint(value: unknown): value is Point {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string"
    && candidate.id.length > 0
    && typeof candidate.label === "string"
    && typeof candidate.x === "number"
    && typeof candidate.y === "number"
    && typeof candidate.note === "string";
}

function pointFromItem(item: ScatterPointItem): Point | null {
  return isPoint(item.payload) ? item.payload : null;
}

function ChartPoint({ cx, cy, payload }: ScatterPointItem) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !isPoint(payload)) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={8}
      fill="#8b5cf6"
      stroke="#ffffff"
      strokeWidth={3}
      aria-label={payload.label}
      data-point-id={payload.id}
    />
  );
}

function TooltipCard({ active, payload }: TooltipContentProps) {
  const point = payload.length > 0 && isPoint(payload[0]?.payload)
    ? payload[0].payload
    : null;
  if (!active || point === null) return null;

  return (
    <div className="tooltip-card" role="tooltip" data-tooltip-id={point.id}>
      <strong>{point.label}</strong>
      <span>X {point.x} · Y {point.y}</span>
    </div>
  );
}

export function App() {
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const tooltip = useDismissibleTooltip({ suspended: selectedPoint !== null });

  const openDetails = (point: Point, trigger?: EventTarget | null) => {
    returnFocusRef.current = trigger instanceof HTMLElement ? trigger : null;
    tooltip.dismiss(point.id);
    setSelectedPoint(point);
  };

  const closeDetails = () => {
    setSelectedPoint(null);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (selectedPoint !== null) {
      if (!dialog.open) dialog.showModal();
      closeButtonRef.current?.focus();
      return;
    }

    if (dialog.open) dialog.close();
    const returnTarget = returnFocusRef.current;
    returnFocusRef.current = null;
    returnTarget?.focus();
  }, [selectedPoint]);

  const handlePointEnter = (item: ScatterPointItem) => {
    const point = pointFromItem(item);
    if (point !== null) tooltip.enter(point.id);
  };

  const handlePointClick = (
    item: ScatterPointItem,
    _index: number,
    event: ReactMouseEvent<SVGGraphicsElement>,
  ) => {
    const point = pointFromItem(item);
    if (point !== null) openDetails(point, event.currentTarget);
  };

  const dismissedPoint = points.find((point) => point.id === tooltip.dismissedId);
  const status = selectedPoint !== null
    ? `${selectedPoint.label} details are open; chart tooltip is paused.`
    : dismissedPoint !== undefined
      ? `${dismissedPoint.label} tooltip is dismissed. Move to a different point to resume.`
      : "Chart tooltip follows pointer hover.";

  return (
    <main>
      <header className="intro">
        <p className="eyebrow">React + Recharts example</p>
        <h1>Dismissible chart tooltip</h1>
        <ol>
          <li>Hover a chart point to see its values.</li>
          <li>Click the point to open its details and hide the tooltip.</li>
          <li>Close the details, then move to another point to resume.</li>
        </ol>
      </header>

      <section className="card" aria-labelledby="chart-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pointer example</p>
            <h2 id="chart-heading">Sample measurements</h2>
          </div>
          <output className="status" aria-live="polite">{status}</output>
        </div>

        <div className="chart-scroll">
          <ScatterChart
            width={640}
            height={340}
            margin={{ top: 24, right: 32, bottom: 20, left: 8 }}
            accessibilityLayer={false}
          >
            <CartesianGrid strokeDasharray="4 6" stroke="#d8d5e3" />
            <XAxis
              type="number"
              dataKey="x"
              name="X"
              domain={[0, 55]}
              tickLine={false}
              axisLine={{ stroke: "#8a8499" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Y"
              domain={[0, 45]}
              tickLine={false}
              axisLine={{ stroke: "#8a8499" }}
            />
            <Tooltip
              active={tooltip.active}
              content={TooltipCard}
              cursor={false}
              isAnimationActive={false}
              shared={false}
            />
            <Scatter
              data={points}
              name="Sample point"
              shape={ChartPoint}
              isAnimationActive={false}
              onMouseEnter={handlePointEnter}
              onClick={handlePointClick}
            />
          </ScatterChart>
        </div>
      </section>

      <section className="card table-card" aria-labelledby="table-heading">
        <p className="eyebrow">Keyboard alternative</p>
        <h2 id="table-heading">Point data</h2>
        <div className="table-scroll">
          <table>
            <caption>All values shown in the chart</caption>
            <thead>
              <tr><th scope="col">Point</th><th scope="col">X</th><th scope="col">Y</th><th scope="col">Action</th></tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.id}>
                  <th scope="row">{point.label}</th>
                  <td>{point.x}</td>
                  <td>{point.y}</td>
                  <td>
                    <button
                      type="button"
                      data-details-id={point.id}
                      onClick={(event) => openDetails(point, event.currentTarget)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        aria-labelledby="details-title"
        onCancel={(event) => {
          event.preventDefault();
          closeDetails();
        }}
        onClose={() => {
          if (selectedPoint !== null) closeDetails();
        }}
      >
        {selectedPoint !== null ? (
          <div className="dialog-content">
            <p className="eyebrow">Selected point</p>
            <h2 id="details-title">{selectedPoint.label} details</h2>
            <dl>
              <div><dt>X value</dt><dd>{selectedPoint.x}</dd></div>
              <div><dt>Y value</dt><dd>{selectedPoint.y}</dd></div>
            </dl>
            <p>{selectedPoint.note}</p>
            <button ref={closeButtonRef} type="button" data-close-details onClick={closeDetails}>
              Close details
            </button>
          </div>
        ) : null}
      </dialog>

      <footer>
        <p>If this example helped, you can optionally buy me a coffee:</p>
        <ul>
          <li><strong>USDC / SOL · Solana:</strong> <code>9tY6D9mwcFaJwwzEHvw2v7nhSpdjqjNBYtuooyBN6rYy</code></li>
          <li><strong>USDC / ETH · Base:</strong> <code>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</code></li>
          <li><strong>USDT · BNB Smart Chain (BEP20):</strong> <code>0x568Ab98578d682FB0B0b45619BE73EbFfbf5a6eA</code></li>
        </ul>
      </footer>
    </main>
  );
}
