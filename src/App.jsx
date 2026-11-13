import { useCallback, useEffect, useRef, useState } from "react";

function getConnectionLayout(frame) {
  const doc = frame?.contentDocument;
  const win = frame?.contentWindow;
  const heap = doc?.getElementById("heap");
  if (!doc || !win || !heap || !Array.isArray(win.__structxPairs)) return null;
  let svg = heap.querySelector(":scope > svg.structx-connections");
  if (!svg) {
    svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "structx-connections");
    svg.setAttribute("aria-hidden", "true");
    heap.prepend(svg);
  }
  const heapRect = heap.getBoundingClientRect();
  const paths = [];
  win.__structxPairs.forEach(([sourceId, targetAddress], index) => {
    const source = doc.getElementById(sourceId);
    const target = doc.getElementById(`node-${targetAddress}`);
    if (!source || !target || !source.closest("#heap .node")) return;
    const sourceRect = source.closest(".node").getBoundingClientRect();
    const targetRect = target.closest(".node").getBoundingClientRect();
    const sx = sourceRect.left + sourceRect.width / 2 - heapRect.left + heap.scrollLeft;
    const sy = sourceRect.bottom - heapRect.top + heap.scrollTop;
    const tx = targetRect.left + targetRect.width / 2 - heapRect.left + heap.scrollLeft;
    const ty = targetRect.top - heapRect.top + heap.scrollTop;
    const bend = Math.max(28, Math.abs(ty - sy) * 0.48);
    paths.push({ id: `pointer-${index}`, d: `M ${sx} ${sy} C ${sx} ${sy + bend}, ${tx} ${ty - bend}, ${tx} ${ty}` });
  });
  const width = Math.max(heap.clientWidth, heap.scrollWidth);
  const height = Math.max(heap.clientHeight, heap.scrollHeight);
  svg.setAttribute("width", width); svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = paths.map(path => `<path d="${path.d}" />`).join("");
  return { paths, overlay: { top: frame.getBoundingClientRect().top + heapRect.top, left: frame.getBoundingClientRect().left + heapRect.left, width: heap.clientWidth, height: heap.clientHeight } };
}

export default function App() {
  const frameRef = useRef(null);
  const rafRef = useRef(0);
  const signatureRef = useRef("");
  const [loaded, setLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [graph, setGraph] = useState({ paths: [], overlay: null });

  const refreshConnections = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const next = getConnectionLayout(frameRef.current);
      if (!next) return;
      const signature = JSON.stringify([
        next.paths.map(path => [path.id, path.d]),
        next.overlay && [next.overlay.top, next.overlay.left, next.overlay.width, next.overlay.height],
      ]);
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setGraph(next);
      }
    });
  }, []);

  const applyZoom = useCallback(nextZoom => {
    const value = Math.max(0.55, Math.min(1.8, nextZoom));
    setZoom(value);
    const heap = frameRef.current?.contentDocument?.getElementById("heap");
    if (!heap) return;
    heap.querySelectorAll(".node").forEach(node => {
      const baseLeft = Number(node.dataset.baseLeft ?? parseFloat(node.style.left) ?? 0);
      const baseTop = Number(node.dataset.baseTop ?? parseFloat(node.style.top) ?? 0);
      if (node.dataset.baseLeft == null) node.dataset.baseLeft = String(baseLeft);
      if (node.dataset.baseTop == null) node.dataset.baseTop = String(baseTop);
      node.style.left = `${baseLeft * value}px`;
      node.style.top = `${baseTop * value}px`;
      node.style.transform = `scale(${value})`;
      node.style.transformOrigin = "top left";
    });
    signatureRef.current = "";
    refreshConnections();
  }, [refreshConnections]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!loaded || !frame) return;
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    const heap = doc?.getElementById("heap");
    if (!doc || !win || !heap) return;

    const refresh = () => {
      signatureRef.current = "";
      refreshConnections();
    };
    const onMessage = event => {
      if (event.source === win && event.data?.type === "structx:refresh") refreshConnections();
    };
    // The iframe document scrolls independently of the outer page. Capture
    // scroll events at document level so every nested scrolling container is covered.
    doc.addEventListener("scroll", refreshConnections, true);
    win.addEventListener("scroll", refreshConnections, { passive: true });
    heap.addEventListener("scroll", refreshConnections, { passive: true });
    heap.addEventListener("pointerover", refreshConnections);
    heap.addEventListener("pointerout", refreshConnections);
    window.addEventListener("scroll", refresh, { passive: true });
    window.addEventListener("resize", refresh);
    window.addEventListener("message", onMessage);

    const resizeObserver = new ResizeObserver(refresh);
    resizeObserver.observe(heap);
    if (doc.documentElement) resizeObserver.observe(doc.documentElement);

    refresh();
    return () => {
      doc.removeEventListener("scroll", refreshConnections, true);
      win.removeEventListener("scroll", refreshConnections);
      heap.removeEventListener("scroll", refreshConnections);
      heap.removeEventListener("pointerover", refreshConnections);
      heap.removeEventListener("pointerout", refreshConnections);
      window.removeEventListener("scroll", refresh);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("message", onMessage);
      resizeObserver.disconnect();
    };
  }, [loaded, refreshConnections]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <main className="app-shell">
      {!loaded && <div className="loading">Loading StructX…</div>}
      <iframe ref={frameRef} className="structx-frame" src="/structx-legacy.html"
        title="StructX C++ Memory Visualizer" onLoad={() => setLoaded(true)} />
      {loaded && graph.overlay && (
        <>
          <div className="zoom-controls" style={{ top: graph.overlay.top + 8, left: graph.overlay.left + graph.overlay.width - 116 }}>
            <button type="button" onClick={() => applyZoom(zoom - 0.15)} aria-label="Zoom out">−</button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => applyZoom(zoom + 0.15)} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => applyZoom(1)} aria-label="Reset zoom">↺</button>
          </div>
        </>
      )}
    </main>
  );
}
