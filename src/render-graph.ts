import { readFile, writeFile } from "node:fs/promises";
import type { DependencyGraph } from "./types.ts";

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main(): Promise<void> {
  const graph = await readJson<DependencyGraph>("data/dependency_graph.json");
  const degree = new Map<string, { in: number; out: number }>();
  for (const node of graph.nodes) degree.set(node.slug, { in: 0, out: 0 });
  for (const edge of graph.edges) {
    const from = degree.get(edge.from);
    const to = degree.get(edge.to);
    if (from) from.out += 1;
    if (to) to.in += 1;
  }

  const nodes = graph.nodes.map((node) => ({
    id: node.slug,
    label: node.name,
    toolkit: node.toolkit,
    description: node.description,
    requiredInputs: node.requiredInputs.map((param) => param.path),
    tags: node.tags,
    incoming: degree.get(node.slug)?.in ?? 0,
    outgoing: degree.get(node.slug)?.out ?? 0,
  }));

  const links = graph.edges.map((edge) => ({
    source: edge.from,
    target: edge.to,
    satisfies: edge.satisfies,
    confidence: edge.confidence,
    reason: edge.reason,
    resource: edge.resource ?? "",
    sourceType: edge.source,
  }));

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Composio Tool Dependency Graph</title>
  <script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
  <script src="https://unpkg.com/three-spritetext@1.8.2/dist/three-spritetext.min.js"></script>
  <script src="https://unpkg.com/3d-force-graph@1.73.5/dist/3d-force-graph.min.js"></script>
  <style>
    :root {
      --bg: #070b12;
      --panel: rgba(12, 18, 28, 0.82);
      --panel-solid: #0c121c;
      --line: rgba(164, 183, 207, 0.18);
      --text: #edf6ff;
      --muted: #91a4bc;
      --github: #58a6ff;
      --google: #65d28f;
      --accent: #f2c66d;
      --danger: #ff7b72;
    }
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body {
      color: var(--text);
      font-family: Avenir Next, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 12% 16%, rgba(88, 166, 255, 0.18), transparent 28rem),
        radial-gradient(circle at 86% 72%, rgba(101, 210, 143, 0.14), transparent 30rem),
        linear-gradient(135deg, #070b12, #101624 54%, #05070c);
    }
    #graph { position: fixed; inset: 0; }
    .topbar {
      position: fixed;
      top: 18px;
      left: 18px;
      right: 18px;
      display: grid;
      grid-template-columns: minmax(260px, 1fr) auto;
      gap: 14px;
      z-index: 5;
      pointer-events: none;
    }
    .brand, .controls, .side, .tabs, .legend, .toast {
      pointer-events: auto;
      border: 1px solid var(--line);
      background: var(--panel);
      box-shadow: 0 18px 70px rgba(0, 0, 0, 0.32);
      backdrop-filter: blur(18px);
    }
    .brand {
      border-radius: 24px;
      padding: 16px 18px;
      max-width: 820px;
    }
    h1 { margin: 0 0 5px; font-size: clamp(22px, 3vw, 34px); letter-spacing: -0.055em; }
    .meta { color: var(--muted); font-size: 13px; line-height: 1.45; }
    .controls {
      border-radius: 999px;
      padding: 10px;
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      align-self: start;
    }
    input, select, button {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.06);
      color: var(--text);
      border-radius: 999px;
      padding: 9px 12px;
      outline: none;
      min-height: 38px;
    }
    input { width: 270px; }
    select { color-scheme: dark; }
    button { cursor: pointer; transition: transform 0.16s ease, background 0.16s ease; }
    button:hover { transform: translateY(-1px); background: rgba(255,255,255,0.11); }
    .side {
      position: fixed;
      top: 116px;
      right: 18px;
      bottom: 18px;
      width: min(420px, calc(100vw - 36px));
      border-radius: 26px;
      z-index: 4;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .tabs {
      position: fixed;
      left: 18px;
      bottom: 18px;
      z-index: 6;
      border-radius: 999px;
      padding: 8px;
      display: flex;
      gap: 6px;
    }
    .tab { border-color: transparent; background: transparent; color: var(--muted); }
    .tab.active { color: var(--text); background: rgba(242,198,109,0.16); border-color: rgba(242,198,109,0.35); }
    .panel { display: none; padding: 18px; overflow: auto; height: 100%; }
    .panel.active { display: block; }
    .card {
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.045);
      border-radius: 20px;
      padding: 14px;
      margin-bottom: 12px;
    }
    .slug { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; color: #cde3ff; overflow-wrap: anywhere; }
    .pill {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.06);
      border-radius: 999px;
      padding: 5px 9px;
      margin: 3px;
      color: var(--muted);
      font-size: 12px;
    }
    .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .github { background: var(--github); box-shadow: 0 0 14px var(--github); }
    .googlesuper { background: var(--google); box-shadow: 0 0 14px var(--google); }
    .statgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .stat { border-radius: 17px; background: rgba(255,255,255,0.06); padding: 12px; }
    .stat strong { display: block; font-size: 20px; }
    .stat span { color: var(--muted); font-size: 12px; }
    .rangeRow { display: flex; align-items: center; gap: 10px; min-width: 190px; color: var(--muted); font-size: 12px; }
    input[type="range"] { width: 120px; min-height: auto; padding: 0; }
    .legend {
      position: fixed;
      left: 18px;
      top: 132px;
      z-index: 4;
      border-radius: 22px;
      padding: 12px;
      color: var(--muted);
      font-size: 12px;
      max-width: 230px;
    }
    .legend div { margin: 6px 0; }
    a { color: #9dccff; }
    .examples code { color: #d9ebff; }
    @media (max-width: 980px) {
      .topbar { grid-template-columns: 1fr; }
      .controls { border-radius: 24px; flex-wrap: wrap; justify-content: flex-start; }
      input { width: min(100%, 360px); }
      .side { top: auto; height: 42vh; }
      .legend { display: none; }
    }
  </style>
</head>
<body>
  <div id="graph"></div>
  <section class="topbar">
    <div class="brand">
      <h1>Composio Tool Dependency Graph</h1>
      <div class="meta">Obsidian-style 3D map of precursor actions for GitHub and Google Super. An edge means the source tool can help obtain information required before running the target tool.</div>
    </div>
    <div class="controls">
      <input id="search" placeholder="Search tools, inputs, resources..." />
      <select id="toolkit">
        <option value="all">All toolkits</option>
        <option value="github">GitHub</option>
        <option value="googlesuper">Google Super</option>
      </select>
      <div class="rangeRow"><span>confidence</span><input id="confidence" type="range" min="0.68" max="0.96" step="0.01" value="0.68"><span id="confidenceValue">0.68</span></div>
      <button id="reset">Reset view</button>
    </div>
  </section>

  <aside class="legend">
    <div><span class="dot github"></span> GitHub tools</div>
    <div><span class="dot googlesuper"></span> Google Super tools</div>
    <div>Drag to orbit. Scroll to zoom. Click a node to fly to it.</div>
  </aside>

  <section class="side">
    <div id="inspect" class="panel active">
      <div class="card">
        <div class="statgrid">
          <div class="stat"><strong>${graph.nodes.length}</strong><span>tools</span></div>
          <div class="stat"><strong>${graph.edges.length}</strong><span>edges</span></div>
          <div class="stat"><strong>${new Set(graph.edges.map((edge) => edge.to)).size}</strong><span>targets</span></div>
        </div>
      </div>
      <div id="details" class="card">
        <h2>Explore the graph</h2>
        <p>Search for examples like <span class="slug">REPLY_TO_THREAD</span>, <span class="slug">ADD_LABELS</span>, or <span class="slug">SEND_EMAIL</span>. Click a node or edge to inspect the dependency reason.</p>
      </div>
    </div>
    <div id="explain" class="panel">
      <div class="card">
        <h2>Intended idea</h2>
        <p>This graph helps an agent decide whether it should ask the user for missing information or run another Composio tool first.</p>
        <p>For example, <span class="slug">GOOGLESUPER_REPLY_TO_THREAD</span> needs a <span class="slug">thread_id</span>, so precursor tools like <span class="slug">GOOGLESUPER_LIST_THREADS</span> and <span class="slug">GOOGLESUPER_FETCH_EMAILS</span> point into it.</p>
      </div>
      <div class="card">
        <h2>Method</h2>
        <p>The raw output schemas only expose generic fields like <span class="slug">data</span>, <span class="slug">error</span>, and <span class="slug">successful</span>, so the graph uses resource-aware matching over tool names, descriptions, input parameters, and action verbs.</p>
        <p>Each edge stores the source tool, target tool, satisfied input, confidence, resource, and a plain-English reason. Successful LLM adjudications are merged when available, but the graph is fully reproducible with deterministic rules.</p>
      </div>
      <div class="card examples">
        <h2>Examples</h2>
        <p><code>GOOGLESUPER_SEARCH_PEOPLE -> GOOGLESUPER_SEND_EMAIL</code> resolves recipient emails from names/contacts.</p>
        <p><code>GITHUB_LIST_REPOSITORY_ISSUES -> GITHUB_ADD_LABELS_TO_AN_ISSUE</code> provides issue numbers before mutating an issue.</p>
        <p><code>GOOGLESUPER_ACL_LIST -> GOOGLESUPER_ACL_DELETE</code> provides ACL rule IDs before deletion.</p>
      </div>
      <div class="card">
        <h2>Files</h2>
        <p>Primary graph data: <span class="slug">data/dependency_graph.json</span></p>
        <p>Flat edge list: <span class="slug">data/dependency_edges.json</span></p>
        <p>Methodology: <span class="slug">README_solution.md</span></p>
      </div>
    </div>
  </section>

  <nav class="tabs">
    <button class="tab active" data-panel="inspect">Inspect</button>
    <button class="tab" data-panel="explain">Explanation</button>
  </nav>

  <script>
    const rawNodes = ${JSON.stringify(nodes)};
    const rawLinks = ${JSON.stringify(links)};
    const colors = { github: '#58a6ff', googlesuper: '#65d28f' };
    const graphEl = document.getElementById('graph');
    const details = document.getElementById('details');
    const search = document.getElementById('search');
    const toolkit = document.getElementById('toolkit');
    const confidence = document.getElementById('confidence');
    const confidenceValue = document.getElementById('confidenceValue');
    let selectedId = null;

    function escape(value) {
      return String(value ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }
    function nodeText(node) {
      return [node.id, node.label, node.toolkit, node.description, node.requiredInputs.join(' '), node.tags.join(' ')].join(' ').toLowerCase();
    }
    function linkText(link) {
      const source = typeof link.source === 'object' ? link.source.id : link.source;
      const target = typeof link.target === 'object' ? link.target.id : link.target;
      return [source, target, link.satisfies.join(' '), link.reason, link.resource].join(' ').toLowerCase();
    }
    function filteredData() {
      const q = search.value.trim().toLowerCase();
      const tk = toolkit.value;
      const min = Number(confidence.value);
      const nodePass = new Set(rawNodes.filter(node => {
        if (tk !== 'all' && node.toolkit !== tk) return false;
        if (q && !nodeText(node).includes(q)) return false;
        return true;
      }).map(node => node.id));
      const links = rawLinks.filter(link => {
        if (link.confidence < min) return false;
        const source = typeof link.source === 'object' ? link.source.id : link.source;
        const target = typeof link.target === 'object' ? link.target.id : link.target;
        if (!nodePass.has(source) || !nodePass.has(target)) return false;
        if (q && !linkText(link).includes(q) && !nodePass.has(source) && !nodePass.has(target)) return false;
        return true;
      });
      const linkedIds = new Set();
      links.forEach(link => { linkedIds.add(link.source); linkedIds.add(link.target); });
      const nodes = rawNodes.filter(node => nodePass.has(node.id) && (!q || linkedIds.has(node.id) || nodeText(node).includes(q))).slice(0, 1305);
      return { nodes: nodes.map(node => ({ ...node })), links: links.map(link => ({ ...link })) };
    }

    const Graph = ForceGraph3D()(graphEl)
      .backgroundColor('rgba(0,0,0,0)')
      .graphData(filteredData())
      .nodeId('id')
      .nodeVal(node => 3 + Math.sqrt(node.incoming + node.outgoing + 1))
      .nodeColor(node => selectedId === node.id ? '#f2c66d' : colors[node.toolkit] || '#ccd6f6')
      .nodeOpacity(0.9)
      .linkColor(link => link.sourceType === 'llm' ? 'rgba(242,198,109,0.58)' : 'rgba(160,178,208,0.25)')
      .linkWidth(link => Math.max(0.35, (link.confidence - 0.62) * 5))
      .linkOpacity(0.55)
      .linkDirectionalParticles(link => link.confidence >= 0.93 ? 2 : 0)
      .linkDirectionalParticleWidth(1.5)
      .linkDirectionalParticleSpeed(0.004)
      .nodeThreeObject(node => {
        const group = new THREE.Group();
        const geometry = new THREE.SphereGeometry(3 + Math.sqrt(node.incoming + node.outgoing + 1) * 0.45, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: selectedId === node.id ? '#f2c66d' : (colors[node.toolkit] || '#ccd6f6'), transparent: true, opacity: 0.92 });
        const sphere = new THREE.Mesh(geometry, material);
        group.add(sphere);
        if ((node.incoming + node.outgoing) >= 12 || selectedId === node.id) {
          const label = new SpriteText(node.label);
          label.color = '#edf6ff';
          label.textHeight = 4.2;
          label.position.y = 8;
          label.backgroundColor = 'rgba(7,11,18,0.55)';
          label.padding = 2;
          group.add(label);
        }
        return group;
      })
      .onNodeClick(node => {
        selectedId = node.id;
        Graph.nodeColor(Graph.nodeColor());
        const distance = 120;
        const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
        Graph.cameraPosition({ x: (node.x || 0) * distRatio, y: (node.y || 0) * distRatio, z: (node.z || 0) * distRatio }, node, 1200);
        details.innerHTML = '<h2>' + escape(node.label) + '</h2>' +
          '<div class="slug">' + escape(node.id) + '</div>' +
          '<p><span class="pill"><span class="dot ' + escape(node.toolkit) + '"></span>' + escape(node.toolkit) + '</span>' +
          '<span class="pill">incoming ' + escape(node.incoming) + '</span><span class="pill">outgoing ' + escape(node.outgoing) + '</span></p>' +
          '<p><strong>Required inputs</strong><br>' + escape(node.requiredInputs.join(', ') || 'none') + '</p>' +
          '<p>' + escape(node.description || 'No description.') + '</p>';
      })
      .onLinkClick(link => {
        const source = typeof link.source === 'object' ? link.source.id : link.source;
        const target = typeof link.target === 'object' ? link.target.id : link.target;
        details.innerHTML = '<h2>Dependency edge</h2>' +
          '<p><strong>From</strong><br><span class="slug">' + escape(source) + '</span></p>' +
          '<p><strong>To</strong><br><span class="slug">' + escape(target) + '</span></p>' +
          '<p><strong>Satisfies</strong><br>' + escape(link.satisfies.join(', ')) + '</p>' +
          '<p><strong>Confidence</strong> ' + escape(link.confidence) + ' <span class="pill">' + escape(link.sourceType) + '</span></p>' +
          '<p>' + escape(link.reason) + '</p>';
      });

    Graph.d3Force('charge').strength(-72);
    Graph.d3Force('link').distance(link => 42 + (1 - link.confidence) * 80);

    function refresh() {
      confidenceValue.textContent = Number(confidence.value).toFixed(2);
      selectedId = null;
      Graph.graphData(filteredData());
    }
    search.addEventListener('input', refresh);
    toolkit.addEventListener('change', refresh);
    confidence.addEventListener('input', refresh);
    document.getElementById('reset').addEventListener('click', () => {
      search.value = '';
      toolkit.value = 'all';
      confidence.value = '0.68';
      Graph.cameraPosition({ x: 0, y: 0, z: 650 }, { x: 0, y: 0, z: 0 }, 900);
      refresh();
    });
    document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.panel).classList.add('active');
    }));

    setTimeout(() => Graph.cameraPosition({ x: 0, y: 0, z: 650 }, { x: 0, y: 0, z: 0 }, 1000), 250);
  </script>
</body>
</html>`;

  await writeFile("dependency_graph.html", html, "utf8");
  console.log("Wrote dependency_graph.html");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
