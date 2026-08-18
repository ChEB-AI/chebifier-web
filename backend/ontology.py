"""The ChEBI graph the API serves its class names and hierarchy from.

This module used to be called `chebi_utils`, which now shadows the installed `chebi_utils`
package that chebifier itself imports - hence the rename.
"""

import os

from app import app
from chebi_utils.obo_extractor import get_hierarchy_subgraph
from chebifier.utils import load_chebi_graph

_local_graph = app.config.get("CHEBI_GRAPH")
if _local_graph and not os.path.exists(_local_graph):
    print(f"ChEBI graph {_local_graph} not found, downloading it from Hugging Face...")
    _local_graph = None

# the full graph carries non-subsumption relations (has role, conjugate acid/base, ...) and is
# what the predictors expect; the hierarchy is the is-a subgraph of it
CHEBI_GRAPH = load_chebi_graph(_local_graph)
CHEBI_HIERARCHY = get_hierarchy_subgraph(CHEBI_GRAPH)

# ChEBI's "molecular entity", the class every other class here descends from. The graph starts
# below it, so it is not a node of its own and can never be predicted - which is the point: it
# holds for every molecule, and saying so carries no information.
MOLECULAR_ENTITY = "23367"
MOLECULAR_ENTITY_NAME = "molecular entity"


def class_name(chebi_id: str) -> str:
    node = CHEBI_GRAPH.nodes.get(chebi_id)
    if node is None or not node.get("name"):
        return f"CHEBI:{chebi_id}"
    return node["name"]


def most_specific(predicted_classes: list[str]) -> list[str]:
    """The predicted classes that have no predicted subclass, i.e. the lowest classes the
    prediction reaches in the hierarchy."""
    predicted = [cls for cls in predicted_classes if cls in CHEBI_HIERARCHY]
    subgraph = CHEBI_HIERARCHY.subgraph(predicted)
    # is-a edges point from child to parent, so the predecessors of a class are its subclasses
    return [cls for cls in predicted if not any(True for _ in subgraph.predecessors(cls))]


def _in_hierarchy(classes) -> list[str]:
    return [cls for cls in classes if cls in CHEBI_HIERARCHY and cls != MOLECULAR_ENTITY]


def to_vis_graph(predicted_classes: list[str], near_misses=()) -> dict:
    """The predicted classes as a vis.js graph: their is-a hierarchy below the top class.

    Edges point from a class to its superclass, as they do in ChEBI. Every class without a
    superclass in the graph is hung under `MOLECULAR_ENTITY`, which gives the hierarchy a single
    root to grow from.

    Near misses - classes that came close to being predicted but stayed below the threshold - are
    marked as such, so the frontend can leave them out until they are asked for.
    """
    predicted = _in_hierarchy(predicted_classes)
    near = [cls for cls in _in_hierarchy(near_misses) if cls not in set(predicted)]
    classes = predicted + near
    subgraph = CHEBI_HIERARCHY.subgraph(classes)
    edges = [list(edge) for edge in subgraph.edges]
    edges += [[cls, MOLECULAR_ENTITY] for cls in classes if subgraph.out_degree(cls) == 0]
    nodes = {cls: {"name": class_name(cls)} for cls in predicted}
    nodes.update({cls: {"name": class_name(cls), "near_miss": True} for cls in near})
    nodes[MOLECULAR_ENTITY] = {"name": MOLECULAR_ENTITY_NAME, "root": True}
    return {"nodes": nodes, "edges": edges}
