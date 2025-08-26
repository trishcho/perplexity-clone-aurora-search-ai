# server/app.py

import os, certifi
os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())


from typing import TypedDict, Annotated, Optional
from langgraph.graph import add_messages, StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessageChunk, ToolMessage, SystemMessage
from dotenv import load_dotenv
from langchain_community.tools.tavily_search import TavilySearchResults
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import os
from uuid import uuid4
from langgraph.checkpoint.memory import MemorySaver

load_dotenv()

# ----- Guardrails: check keys early (helps catch silent failures) ------------
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
TAVILY_KEY = os.getenv("TAVILY_API_KEY")
if not OPENAI_KEY:
    print("[WARN] OPENAI_API_KEY not set")
if not TAVILY_KEY:
    print("[WARN] TAVILY_API_KEY not set (web search will fail)")

# ----- LangGraph setup -------------------------------------------------------
memory = MemorySaver()

class State(TypedDict):
    messages: Annotated[list, add_messages]

search_tool = TavilySearchResults(max_results=4)
tools = [search_tool]

# System instruction strongly nudges tool use for current events / facts.
SYSTEM_PROMPT = (
    "You are Perplexity 2.0. For time-sensitive, factual, or news-like questions, "
    "you MUST call the `tavily_search_results_json` tool first, then synthesize a concise answer. "
    "Cite URLs you actually used (short list). If a query is general knowledge, you may answer directly."
)

llm = ChatOpenAI(model="gpt-4o")
llm_with_tools = llm.bind_tools(tools=tools)

async def model(state: State):
    result = await llm_with_tools.ainvoke(state["messages"])
    return {"messages": [result]}

async def tools_router(state: State):
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and len(last.tool_calls) > 0:
        return "tool_node"
    return END

async def tool_node(state):
    tool_calls = state["messages"][-1].tool_calls
    tool_messages = []
    for call in tool_calls:
        name = call["name"]
        args = call["args"]
        call_id = call["id"]

        if name == "tavily_search_results_json":
            try:
                results = await search_tool.ainvoke(args)
                tool_messages.append(
                    ToolMessage(
                        content=json.dumps(results, ensure_ascii=False),
                        tool_call_id=call_id,
                        name=name,
                    )
                )
            except Exception as e:
                # Surface tool error back to the model/context
                tool_messages.append(
                    ToolMessage(
                        content=json.dumps({"error": str(e)}),
                        tool_call_id=call_id,
                        name=name,
                    )
                )
    return {"messages": tool_messages}

graph_builder = StateGraph(State)
graph_builder.add_node("model", model)
graph_builder.add_node("tool_node", tool_node)
graph_builder.set_entry_point("model")
graph_builder.add_conditional_edges("model", tools_router)
graph_builder.add_edge("tool_node", "model")
graph = graph_builder.compile(checkpointer=memory)

# ----- FastAPI + CORS --------------------------------------------------------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # local client
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----- SSE helpers -----------------------------------------------------------
def sse_event(data: dict, event: str | None = None) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    if event:
        return f"event: {event}\ndata: {payload}\n\n"
    return f"data: {payload}\n\n"

def serialize_chunk(chunk: AIMessageChunk) -> str:
    return str(chunk.content)

# ----- Streaming generator ---------------------------------------------------
async def generate_chat_responses(message: str, checkpoint_id: Optional[str] = None):
    # Retry hint for the browser if dropped
    yield "retry: 5000\n\n"

    is_new = checkpoint_id is None
    base_msgs = [SystemMessage(content=SYSTEM_PROMPT), HumanMessage(content=message)]

    if is_new:
        new_checkpoint_id = str(uuid4())
        config = {"configurable": {"thread_id": new_checkpoint_id}}
        events = graph.astream_events({"messages": base_msgs}, version="v2", config=config)
        yield sse_event({"type": "checkpoint", "checkpoint_id": new_checkpoint_id})
    else:
        config = {"configurable": {"thread_id": checkpoint_id}}
        events = graph.astream_events({"messages": base_msgs}, version="v2", config=config)

    async for event in events:
        et = event["event"]

        if et == "on_chat_model_stream":
            chunk_content = serialize_chunk(event["data"]["chunk"])
            if chunk_content:
                yield sse_event({"type": "content", "content": chunk_content})

        elif et == "on_chat_model_end":
            # If the model decided to call a tool, tell the client we’re searching
            output = event["data"]["output"]
            tool_calls = output.tool_calls if hasattr(output, "tool_calls") else []
            if any(c.get("name") == "tavily_search_results_json" for c in tool_calls):
                # Try to pull the query for UI
                query = ""
                for c in tool_calls:
                    if c.get("name") == "tavily_search_results_json":
                        query = c.get("args", {}).get("query", "")
                        break
                yield sse_event({"type": "search_start", "query": query})

        elif et == "on_tool_end" and event.get("name") == "tavily_search_results_json":
            output = event["data"]["output"]
            urls = []
            if isinstance(output, list):
                for item in output:
                    if isinstance(item, dict) and "url" in item:
                        urls.append(item["url"])
            yield sse_event({"type": "search_results", "urls": urls})

        elif et == "on_tool_error" and event.get("name") == "tavily_search_results_json":
            # Surface tool failures to the UI
            err = event["data"].get("error", "Unknown Tavily error")
            yield sse_event({"type": "search_error", "error": str(err)})

    yield sse_event({"type": "end"})

# ----- Route -----------------------------------------------------------------
@app.get("/chat_stream/{message}")
async def chat_stream(message: str, checkpoint_id: Optional[str] = Query(None)):
    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(
        generate_chat_responses(message, checkpoint_id),
        media_type="text/event-stream",
        headers=headers,
    )
