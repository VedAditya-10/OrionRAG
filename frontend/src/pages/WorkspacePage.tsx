import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataPanel } from "@/components/rag/DataPanel";
import { ChatPanel } from "@/components/rag/ChatPanel";
import { VisualPanel } from "@/components/rag/VisualPanel";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useWorkspace, useUpdateWorkspace } from "@/hooks/useWorkspaces";
import { api } from "@/lib/api";
import type { Document, RAGStats, DocumentStatus, UpdateWorkspace } from "@/types";

const PROCESSING_STATUSES = new Set<DocumentStatus>([
  "parsing",
  "indexing",
  "processing",
]);

export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const wsId = workspaceId ? Number(workspaceId) : null;

  // -- Workspace data --
  const { data: workspace } = useWorkspace(wsId);
  const updateWorkspace = useUpdateWorkspace();

  // -- Store --
  const { selectedDoc, selectDoc, reset: resetStore } = useWorkspaceStore();

  // -- Resizing State & Persistence --
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = localStorage.getItem("orion-left-panel-width");
    return saved ? parseInt(saved, 10) : 280;
  });

  const [middleWidth, setMiddleWidth] = useState(() => {
    const saved = localStorage.getItem("orion-middle-panel-width");
    return saved ? parseInt(saved, 10) : 600;
  });

  // Reset store when switching between workspaces
  useEffect(() => {
    resetStore();
  }, [workspaceId, resetStore]);

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ["documents", workspaceId],
    queryFn: () =>
      api.get<Document[]>(`/documents/workspace/${workspaceId}`),
    enabled: !!workspaceId,
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (docs?.some((d) => PROCESSING_STATUSES.has(d.status))) return 3000;
      return false;
    },
  });

  const { data: ragStats } = useQuery({
    queryKey: ["rag-stats", workspaceId],
    queryFn: () => api.get<RAGStats>(`/rag/stats/${workspaceId}`),
    enabled: !!workspaceId,
  });

  // -----------------------------------------------------------------------
  // Refresh ragStats when processing finishes
  // -----------------------------------------------------------------------
  const processingCount = useMemo(
    () =>
      documents?.filter((d) => PROCESSING_STATUSES.has(d.status)).length ?? 0,
    [documents]
  );

  const prevProcessingRef = useRef(processingCount);
  useEffect(() => {
    if (prevProcessingRef.current > 0 && processingCount === 0) {
      queryClient.invalidateQueries({ queryKey: ["rag-stats", workspaceId] });
    }
    prevProcessingRef.current = processingCount;
  }, [processingCount, queryClient, workspaceId]);

  // Keep selectedDoc in sync with latest document data
  useEffect(() => {
    if (selectedDoc && documents) {
      const updated = documents.find((d) => d.id === selectedDoc.id);
      if (updated && updated.status !== selectedDoc.status) {
        selectDoc(updated);
      }
    }
  }, [documents, selectedDoc, selectDoc]);

  const hasIndexedDocs = (ragStats?.indexed_documents ?? 0) > 0;
  const hasDeepragDocs = (ragStats?.orion_documents ?? 0) > 0;

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------
  const uploadDoc = useMutation({
    mutationFn: ({ file, customMetadata }: { file: File, customMetadata?: {key: string, value: string}[] }) =>
      api.uploadFile<Document>(`/documents/upload/${workspaceId}`, file, customMetadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["rag-stats", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Document uploaded successfully");
    },
    onError: () => toast.error("Failed to upload document"),
  });

  const deleteDoc = useMutation({
    mutationFn: (docId: number) => api.delete(`/documents/${docId}`),
    onSuccess: (_, docId) => {
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["rag-stats", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      if (selectedDoc?.id === docId) selectDoc(null);
      toast.success("Document deleted");
    },
    onError: () => toast.error("Failed to delete document"),
  });

  const processDoc = useMutation({
    mutationFn: (docId: number) => api.post(`/rag/process/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["rag-stats", workspaceId] });
      toast.info("Analyzing document...", {
        description: "Parsing content and building search index.",
      });
    },
    onError: (error: Error) => {
      if (error.message?.includes("already being analyzed")) {
        toast.info("Document is already being analyzed", {
          description: "Please wait for the current analysis to complete.",
        });
        // Refresh to get latest status
        queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      } else {
        toast.error("Failed to start analysis");
      }
    },
  });

  const reindexDoc = useMutation({
    mutationFn: (docId: number) => api.post(`/rag/reindex/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["rag-stats", workspaceId] });
      toast.success("Document re-processing started");
    },
    onError: () => toast.error("Failed to re-process document"),
  });

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const handleSelectDoc = useCallback(
    (doc: Document) => {
      if (doc.status !== "indexed") return;
      if (selectedDoc?.id === doc.id) {
        selectDoc(null);
      } else {
        selectDoc(doc);
      }
    },
    [selectedDoc, selectDoc]
  );

  const handleUpdateWorkspace = useCallback(
    async (data: UpdateWorkspace) => {
      if (!wsId) return;
      await updateWorkspace.mutateAsync({ id: wsId, data });
    },
    [wsId, updateWorkspace]
  );

  // -----------------------------------------------------------------------
  // Resizing Handlers (Pointer Event API)
  // -----------------------------------------------------------------------
  const handleLeftPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleLeftPointerMove = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      setLeftWidth(newWidth);
    }
  };

  const handleLeftPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    localStorage.setItem("orion-left-panel-width", leftWidth.toString());
  };

  const handleMiddlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleMiddlePointerMove = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
      const totalWidth = window.innerWidth;
      const proposedMiddleWidth = e.clientX - leftWidth;
      const maxProposedMiddle = totalWidth - leftWidth - 300; // Keep at least 300px for the right panel
      const newWidth = Math.max(300, Math.min(maxProposedMiddle, Math.min(1000, proposedMiddleWidth)));
      setMiddleWidth(newWidth);
    }
  };

  const handleMiddlePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    localStorage.setItem("orion-middle-panel-width", middleWidth.toString());
  };

  // -----------------------------------------------------------------------
  // Render — Resizable 3-column flex layout
  // -----------------------------------------------------------------------
  return (
    <div className="h-full overflow-hidden flex flex-row w-full bg-background">
      {/* Column 1: Data Area */}
      <div style={{ width: leftWidth }} className="flex-shrink-0 h-full">
        <DataPanel
          workspace={workspace}
          documents={documents}
          docsLoading={docsLoading}
          ragStats={ragStats}
          selectedDocId={selectedDoc?.id ?? null}
          onSelectDoc={handleSelectDoc}
          onUpload={(file, customMetadata) => uploadDoc.mutate({ file, customMetadata })}
          isUploading={uploadDoc.isPending}
          onDelete={(id) => deleteDoc.mutate(id)}
          onProcess={(id) => processDoc.mutate(id)}
          onReindex={(id) => reindexDoc.mutate(id)}
          isProcessing={processDoc.isPending}
          onUpdateWorkspace={handleUpdateWorkspace}
        />
      </div>

      {/* Left Resizer bar */}
      <div
        className="w-1.5 -mx-[3px] z-50 h-full cursor-col-resize hover:bg-primary/80 active:bg-primary transition-colors flex-shrink-0 select-none touch-none"
        onPointerDown={handleLeftPointerDown}
        onPointerMove={handleLeftPointerMove}
        onPointerUp={handleLeftPointerUp}
      />

      {/* Column 2: Chat Area */}
      <div style={{ width: middleWidth }} className="flex-shrink-0 h-full">
        <ChatPanel
          workspaceId={workspaceId || ""}
          hasIndexedDocs={hasIndexedDocs}
          workspace={workspace ?? null}
        />
      </div>

      {/* Middle Resizer bar */}
      <div
        className="w-1.5 -mx-[3px] z-50 h-full cursor-col-resize hover:bg-primary/80 active:bg-primary transition-colors flex-shrink-0 select-none touch-none"
        onPointerDown={handleMiddlePointerDown}
        onPointerMove={handleMiddlePointerMove}
        onPointerUp={handleMiddlePointerUp}
      />

      {/* Column 3: Visual Area */}
      <div className="flex-grow min-w-[300px] h-full overflow-hidden">
        <VisualPanel
          workspaceId={workspaceId || ""}
          hasDeepragDocs={hasDeepragDocs}
        />
      </div>
    </div>
  );
}
