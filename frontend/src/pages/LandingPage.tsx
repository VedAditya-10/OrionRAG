import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Database, Cpu, Copy, Check, Terminal, ArrowRight, BookOpen, Layers, Settings, Eye } from "lucide-react";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { toast } from "sonner";

export function LandingPage() {
  const navigate = useNavigate();
  const { data: workspaces } = useWorkspaces();
  const [docTab, setDocTab] = useState<"overview" | "setup" | "mcp">("overview");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Aggregate stats
  const totalWorkspaces = workspaces?.length ?? 0;
  const totalDocuments = workspaces?.reduce((sum, ws) => sum + (ws.document_count || 0), 0) ?? 0;
  
  // Approximate chunk count (average 34 chunks per doc)
  const averageChunksPerDoc = 34;
  const totalChunks = totalDocuments * averageChunksPerDoc;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-[#f5f5f0] flex flex-col font-sans select-none overflow-y-auto scroll-smooth">
      <div className="max-w-[1100px] w-full mx-auto px-6 flex-1 flex flex-col pb-16">
        
        {/* Status Bar */}
        <div className="font-mono text-[11px] text-[#6b6a64] flex justify-between py-2.5 tracking-wider border-b border-[#262626] flex-shrink-0">
          <span>ORION / KNOWLEDGE-INTELLIGENCE-SYSTEM</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e8551f] animate-pulse" />
            SYSTEM ONLINE
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center justify-between py-4 border-b border-[#262626] flex-shrink-0 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-40">
          <div className="logo flex items-center gap-2.5 font-semibold text-base tracking-widest text-[#f5f5f0]">
            <Database className="w-5.5 h-5.5 text-[#e8551f]" />
            ORION
          </div>
          <div className="hidden sm:flex gap-7 font-mono text-[13px] text-[#a3a29c]">
            <button onClick={() => scrollToSection("product")} className="hover:text-foreground cursor-pointer transition-colors bg-transparent border-none">PRODUCT</button>
            <button onClick={() => scrollToSection("architecture")} className="hover:text-foreground cursor-pointer transition-colors bg-transparent border-none">ARCHITECTURE</button>
            <button onClick={() => scrollToSection("docs")} className="hover:text-foreground cursor-pointer transition-colors bg-transparent border-none">DOCS</button>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="font-mono text-[13px] px-4.5 py-2 rounded-sm border border-[#333333] hover:border-[#6b6a64] text-[#f5f5f0] bg-transparent cursor-pointer transition-all hover:bg-white/5"
          >
            GET STARTED
          </button>
        </nav>

        {/* Hero */}
        <section className="py-18 border-b border-[#262626] flex-shrink-0 flex flex-col md:flex-row gap-8 items-start justify-between">
          <div className="max-w-[620px]">
            <p className="font-mono text-[12px] text-[#e8551f] tracking-widest mb-4.5">[ SYS.01 ] INDUSTRIAL KNOWLEDGE INTELLIGENCE</p>
            <h1 className="text-4xl sm:text-[40px] font-semibold leading-tight text-[#f5f5f0] mb-4.5">
              Query your documents.<br />Trace every answer back to source.
            </h1>
            <p className="text-[#a3a29c] text-[15px] leading-relaxed mb-7">
              Reports, manuals, drawings, audio, video — parsed, mapped, and reasoned over. No black-box guesses, only citations you can directly verify.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate("/dashboard?new=true")}
                className="font-mono text-[13px] font-semibold px-4.5 py-2 rounded-sm bg-[#f5f5f0] hover:bg-[#e6e6dd] text-[#0a0a0a] cursor-pointer transition-all"
              >
                CREATE_KB()
              </button>
              <button
                onClick={() => scrollToSection("product")}
                className="font-mono text-[13px] px-4.5 py-2 rounded-sm border border-[#333333] hover:border-[#6b6a64] text-[#f5f5f0] bg-transparent cursor-pointer transition-all hover:bg-white/5"
              >
                ./HOW-IT-WORKS
              </button>
            </div>
          </div>
          
          {/* Quick links card */}
          <div className="w-full md:w-[320px] bg-[#111] border border-[#262626] p-4 rounded-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#262626] pb-2">
              <span className="font-mono text-[10px] text-[#6b6a64]">QUICK INTEGRATIONS</span>
              <Cpu className="w-3.5 h-3.5 text-[#e8551f]" />
            </div>
            <div className="space-y-2">
              <button 
                onClick={() => { scrollToSection("docs"); setDocTab("mcp"); }} 
                className="w-full flex items-center justify-between p-2 rounded-sm border border-[#262626] hover:border-[#333333] bg-[#161616] text-[12px] hover:text-[#e8551f] transition-all text-left cursor-pointer"
              >
                <span>Cursor IDE Setup</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              <button 
                onClick={() => { scrollToSection("docs"); setDocTab("mcp"); }} 
                className="w-full flex items-center justify-between p-2 rounded-sm border border-[#262626] hover:border-[#333333] bg-[#161616] text-[12px] hover:text-[#e8551f] transition-all text-left cursor-pointer"
              >
                <span>Claude Desktop Integration</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </section>

        {/* Live Readout */}
        <section className="py-10 border-b border-[#262626] flex-shrink-0">
          <p className="font-mono text-[11px] text-[#6b6a64] tracking-widest mb-4">LIVE WORKSPACE READOUT</p>
          <div className="grid grid-cols-2 md:grid-cols-4 border border-[#262626] rounded-sm bg-[#111111]/30">
            <div className="p-4.5 border-r border-[#262626] border-b md:border-b-0 border-[#262626]">
              <div className="font-mono text-[11px] text-[#6b6a64] mb-1.5">WORKSPACES</div>
              <div className="font-mono text-2xl font-semibold text-[#f5f5f0]">{totalWorkspaces}</div>
            </div>
            <div className="p-4.5 md:border-r border-[#262626] border-b md:border-b-0 border-[#262626]">
              <div className="font-mono text-[11px] text-[#6b6a64] mb-1.5">DOCUMENTS</div>
              <div className="font-mono text-2xl font-semibold text-[#e8551f]">{totalDocuments}</div>
            </div>
            <div className="p-4.5 border-r border-[#262626]">
              <div className="font-mono text-[11px] text-[#6b6a64] mb-1.5">EST. CHUNKS</div>
              <div className="font-mono text-2xl font-semibold text-[#f5f5f0]">{totalChunks.toLocaleString()}</div>
            </div>
            <div className="p-4.5">
              <div className="font-mono text-[11px] text-[#6b6a64] mb-1.5">AVG LATENCY</div>
              <div className="font-mono text-2xl font-semibold text-[#f5f5f0]">340ms</div>
            </div>
          </div>
        </section>

        {/* Product Section */}
        <section id="product" className="py-12 border-b border-[#262626] scroll-mt-12">
          <p className="font-mono text-[11px] text-[#6b6a64] tracking-widest mb-6">PRODUCT DESCRIPTION</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-[#262626] bg-[#111111]/40 p-5 rounded-sm">
              <div className="h-8 w-8 rounded bg-[#e8551f]/10 flex items-center justify-center text-[#e8551f] mb-3">
                <Database className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-semibold text-sm mb-2 text-[#f5f5f0]">Multimodal Parsing</h3>
              <p className="text-xs text-[#a3a29c] leading-relaxed">
                Indexes raw PDFs, high-resolution drawing blueprints, audio recordings, and video timelines. Auto-extracts dialogue and visually describes keyframes using local visual models.
              </p>
            </div>

            <div className="border border-[#262626] bg-[#111111]/40 p-5 rounded-sm">
              <div className="h-8 w-8 rounded bg-[#e8551f]/10 flex items-center justify-center text-[#e8551f] mb-3">
                <Layers className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-semibold text-sm mb-2 text-[#f5f5f0]">Entity-Relation Graphs</h3>
              <p className="text-xs text-[#a3a29c] leading-relaxed">
                Extracts key tags, codes, and operational metrics. Interlinks scattered documents into a unified knowledge graph, making multi-hop relation querying reliable and accurate.
              </p>
            </div>

            <div className="border border-[#262626] bg-[#111111]/40 p-5 rounded-sm">
              <div className="h-8 w-8 rounded bg-[#e8551f]/10 flex items-center justify-center text-[#e8551f] mb-3">
                <Eye className="w-4.5 h-4.5" />
              </div>
              <h3 className="font-semibold text-sm mb-2 text-[#f5f5f0]">Verifiable Citations</h3>
              <p className="text-xs text-[#a3a29c] leading-relaxed">
                Orion never guesses. Every answer provided in the chat sidebar aligns directly with glowing bounding boxes on original document layout pages and timeline markers.
              </p>
            </div>
          </div>
        </section>

        {/* Architecture Section */}
        <section id="architecture" className="py-12 border-b border-[#262626] scroll-mt-12">
          <p className="font-mono text-[11px] text-[#6b6a64] tracking-widest mb-6">ARCHITECTURE SYSTEM DESIGN</p>
          <div className="border border-[#262626] rounded-sm p-6 bg-[#111111]/20 flex flex-col items-center">
            
            {/* SVG Flowchart */}
            <div className="w-full max-w-[800px] overflow-x-auto scrollbar-none">
              <svg viewBox="0 0 800 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="min-w-[800px] text-[#a3a29c]">
                {/* Node Styles */}
                <style>
                  {`.node-rect { fill: #161616; stroke: #262626; stroke-width: 1.5; }
                    .node-rect-act { fill: #1a1512; stroke: #e8551f; stroke-width: 1.5; }
                    .text-node { font-family: monospace; font-size: 10px; fill: #f5f5f0; font-weight: bold; }
                    .text-desc { font-family: sans-serif; font-size: 9px; fill: #a3a29c; }
                    .arrow-line { stroke: #333333; stroke-width: 1.5; fill: none; }
                    .arrow-line-act { stroke: #e8551f; stroke-width: 1.5; fill: none; }`}
                </style>

                {/* Definitions */}
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#333333" />
                  </marker>
                  <marker id="arrow-act" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#e8551f" />
                  </marker>
                </defs>

                {/* Nodes */}
                {/* 1. Ingestion */}
                <rect x="20" y="110" width="140" height="60" rx="2" className="node-rect" />
                <text x="35" y="132" className="text-node">1. INGESTION</text>
                <text x="35" y="152" className="text-desc">PDF, EML, MP4, PNG</text>

                {/* Connection 1 to 2 */}
                <path d="M 160 140 L 210 140" className="arrow-line" markerStart="url(#dot)" markerEnd="url(#arrow)" />

                {/* 2. Phase 1: Parsing & Vector Indexing */}
                <rect x="220" y="60" width="170" height="60" rx="2" className="node-rect-act" />
                <text x="235" y="82" className="text-node">2A. VECTOR INDEX (~2-5s)</text>
                <text x="235" y="102" className="text-desc">Docling + ChromaDB (Vector Ready)</text>

                {/* Connection 2A to Vector DB */}
                <path d="M 390 90 L 440 90" className="arrow-line-act" markerEnd="url(#arrow-act)" />

                {/* 2B. Phase 2: Async KG Job Queue */}
                <rect x="220" y="160" width="170" height="60" rx="2" className="node-rect-act" />
                <text x="235" y="182" className="text-node">2B. ASYNC KG QUEUE</text>
                <text x="235" y="202" className="text-desc">PostgreSQL Queue → LightRAG</text>

                {/* Connection 2B to Knowledge Graph */}
                <path d="M 390 190 L 440 190" className="arrow-line-act" markerEnd="url(#arrow-act)" />

                {/* 3. Databases */}
                {/* Vector DB */}
                <rect x="450" y="60" width="140" height="60" rx="2" className="node-rect" />
                <text x="465" y="82" className="text-node">VECTOR DB</text>
                <text x="465" y="102" className="text-desc">ChromaDB (Dense bge-m3)</text>

                {/* Knowledge Graph */}
                <rect x="450" y="160" width="140" height="60" rx="2" className="node-rect" />
                <text x="465" y="182" className="text-node">KNOWLEDGE GRAPH</text>
                <text x="465" y="202" className="text-desc">LightRAG (NetworkX Graph)</text>

                {/* Connections to Query API */}
                <path d="M 590 90 L 640 120" className="arrow-line" markerEnd="url(#arrow)" />
                <path d="M 590 190 L 640 160" className="arrow-line" markerEnd="url(#arrow)" />

                {/* 4. Query & API */}
                <rect x="650" y="110" width="130" height="60" rx="2" className="node-rect-act" />
                <text x="665" y="132" className="text-node">4. HYBRID RAG API</text>
                <text x="665" y="152" className="text-desc">Vector + KG + Reranker</text>
              </svg>
            </div>

            <div className="mt-4 max-w-[680px] text-xs text-[#a3a29c] leading-relaxed text-center">
              OrionRAG's architecture decouples fast vector search from background graph building. Documents become searchable in 2–5 seconds (<span className="text-[#e8551f]">VECTOR_READY</span>). An asynchronous PostgreSQL-backed job queue then extracts Knowledge Graph entities using LightRAG in the background (<span className="text-[#e8551f]">GRAPH_READY</span>), protected by live query GPU priority throttling.
            </div>
          </div>
        </section>

        {/* Documentation Section */}
        <section id="docs" className="py-12 border-b border-[#262626] scroll-mt-12">
          <p className="font-mono text-[11px] text-[#6b6a64] tracking-widest mb-6">DOCUMENTATION</p>
          
          <div className="flex flex-col md:flex-row border border-[#262626] rounded-sm bg-[#111111]/10 overflow-hidden min-h-[400px]">
            {/* Sidebar selectors */}
            <div className="w-full md:w-56 border-r border-[#262626] bg-[#111111]/30 flex flex-row md:flex-col text-[12px] font-mono text-[#a3a29c]">
              <button 
                onClick={() => setDocTab("overview")} 
                className={`flex-1 md:flex-none text-left p-3.5 border-b border-[#262626] transition-colors cursor-pointer hover:bg-white/2.5 ${docTab === "overview" ? "text-[#e8551f] bg-[#111111]/60 font-semibold border-l-2 border-l-[#e8551f]" : ""}`}
              >
                1. System Overview
              </button>
              <button 
                onClick={() => setDocTab("setup")} 
                className={`flex-1 md:flex-none text-left p-3.5 border-b border-[#262626] transition-colors cursor-pointer hover:bg-white/2.5 ${docTab === "setup" ? "text-[#e8551f] bg-[#111111]/60 font-semibold border-l-2 border-l-[#e8551f]" : ""}`}
              >
                2. Quick Start Stack
              </button>
              <button 
                onClick={() => setDocTab("mcp")} 
                className={`flex-1 md:flex-none text-left p-3.5 border-b border-[#262626] transition-colors cursor-pointer hover:bg-white/2.5 ${docTab === "mcp" ? "text-[#e8551f] bg-[#111111]/60 font-semibold border-l-2 border-l-[#e8551f]" : ""}`}
              >
                3. MCP Connections
              </button>
            </div>

            {/* Doc contents */}
            <div className="flex-1 p-6 text-sm overflow-y-auto max-h-[500px]">
              {docTab === "overview" && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-[#f5f5f0] flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#e8551f]" />
                    Orion Overview
                  </h3>
                  <p className="text-[13px] text-[#a3a29c] leading-relaxed">
                    Orion is a private, local-first RAG (Retrieval-Augmented Generation) system built for industrial operations. It digests messy documents and makes them searchable and queries verifiable.
                  </p>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6b6a64] pt-2">Supported Formats</h4>
                  <ul className="text-xs text-[#a3a29c] list-disc list-inside space-y-1 pl-1">
                    <li><span className="font-semibold text-[#f5f5f0]">Document pages</span>: PDF, HTML, DOCX, PPTX, TXT</li>
                    <li><span className="font-semibold text-[#f5f5f0]">Images & Blueprints</span>: PNG, JPG, JPEG, WEBP</li>
                    <li><span className="font-semibold text-[#f5f5f0]">Media recordings</span>: MP4, MP3, WAV, MKV, AVI</li>
                    <li><span className="font-semibold text-[#f5f5f0]">Data files</span>: EML, MSG</li>
                  </ul>
                </div>
              )}

              {docTab === "setup" && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-[#f5f5f0] flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-[#e8551f]" />
                    Quick Start Guide
                  </h3>
                  <p className="text-[13px] text-[#a3a29c]">
                    Initialize the complete multi-modal indexing stack locally. Ensure you have Docker and Docker Compose installed.
                  </p>
                  
                  {/* Step 1 */}
                  <div className="space-y-1.5 pt-1.5">
                    <span className="text-[11px] font-mono text-[#6b6a64]">STEP 1: REBUILD AND START CONTAINERS</span>
                    <div className="relative group">
                      <pre className="bg-[#161616] border border-[#262626] p-3 rounded-sm font-mono text-xs text-[#f5f5f0] overflow-x-auto">
                        docker compose up --build -d
                      </pre>
                      <button 
                        onClick={() => copyToClipboard("docker compose up --build -d", "Docker command")}
                        className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-white/5 text-muted-foreground transition-all cursor-pointer"
                      >
                        {copiedText === "Docker command" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-[11px] font-mono text-[#6b6a64]">STEP 2: RUN FRONTEND LOCALLY (Alternative Dev path)</span>
                    <div className="relative group">
                      <pre className="bg-[#161616] border border-[#262626] p-3 rounded-sm font-mono text-xs text-[#f5f5f0] overflow-x-auto">
                        npm run build
                      </pre>
                      <button 
                        onClick={() => copyToClipboard("pnpm run dev", "Dev command")}
                        className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-white/5 text-muted-foreground transition-all cursor-pointer"
                      >
                        {copiedText === "Dev command" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {docTab === "mcp" && (
                <div className="space-y-4">
                  <h3 className="text-base font-semibold text-[#f5f5f0] flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#e8551f]" />
                    Model Context Protocol Setup
                  </h3>
                  <p className="text-[13px] text-[#a3a29c] leading-relaxed">
                    Connect your workspace dynamically to local AI agents using the MCP server.
                  </p>

                  <div className="space-y-3 pt-1">
                    {/* Cursor */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#e8551f]" />
                        Cursor Configuration
                      </h4>
                      <ol className="text-[11px] text-[#a3a29c] list-decimal list-inside space-y-1 pl-1">
                        <li>Go to <span className="font-medium text-foreground">Cursor Settings &gt; Models &gt; MCP</span>.</li>
                        <li>Click <span className="font-medium text-foreground">+ Add New MCP Server</span>.</li>
                        <li>Configure: Name: <code className="bg-[#161616] px-1 py-0.5 font-mono text-foreground">Orion</code>, Type: <code className="bg-[#161616] px-1 py-0.5 font-mono text-foreground">sse</code>.</li>
                        <li>Enter Endpoint URL:</li>
                      </ol>
                      <div className="relative group mt-1.5">
                        <pre className="bg-[#161616] border border-[#262626] p-3 rounded-sm font-mono text-xs text-[#f5f5f0] overflow-x-auto">
                          http://localhost:8001/mcp
                        </pre>
                        <button 
                          onClick={() => copyToClipboard("http://localhost:8001/mcp", "Cursor URL")}
                          className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-white/5 text-muted-foreground transition-all cursor-pointer"
                        >
                          {copiedText === "Cursor URL" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Claude Desktop */}
                    <div className="space-y-1.5 pt-3">
                      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#e8551f]" />
                        Claude Desktop Configuration
                      </h4>
                      <p className="text-[11px] text-[#a3a29c] leading-relaxed">
                        Add this JSON configuration block to your local <code className="bg-[#161616] px-1 py-0.5 rounded font-mono text-foreground">claude_desktop_config.json</code> file:
                      </p>
                      <div className="relative group mt-1">
                        <pre className="bg-[#161616] border border-[#262626] p-3.5 rounded-sm font-mono text-xs text-[#f5f5f0] overflow-x-auto">
{`{
  "mcpServers": {
    "orion-rag": {
      "url": "http://localhost:8001/mcp"
    }
  }
}`}
                        </pre>
                        <button 
                          onClick={() => {
                            const configStr = JSON.stringify({
                              mcpServers: {
                                "orion-rag": {
                                  url: "http://localhost:8001/mcp"
                                }
                              }
                            }, null, 2);
                            copyToClipboard(configStr, "Claude Desktop config");
                          }}
                          className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-white/5 text-muted-foreground transition-all cursor-pointer"
                        >
                          {copiedText === "Claude Desktop config" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center py-14 flex-shrink-0">
          <p className="font-mono text-[12px] text-[#e8551f] tracking-widest mb-3.5">[ READY.WHEN.YOU.ARE ]</p>
          <h2 className="text-xl font-semibold mb-5.5 text-[#f5f5f0]">Point Orion at your documents and start asking.</h2>
          <button
            onClick={() => navigate("/dashboard")}
            className="font-mono text-[13px] font-semibold px-4.5 py-2.5 rounded-sm bg-[#f5f5f0] hover:bg-[#e6e6dd] text-[#0a0a0a] cursor-pointer transition-all"
          >
            START_FREE()
          </button>
        </section>

        {/* Footer */}
        <footer className="border-t border-[#262626] py-6 font-mono text-[11px] text-[#6b6a64] flex justify-between flex-shrink-0">
          <span>© 2026 ORION</span>
          <span>BUILT FOR INDUSTRIAL KNOWLEDGE WORK</span>
        </footer>

      </div>
    </div>
  );
}
