"use client";

import Header from "@/components/Header";
import InputBar from "@/components/InputBar";
import MessageArea from "@/components/MessageArea";
import React, { useState } from "react";

interface SearchInfo {
  stages: string[];
  query: string;
  urls: string[];
}

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  type: string;
  isLoading?: boolean;
  searchInfo?: SearchInfo;
}

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, content: "Hi there, how can I help you?", isUser: false, type: "message" },
  ]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [checkpointId, setCheckpointId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const newMessageId = messages.length > 0 ? Math.max(...messages.map((m) => m.id)) + 1 : 1;

    setMessages((prev) => [
      ...prev,
      { id: newMessageId, content: currentMessage, isUser: true, type: "message" },
    ]);

    const userInput = currentMessage;
    setCurrentMessage("");

    try {
      const aiResponseId = newMessageId + 1;

      setMessages((prev) => [
        ...prev,
        {
          id: aiResponseId,
          content: "",
          isUser: false,
          type: "message",
          isLoading: true,
          searchInfo: { stages: [], query: "", urls: [] },
        },
      ]);

      let url = `/api/chat_stream/${encodeURIComponent(userInput)}`;
      if (checkpointId) url += `?checkpoint_id=${encodeURIComponent(checkpointId)}`;

      const eventSource = new EventSource(url);
      let streamedContent = "";
      let searchData: any = null;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "checkpoint") {
            setCheckpointId(data.checkpoint_id);
          } else if (data.type === "content") {
            streamedContent += data.content;
            setMessages((prev) =>
              prev.map((m) => (m.id === aiResponseId ? { ...m, content: streamedContent, isLoading: false } : m))
            );
          } else if (data.type === "search_start") {
            const newSearchInfo = { stages: ["searching"], query: data.query, urls: [] };
            searchData = newSearchInfo;
            setMessages((prev) =>
              prev.map((m) => (m.id === aiResponseId ? { ...m, content: streamedContent, searchInfo: newSearchInfo, isLoading: false } : m))
            );
          } else if (data.type === "search_results") {
            const urls = typeof data.urls === "string" ? JSON.parse(data.urls) : data.urls;
            const newSearchInfo = {
              stages: searchData ? [...searchData.stages, "reading"] : ["reading"],
              query: searchData?.query || "",
              urls,
            };
            searchData = newSearchInfo;
            setMessages((prev) =>
              prev.map((m) => (m.id === aiResponseId ? { ...m, content: streamedContent, searchInfo: newSearchInfo, isLoading: false } : m))
            );
          } else if (data.type === "search_error") {
            const newSearchInfo = {
              stages: searchData ? [...searchData.stages, "error"] : ["error"],
              query: searchData?.query || "",
              error: data.error,
              urls: [],
            };
            searchData = newSearchInfo;
            setMessages((prev) =>
              prev.map((m) => (m.id === aiResponseId ? { ...m, content: streamedContent, searchInfo: newSearchInfo, isLoading: false } : m))
            );
          } else if (data.type === "end") {
            if (searchData) {
              const finalSearchInfo = { ...searchData, stages: [...searchData.stages, "writing"] };
              setMessages((prev) =>
                prev.map((m) => (m.id === aiResponseId ? { ...m, searchInfo: finalSearchInfo, isLoading: false } : m))
              );
            }
            eventSource.close();
          }
        } catch (err) {
          console.error("Error parsing event data:", err, event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        if (!streamedContent) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiResponseId
                ? { ...m, content: "Sorry, there was an error processing your request.", isLoading: false }
                : m
            )
          );
        }
      };

      eventSource.addEventListener("end", () => eventSource.close());
    } catch (err) {
      console.error("Error setting up EventSource:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: newMessageId + 1,
          content: "Sorry, there was an error connecting to the server.",
          isUser: false,
          type: "message",
          isLoading: false,
        },
      ]);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-100 flex flex-col">
      {/* fixed-height header at top */}
      <Header />

      {/* fills the rest of the screen; no page scroll */}
      <main className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-5xl px-4 py-4">
          {/* chat card occupies full available height; only messages scroll */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 h-full flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <MessageArea messages={messages} />
            </div>
            <div className="border-t border-gray-100">
              <InputBar
                currentMessage={currentMessage}
                setCurrentMessage={setCurrentMessage}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;
