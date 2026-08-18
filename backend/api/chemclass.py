import copy
import csv
import math
import os

import matplotlib as mpl
import torch
from app import app
from flask_restful import Resource, reqparse

from api.ensemble import DEFAULT_MODEL_WEIGHT, WeightedWMVF1Ensemble
from chebifier.inconsistency_resolution import ScoreBasedPredictionSmoother
from chebifier.model_registry import MODEL_TYPES
from chebifier.predict import (
    apply_inconsistency_resolution,
    collect_base_learner_predictions,
    get_base_learner_predictions,
)
from chebi_utils.read_molecule import smiles_or_inchi_to_mol
from chebifier.utils import _smiles_to_mol, get_disjoint_files
from ontology import CHEBI_GRAPH, class_name, most_specific, to_vis_graph
from rdkit import Chem

mpl.use("Agg")

MODEL_CONFIG = app.config["MODELS"]


def build_models():
    models = {}
    for model_name, config in MODEL_CONFIG.items():
        config = dict(config)
        model_type = config.pop("type")
        config.pop("calibration_name", None)
        print(f"Building {model_name} ({model_type})...")
        models[model_name] = MODEL_TYPES[model_type](
            model_name, **config, chebi_graph=CHEBI_GRAPH
        )
    return models


def read_ensemble_classes():
    """The classes the ensemble was calibrated on.

    The class-wise F1 scores of the calibration are stored as one value per class, so the ensemble
    can only run on exactly this class list - and in this order.
    """
    with open(app.config["ENSEMBLE_CLASSES"], "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip()]


class CachedSmoother(ScoreBasedPredictionSmoother):
    """Inconsistency resolution for a fixed class list.

    Setting the label names walks the ChEBI hierarchy once per class to build the transitive
    subsumption matrix, which takes far too long to redo on every request.
    """

    def set_label_names(self, label_names):
        if label_names is not None and label_names == getattr(self, "label_names", None):
            return
        super().set_label_names(label_names)


MODELS = build_models()
DEFAULT_MODEL_WEIGHTS = {
    model_name: config.get("model_weight", DEFAULT_MODEL_WEIGHT)
    for model_name, config in MODEL_CONFIG.items()
}
ENSEMBLE = WeightedWMVF1Ensemble(
    app.config["ENSEMBLE_DIR"],
    calibration_names={
        model_name: config.get("calibration_name", model_name)
        for model_name, config in MODEL_CONFIG.items()
    },
    model_weights=DEFAULT_MODEL_WEIGHTS,
)
ENSEMBLE_CLASSES = read_ensemble_classes()
CLASS_INDEX = {cls: idx for idx, cls in enumerate(ENSEMBLE_CLASSES)}
DECISION_THRESHOLD = ENSEMBLE.decision_threshold
SMOOTHER = (
    CachedSmoother(
        chebi_graph=CHEBI_GRAPH,
        label_names=ENSEMBLE_CLASSES,
        disjoint_files=get_disjoint_files(),
        threshold=DECISION_THRESHOLD,
    )
    if app.config["INCONSISTENCY_RESOLUTION"] == "score-based"
    else None
)
def read_operating_points():
    """The measured precision/recall of the ensemble at a range of decision thresholds.

    This is what lets a user ask for "more precision" instead of naming a threshold: each row is an
    operating point the ensemble was actually evaluated at, so the number the slider shows was
    measured rather than promised. Without the file the operating point stays fixed.
    """
    path = app.config.get("PR_CURVE")
    if not path or not os.path.exists(path):
        print(f"No precision/recall curve at {path}, the decision threshold stays fixed.")
        return []
    with open(path, "r", encoding="utf-8") as f:
        rows = [
            {
                "threshold": float(row["threshold"]),
                "precision": float(row["full_micro_precision"]),
                "recall": float(row["full_micro_recall"]),
            }
            for row in csv.DictReader(f)
        ]
    rows.sort(key=lambda row: row["threshold"])
    print(f"Loaded {len(rows)} operating points from {path}.")
    return rows


OPERATING_POINTS = read_operating_points()


def requested_threshold(threshold):
    """A threshold from the request, clamped to the range the ensemble was evaluated over."""
    if threshold is None or not OPERATING_POINTS:
        return DECISION_THRESHOLD
    try:
        threshold = float(threshold)
    except (TypeError, ValueError):
        return DECISION_THRESHOLD
    return min(
        max(threshold, OPERATING_POINTS[0]["threshold"]),
        OPERATING_POINTS[-1]["threshold"],
    )


# Classes that came close to being predicted are offered alongside the prediction. "Close" is a
# fraction of the ensemble's own operating point, so it follows the threshold if that ever moves.
NEAR_MISS_FRACTION = 0.5
NEAR_MISS_LIMIT = 10

print(
    f"Ensemble ready: {len(MODELS)} models, {len(ENSEMBLE_CLASSES)} classes, "
    f"decision threshold {DECISION_THRESHOLD}."
)


def selected_model_names(selected_models):
    """The models to run, in configuration order. Without a selection, the whole ensemble runs."""
    if not selected_models:
        return list(MODELS)
    return [name for name in MODELS if selected_models.get(name)]


def requested_weights(model_weights):
    if not model_weights:
        return None
    weights = {}
    for model_name, weight in model_weights.items():
        if model_name in MODELS:
            try:
                weights[model_name] = max(0.0, float(weight))
            except (TypeError, ValueError):
                continue
    return weights


def jsonable(value):
    """JSON has no NaN, and a base learner that did not cover a class reports exactly that."""
    value = float(value)
    return None if math.isnan(value) else value


def to_smiles(molecule):
    """The SMILES string the models are run on, or None if RDKit cannot read the input.

    Inputs may be SMILES or InChI. A SMILES string is passed on as it was written - canonicalising
    it would hand the models a different molecule representation than the user asked about - while
    an InChI has to be translated, since the base learners only take SMILES.
    """
    if not molecule:
        return None
    if molecule.startswith("InChI="):
        mol = smiles_or_inchi_to_mol(molecule)
        return None if mol is None else Chem.MolToSmiles(mol)
    return molecule if _smiles_to_mol(molecule) is not None else None


def readable_rows(molecules):
    """The inputs RDKit can read, as (index, SMILES) pairs.

    Not every base learner reports an unreadable molecule as "no prediction" - C3P, for one,
    answers "no" for each of its classes - so the ensemble would report an empty classification
    rather than a failure. Sorting them out here also keeps them out of the models entirely.
    """
    resolved = [to_smiles(molecule) for molecule in molecules]
    return resolved, [
        index for index, smiles in enumerate(resolved) if smiles is not None
    ]


def near_miss_classes(aggregated, row, threshold):
    """The highest scoring classes that stayed below the decision threshold.

    Only classes some model actually covered can be near misses - a class no model said anything
    about sits at the neutral score, which is not a near miss but an absence of evidence.
    """
    scores = aggregated["net_score"][row]
    candidates = (
        ~aggregated["class_decisions"][row]
        & aggregated["has_valid_predictions"][row]
        & (scores > threshold * NEAR_MISS_FRACTION)
    )
    class_indices = torch.nonzero(candidates).flatten()
    if class_indices.numel() == 0:
        return []
    ranked = class_indices[
        torch.argsort(scores[class_indices], descending=True)[:NEAR_MISS_LIMIT]
    ]
    return [ENSEMBLE_CLASSES[class_idx] for class_idx in ranked.tolist()]


def run_ensemble(smiles_list, selected_models, model_weights, threshold, resolve=True):
    """Base learner predictions, ensemble aggregation and inconsistency resolution for a batch of
    SMILES strings. Returns the per-model predictions alongside the aggregated result."""
    models = {name: MODELS[name] for name in selected_model_names(selected_models)}
    if not models:
        raise ValueError("No models selected.")
    predictions = get_base_learner_predictions(models, smiles_list)
    predictions, _ = collect_base_learner_predictions(
        predictions, classes=ENSEMBLE_CLASSES
    )
    aggregated = ENSEMBLE.with_weights(model_weights).predict(
        predictions, attribution=True
    )
    if SMOOTHER is not None and resolve:
        smoother = SMOOTHER
        if threshold != SMOOTHER.threshold:
            # the smoother compares scores against the operating point, so it has to move with it -
            # on a copy, since requests can overlap
            smoother = copy.copy(SMOOTHER)
            smoother.threshold = threshold
        aggregated = apply_inconsistency_resolution(
            smoother,
            ENSEMBLE_CLASSES,
            aggregated,
            decision_threshold=threshold,
        )
    aggregated["class_decisions"] = (
        aggregated["net_score"] > threshold
    ) & aggregated["has_valid_predictions"]
    aggregated["complete_failure"] = torch.all(
        ~aggregated["has_valid_predictions"], dim=1
    )
    return predictions, aggregated


class ModelInfoAPI(Resource):

    def get(self):
        return {
            "available_models": list(MODELS),
            "available_models_info_texts": [
                model.info_text for model in MODELS.values()
            ],
            "default_model_weights": DEFAULT_MODEL_WEIGHTS,
            "decision_threshold": DECISION_THRESHOLD,
            "operating_points": OPERATING_POINTS,
            "n_classes": len(ENSEMBLE_CLASSES),
        }


class BatchPrediction(Resource):
    def post(self):
        """
        Accepts a dictionary with the following structure
        {
            "smiles": [ ... list of SMILES or InChI strings],
            "ontology": bool (Optional),
            "selectedModels": {model name: bool} (Optional),
            "modelWeights": {model name: number} (Optional, overrides the configured weights),
            "decisionThreshold": number (Optional, overrides the ensemble's operating point),
            "resolveInconsistencies": bool (Optional, default true - resolve predictions that
                contradict the ChEBI hierarchy or its disjointness axioms)
        }
        :return:
        A dictionary with the following structure
        {
            "predicted_parents": [ ... [... parent classes as predicted by the system] or None for each input ],
            "direct_parents": [ ... [... lowest predicted parents, each as [ChEBI id, name]]
                or None for each input ],
            "explanations": [ ... {ChEBI id: {name, score, models: {model: {prediction,
                attribution, vote}}}} for every predicted class, or None for each input ],
            "smiles": [ ... the SMILES string each input was read as (an InChI is translated) ],
            "ontology": Only returned if `ontology` is set. Returns a vis.js conform representation
                of the ontology containing all predicted classes.
        }

        If the system is unable to parse an input, the respective entry in each list will be `None`.
        """
        parser = reqparse.RequestParser()
        parser.add_argument("smiles", type=str, action="append")
        parser.add_argument("ontology", type=bool, required=False, default=False)
        parser.add_argument("selectedModels", type=dict, required=False, default=None)
        parser.add_argument("modelWeights", type=dict, required=False, default=None)
        parser.add_argument("decisionThreshold", type=float, required=False, default=None)
        parser.add_argument(
            "resolveInconsistencies", type=bool, required=False, default=True
        )
        args = parser.parse_args()
        smiles = args["smiles"]
        generate_ontology = args["ontology"]
        threshold = requested_threshold(args["decisionThreshold"])

        if not smiles or len(smiles) == 0:
            result = {
                "decision_threshold": threshold,
                "predicted_parents": [],
                "direct_parents": [],
                "explanations": [],
                "smiles": [],
            }
            if generate_ontology:
                result["ontology"] = []
            return result

        resolved_smiles, rows = readable_rows(smiles)
        # without a single model there is nothing to predict with, so every input "fails"
        if not selected_model_names(args["selectedModels"]):
            rows = []
        if rows:
            predictions, aggregated = run_ensemble(
                [resolved_smiles[index] for index in rows],
                args["selectedModels"],
                requested_weights(args["modelWeights"]),
                threshold,
                args["resolveInconsistencies"],
            )
            model_names = list(predictions)
            attribution = aggregated["attribution"]
            positive = aggregated["positive_mask"]
            negative = aggregated["negative_mask"]
        row_of = {smiles_idx: row for row, smiles_idx in enumerate(rows)}

        predicted_parents, direct_parents, ontologies, explanations = [], [], [], []
        for smiles_idx in range(len(smiles)):
            row = row_of.get(smiles_idx)
            if row is None or aggregated["complete_failure"][row]:
                predicted_parents.append(None)
                direct_parents.append(None)
                ontologies.append(None)
                explanations.append(None)
                continue
            decisions = aggregated["class_decisions"][row]
            predicted = [
                ENSEMBLE_CLASSES[class_idx]
                for class_idx in torch.nonzero(decisions).flatten().tolist()
            ]
            near_misses = near_miss_classes(aggregated, row, threshold)
            predicted_parents.append(predicted)
            ontologies.append(
                to_vis_graph(predicted, near_misses) if generate_ontology else None
            )

            direct_parents.append([[cls, class_name(cls)] for cls in most_specific(predicted)])

            explanations_for_smiles = {}
            for cls in predicted + near_misses:
                class_idx = CLASS_INDEX[cls]
                models = {}
                for model_idx, model_name in enumerate(model_names):
                    # which way the model voted: its prediction against its own threshold. Models
                    # that did not cover the class cast no vote and hold no share of the decision,
                    # so they are left out entirely.
                    vote = int(positive[row, class_idx, model_idx]) - int(
                        negative[row, class_idx, model_idx]
                    )
                    if vote:
                        models[model_name] = {
                            "prediction": jsonable(
                                predictions[model_name][row, class_idx]
                            ),
                            "attribution": jsonable(
                                attribution[row, class_idx, model_idx]
                            ),
                            "vote": vote,
                        }
                explanations_for_smiles[cls] = {
                    "name": class_name(cls),
                    "score": jsonable(aggregated["net_score"][row, class_idx]),
                    "models": models,
                    "near_miss": cls in near_misses,
                }
            explanations.append(explanations_for_smiles)

        result = {
            # the operating point the decisions were taken at, which the request may have moved
            "decision_threshold": threshold,
            "predicted_parents": predicted_parents,
            "direct_parents": direct_parents,
            "explanations": explanations,
            # what the input was read as - an InChI is translated to SMILES for the models, and
            # the frontend needs the same string to draw the molecule and ask for details
            "smiles": [
                resolved_smiles[index] if row_of.get(index) is not None else None
                for index in range(len(smiles))
            ],
        }
        if generate_ontology:
            result["ontology"] = ontologies
        return result


class PredictionDetailApiHandler(Resource):

    def post(self):
        parser = reqparse.RequestParser()
        # can be used to specify different types of requests in the future
        parser.add_argument("type", type=str, required=False, default="type")
        parser.add_argument("smiles", type=str)
        parser.add_argument("selectedModels", type=dict, required=False, default=None)

        args = parser.parse_args()
        smiles = to_smiles(args["smiles"])

        explain_infos = {"models": dict()}
        if smiles is None:
            return explain_infos
        for model_name in selected_model_names(args["selectedModels"]):
            model = MODELS[model_name]
            explain_infos_model = model.explain_smiles(smiles)
            if explain_infos_model is not None:
                explain_infos_model["model_type"] = model.__class__.__name__
                explain_infos_model["model_info"] = model.info_text
                explain_infos["models"][model_name] = explain_infos_model

        return explain_infos
