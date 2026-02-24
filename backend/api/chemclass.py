import copy
import os
import sys

from flask_restful import Resource, reqparse
from PIL import Image
import base64
import io
from app import app
import matplotlib as mpl
import networkx as nx
from rdkit import Chem
from rdkit.Chem.Draw import rdMolDraw2D
import torch
from chebi_utils import CHEBI_FRAGMENT
import hashlib

from chebifier.ensemble.weighted_majority_ensemble import WMVwithF1Ensemble

mpl.use("Agg")

if torch.cuda.is_available():
    device = "cuda"
else:
    device = "cpu"

ENSEMBLE = WMVwithF1Ensemble(app.config["MODELS"])


def _build_node(ident, node, include_labels=True):
    d = dict(id=ident,
             color="#EEEEEC" if node.get("artificial") else "#729FCF")
    d["title"] = node["lbl"]
    if include_labels:
        d["label"] = node["lbl"]

    return d


def nx_to_graph(g: nx.Graph, colors=None):
    results = {
        "nodes": {n: g.nodes[n] for n in g.nodes},
        "edges": [edge for edge in g.edges() if "label" in g.get_edge_data(edge[0], edge[1])],
    }
    if colors is not None:
        results["node_colors"] = dict()
        for node, color in colors.items():
            if node in results["nodes"]:
                results["node_colors"][node] = color
    return results


class ModelInfoAPI(Resource):

    def get(self):
        return {
            "available_models": [model.model_name for model in ENSEMBLE.models],
            "available_models_info_texts": [model.info_text for model in ENSEMBLE.models]
        }


def verify_disjointness(predicted_classes):
    disjoints = []
    with open(os.path.join("data", "disjoint_chebi.csv")) as f:
        for line in f:
            disjoints.append([f"CHEBI:{i}" for i in line.strip().split(",")])
    with open(os.path.join("data", "disjoint_additional.csv")) as f:
        for line in f:
            disjoints.append([f"CHEBI:{i}" for i in line.strip().split(",")])
    violations = []
    for sample in predicted_classes:
        violations_sample = []
        for disjoint in disjoints:
            if all(cls in sample for cls in disjoint):
                violations_sample.append(disjoint)
        violations.append(violations_sample)
    return violations


class BatchPrediction(Resource):
    def post(self):
        """
        Accepts a dictionary with the following structure
        {
            "smiles": [ ... list of smiles strings]
            "ontology": bool (Optional)
        }
        :return:
        A dictionary with the following structure
        {
            "predicted_parents": [ ... [... parent classes as predicted by the system] or None for each smiles ],
            "direct_parents": [ ... [... lowest possible predicted parents] or None for each smiles ] or None
            "ontology": Only returned if `ontology` is set. Returns a vis.js conform representation of the ontology containing all predicted classes.
        }

        If the system is unable to parse any smiles string, the respective entry in each list will be `None`.
        """
        parser = reqparse.RequestParser()
        parser.add_argument("smiles", type=str, action="append")
        parser.add_argument("ontology", type=bool, required=False, default=False)
        parser.add_argument("selectedModels", type=dict)
        args = parser.parse_args()
        smiles = args["smiles"]
        generate_ontology = args["ontology"]
        selected_models = args["selectedModels"]

        if not smiles or len(smiles) == 0:
            result = {
                "predicted_parents": [],
                "direct_parents": [],
                "violations": []
            }
            if generate_ontology:
                result["ontology"] = []
            return result

        ensemble_models = ENSEMBLE.models
        try:
            ENSEMBLE.models = [model for model in ensemble_models if
                               model.model_name in selected_models and selected_models[model.model_name]]
            all_predicted, intermediate_results = ENSEMBLE.predict_smiles_list(smiles, return_intermediate_results=True)
        finally:
            ENSEMBLE.models = ensemble_models  # restore original model list

        graphs_per_smiles = [CHEBI_FRAGMENT.subgraph(predicted) if predicted is not None else None for predicted in all_predicted]

        direct_parents = []
        for smiles_idx in range(len(all_predicted)):
            graph = graphs_per_smiles[smiles_idx]
            if graph is None:
                direct_parents.append(None)
                continue
            direct_parents_for_smiles = []
            for cls in all_predicted[smiles_idx]:
                cls_idx = intermediate_results["predicted_classes"][cls]
                if any(parent in graph.nodes for parent in graph.successors(cls)):
                    continue
                calculations = dict()
                for model_idx, model in enumerate([model for model in ensemble_models if
                               model.model_name in selected_models and selected_models[model.model_name]]):
                    pos_prediction = intermediate_results["positive_mask"][smiles_idx, cls_idx, model_idx]
                    neg_prediction = intermediate_results["negative_mask"][smiles_idx, cls_idx, model_idx]
                    # skip models that made no prediction
                    if pos_prediction or neg_prediction:
                        confidence = intermediate_results["confidence"][smiles_idx, cls_idx, model_idx]
                        trust = intermediate_results["classwise_weights"][0 if pos_prediction else 1][cls_idx, model_idx].item() / model.model_weight
                        calculations[model.model_name] = {
                            "prediction": pos_prediction.item(),
                            "confidence": confidence.item(),
                            # select either trust for positive or negative predictions
                            "trust": trust,
                            "model_weight": model.model_weight,
                            "model_score": (-1 if neg_prediction else 1) * confidence.item() * trust * model.model_weight,
                        }
                net_score = intermediate_results["net_score"][smiles_idx, cls_idx].item()
                direct_parents_for_smiles.append((cls, graph.nodes[cls]["name"], calculations, net_score))
            direct_parents.append(direct_parents_for_smiles)

        result = {
            "predicted_parents": all_predicted,
            "direct_parents": direct_parents,
        }
        if generate_ontology:
            result["ontology"] = [nx_to_graph(g) if g is not None else None for g in graphs_per_smiles],

        return result

class PredictionDetailApiHandler(Resource):

    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument("type", type=str, required=False, default="type")  # can be used to specify different types of requests in the future
        parser.add_argument("smiles", type=str)
        parser.add_argument("selectedModels", type=dict)

        args = parser.parse_args()
        # note, the post req from frontend needs to match the strings here (e.g. 'type and 'message')
        request_type = args["type"]
        smiles = args["smiles"]
        selected_models = args["selectedModels"]

        explain_infos = {"models": dict()}
        do_models = [model for model in ENSEMBLE.models if model.model_name in selected_models and selected_models[model.model_name]]

        for model in do_models:
            explain_infos_model = model.explain_smiles(smiles)
            if explain_infos_model is not None:
                explain_infos_model["model_type"] = model.__class__.__name__
                explain_infos_model["model_info"] = model.info_text
                explain_infos["models"][model.model_name] = explain_infos_model

        return explain_infos
