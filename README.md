<div align="center">

# OrionRAG

### Hybrid Knowledge Base with Agentic Chat, Citations & Knowledge Graph

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**Upload documents. Ask questions. Get cited answers.**

Orion is a production-grade, hybrid RAG pipeline that combines vector similarity search, hierarchical knowledge graphs, and cross-encoder reranking into a single, high-fidelity retrieval system. Powered by Google Gemini (cloud) or local Ollama (fully offline), it offers page-level document navigation, image/table extraction, and compliance-level citations.

[Features](#features) · [Quick Start](#quick-start) · [Model Recommendations](#model-recommendations) · [Configuration](#configuration) · [MCP Server](#mcp-server)

</div>

---

## Architecture

<div align="center">

![Orion Architecture](showcase/OrionRAG_architecture.png)

</div>

---

## Core Capabilities

*   **Deep Document Parsing (Docling / Marker)**: Parses headings, margins, page boundaries, and tables. Restructures PDF, DOCX, and PPTX files into layout-aware Markdown chunks with structural hierarchy.
*   **Parallel Hybrid Retrieval**: Integrates three retrieval paths: vector search over-fetching (top-20 candidates), LightRAG entity/relationship extraction, and real-time graph traversal.
*   **Cross-Encoder Reranking**: Re-evaluates retrieval candidates using a joint-scoring Cross-Encoder model (`BAAI/bge-reranker-v2-m3`) for high-precision context filtering.
*   **Visual Document Intelligence**: Extracts inline images and tables, automatically captions them using a Vision LLM, and embeds those summaries directly into the chunk vectors to make visual media semantically searchable.
*   **Grounded Citations**: Citations are represented by persistent 4-character inline badges mapping back to original source filenames, exact page numbers, and structural heading paths in the PDF viewer.
*   **Interactive Knowledge Graph**: Generates a 3D-like, force-directed canvas visualizing extracted entities and relationships with real-time panning, zooming, and physics simulation.
*   **Multi-Provider LLM & Thinking**: Support for cloud-based Gemini (2.5-flash, 3.1-flash-lite) and local Ollama (Gemma 4, Qwen 3.5) with native tool calling and extended reasoning panels.

---

## Model Recommendations

| Provider | Model | Setup | Recommendation / Role |
| :--- | :--- | :--- | :--- |
| **Ollama** | `gemma4:e4B` | Local | Best with text and image inputs **Recommended Model** for localy running|
| **Ollama** | `qwen3.5:9b` or `qwen3.5:4b` | Local | Native tool-calling support, fast responses on standard developer machines |
| **Gemini** | `gemini-3.1-flash-lite` | Cloud API | **Recommended default** — high speed, cost-effective, supports level-based thinking |
| **Ollama** | `gemma3:12b` | Local | Robust reasoning, requires prompt-based tool calling fallback |

---

## Quick Start

### Option A: Docker (Full Stack)

```bash
git clone https://github.com/VedAditya-10/OrionRAG.git OrionRAG
cd OrionRAG
cp .env.example .env
# Edit .env and set your model configurations / keys
docker compose up -d
```
*Access the React UI at `http://localhost:5174`.*

### Option B: Local Development

#### 1. Start Postgres & ChromaDB:
```bash
docker compose up postgres chromadb -d
```

#### 2. Run Backend (Python 3.11):
```bash
cd backend
python -m venv venv
# Windows: .\venv\Scripts\activate; Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
# (Optional) For GPU Acceleration on Windows:
# pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124 --force-reinstall
uvicorn app.main:app --port 8080 --reload
```

#### 3. Run Frontend (React/Vite):
```bash
cd frontend
npm install
npm run dev
```

---

## Configuration

Set these keys in your `.env` file to customize hardware allocation and pipeline behavior:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ORION_DOCUMENT_PARSER` | `docling` | Document parser provider: `docling` or `marker` |
| `ORION_EMBEDDING_DEVICE` | `cuda` | Hardware device for embedding (`cuda` or `cpu`) |
| `ORION_RERANKER_DEVICE` | `cpu` | Hardware device for reranking (`cpu` or `cuda`) |
| `ORION_DOCLING_DEVICE` | `cpu` | Hardware device for Docling parsing (`cpu` or `cuda`) |
| `ORION_EMBEDDING_MODEL` | `BAAI/bge-m3` | Embedding model for semantic search (1024-dim) |
| `ORION_RERANKER_MODEL` | `BAAI/bge-reranker-v2-m3` | Cross-encoder model for reranking |
| `ORION_KG_LANGUAGE` | `English` | Extraction language for the LightRAG knowledge graph |

---

## MCP Server

Orion includes a Model Context Protocol (MCP) server that exposes its core retrieval functions:
*   `get_workspace_list`: Retrieves all active knowledge bases.
*   `get_document_by_id`: Fetches document-specific structural metadata.
*   `query`: Performs high-fidelity hybrid queries against active workspaces.

#### Integration
Add Orion's MCP server to Cursor or Claude Desktop as an SSE connection using the URL:
```text
http://localhost:8000/mcp
```

---

⭐ If you find Orion useful, please consider giving it a **star** to support its continued development!
