"""
LangGraph workflow: wires the pipeline nodes into a compiled graph.
"""
from langgraph.graph import StateGraph, END

from graph.state import DocumentState
from graph.nodes import (
    preprocess_node,
    classify_node,
    memory_retrieval_node,
    rag_retrieval_node,
    extraction_node,
    validation_node,
    output_node,
)


def build_graph():
    g = StateGraph(DocumentState)

    g.add_node("preprocess", preprocess_node)
    g.add_node("classify", classify_node)
    g.add_node("memory_retrieval", memory_retrieval_node)
    g.add_node("rag_retrieval", rag_retrieval_node)
    g.add_node("extraction", extraction_node)
    g.add_node("validation", validation_node)
    g.add_node("output", output_node)

    g.set_entry_point("preprocess")
    g.add_edge("preprocess", "classify")
    g.add_edge("classify", "memory_retrieval")
    g.add_edge("memory_retrieval", "rag_retrieval")
    g.add_edge("rag_retrieval", "extraction")
    g.add_edge("extraction", "validation")
    g.add_edge("validation", "output")
    g.add_edge("output", END)

    return g.compile()


# Singleton compiled graph
_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
