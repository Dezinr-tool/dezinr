"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface Comment {
  id: string;
  title: string;
  description: string;
  priority: string;
  x_percent: number;
  y_percent: number;
  status: string;
  is_manual?: boolean;
  review_state?: string;
}

interface Props {
  reviewId: string;
  stagingUrl: string;
  comments: Comment[];
}

export function ReviewWorkspace({ reviewId, stagingUrl, comments: initialComments }: Props) {
  const [comments, setComments] = useState(initialComments);
  const [scrollTop, setScrollTop] = useState(0);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [commentMode, setCommentMode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleScroll = useCallback(() => {
    const scrollTop = containerRef.current?.scrollTop || 0;
    setScrollTop(scrollTop);
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "scroll", scrollY: scrollTop }, "*"
      );
    } catch (e) {}
  }, []);

  useEffect(() => {
    try {
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    } catch {
      // Prevent mount-time scroll failures from breaking the workspace.
    }
  }, []);

  const getPinTop = (y_percent: number) => (y_percent / 100) * 20000;
  const getPinLeft = (x_percent: number) => (x_percent / 100) * 1440;

  const priorityColor = (priority: string) => {
    if (priority === "must_fix") return "bg-red-500";
    if (priority === "minor") return "bg-orange-400";
    return "bg-blue-500";
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900">
        <div className="text-sm font-medium truncate">{stagingUrl}</div>
        <div className="flex gap-2">
          <a href={stagingUrl} target="_blank" className="text-xs px-3 py-1 rounded border border-zinc-600 hover:bg-zinc-800">View Staging</a>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 px-4 py-1 bg-zinc-900 border-b border-zinc-800 text-xs">
        <span>Total: {comments.length}</span>
        <span className="text-red-400">Must Fix: {comments.filter(c => c.priority === "must_fix").length}</span>
        <span className="text-orange-400">Minor: {comments.filter(c => c.priority === "minor").length}</span>
        <span className="text-blue-400">Suggestions: {comments.filter(c => c.priority === "suggestion").length}</span>
      </div>

      {/* Preview area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-scroll"
        style={{
          position: "relative",
          width: "100%",
          height: "calc(100vh - 90px)",
          overflowY: "scroll",
          overflowX: "hidden",
          background: "white",
          cursor: commentMode ? "crosshair" : "default",
        }}
      >
        <div
          style={{
            width: "1440px",
            transform: "scale(0.75)",
            transformOrigin: "top left",
            height: "20000px",
            position: "relative",
          }}
        >
          <iframe
            ref={iframeRef}
            src={stagingUrl}
            style={{ width: "1440px", height: "20000px", border: "none", display: "block" }}
            title="Site Preview"
          />

          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "1440px",
              height: "20000px",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          >
            {comments.map((comment, index) => {
              const top = getPinTop(comment.y_percent);
              const left = getPinLeft(comment.x_percent);
              return (
                <div
                  key={comment.id}
                  className="absolute"
                  style={{ position: "absolute", top: `${top}px`, left: `${left}px` }}
                >
                  <button
                    onClick={() => setActivePin(activePin === comment.id ? null : comment.id)}
                    style={{
                      position: "absolute",
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "red",
                      color: "white",
                      fontWeight: "bold",
                      pointerEvents: "all",
                      cursor: "pointer",
                      zIndex: 9999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      fontSize: "12px",
                    }}
                  >
                    {index + 1}
                  </button>

                  {/* Chat bubble */}
                  {activePin === comment.id && (
                    <div className="absolute left-10 top-0 w-72 bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl p-3 z-50">
                      <button onClick={() => setActivePin(null)} className="absolute top-2 right-2 text-zinc-400 hover:text-white">✕</button>
                      <div className="text-xs font-bold text-white mb-1">{comment.title}</div>
                      <div className="text-xs text-zinc-300 mb-2">{comment.description}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full text-white ${priorityColor(comment.priority)}`}>
                        {comment.priority}
                      </span>
                      <div className="flex gap-2 mt-3">
                        <button className="text-xs px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-white">✅ Valid</button>
                        <button className="text-xs px-3 py-1 bg-orange-600 hover:bg-orange-500 rounded text-white">✏️ Edit</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Comment button */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button
          onClick={() => setCommentMode(!commentMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all ${commentMode ? "bg-red-500 text-white" : "bg-white text-zinc-900"}`}
        >
          💬 {commentMode ? "Cancel" : "Add Comment"}
        </button>
      </div>
    </div>
  );
}
