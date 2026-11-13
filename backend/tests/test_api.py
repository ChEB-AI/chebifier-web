"""Sanity checks for the API contract: common inputs, malformed inputs and the error paths.

These do not judge the quality of the predictions (see test_predictions.py for that), only that
the endpoints answer the way the frontend and API clients rely on.
"""

import pytest

PER_INPUT_KEYS = ("predicted_parents", "direct_parents", "explanations", "smiles")
ETHANOL_INCHI = "InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3"
MOLECULAR_ENTITY = "23367"


# --- /api/modelinfo -----------------------------------------------------------------------------


def test_modelinfo_lists_models(modelinfo):
    assert modelinfo["available_models"]
    assert len(modelinfo["available_models"]) == len(modelinfo["available_models_info_texts"])
    assert set(modelinfo["default_model_weights"]) == set(modelinfo["available_models"])


def test_modelinfo_reports_ensemble(modelinfo):
    assert modelinfo["n_classes"] > 0
    assert 0 < modelinfo["decision_threshold"] < 1


def test_modelinfo_uses_public_names(modelinfo):
    # the CI config renames the "lookup" model, so its public name must be what is reported
    assert "ChEBI Lookup" in modelinfo["available_models"]
    assert "lookup" not in modelinfo["available_models"]


def test_modelinfo_best_model_alias(modelinfo):
    assert modelinfo["model_aliases"]["best_model"] in modelinfo["available_models"]


# --- /api/classify: inputs ----------------------------------------------------------------------


def test_classify_empty_list(classify):
    response = classify(smiles=[])
    assert response.status_code == 200
    body = response.get_json()
    for key in PER_INPUT_KEYS:
        assert body[key] == []


def test_classify_missing_smiles(classify):
    response = classify(ontology=True)
    assert response.status_code == 200
    body = response.get_json()
    for key in PER_INPUT_KEYS:
        assert body[key] == []
    assert body["ontology"] == []


# Lopster returns an all-negative prediction instead of a failure for input it cannot parse, so as
# long as it is part of the ensemble, an invalid SMILES does not count as a complete failure and
# gets empty results instead of None. strict: once that is fixed, this starts passing and the
# marker has to go.
LOPSTER_INVALID_INPUT = pytest.mark.xfail(
    strict=True,
    reason="Lopster predicts (all negative) for unparseable input instead of failing",
)


def test_classify_invalid_smiles_is_not_read(classify):
    response = classify(smiles=["not_a_smiles"])
    assert response.status_code == 200
    body = response.get_json()
    assert body["smiles"] == [None]
    assert not body["predicted_parents"][0]


@LOPSTER_INVALID_INPUT
def test_classify_invalid_smiles(classify):
    response = classify(smiles=["not_a_smiles"])
    assert response.status_code == 200
    body = response.get_json()
    for key in PER_INPUT_KEYS:
        assert body[key] == [None]


def test_classify_invalid_smiles_without_lopster(classify, modelinfo):
    """Without Lopster, an invalid SMILES is a complete failure, reported as None."""
    # "lopster" internally, "Lopster" with the production config's display names
    selection = {model: model.lower() != "lopster" for model in modelinfo["available_models"]}
    body = classify(smiles=["not_a_smiles"], selectedModels=selection).get_json()
    for key in PER_INPUT_KEYS:
        assert body[key] == [None]


def test_classify_mixed_batch_keeps_positions(classify):
    response = classify(smiles=["CCO", "not_a_smiles", "c1ccccc1"])
    assert response.status_code == 200
    body = response.get_json()
    for key in PER_INPUT_KEYS:
        assert len(body[key]) == 3
    assert body["smiles"] == ["CCO", None, "c1ccccc1"]
    assert not body["predicted_parents"][1]
    assert body["predicted_parents"][0]
    assert body["predicted_parents"][2]
    # each direct parent is reported as [ChEBI id, name]
    for chebi_id, name in body["direct_parents"][0]:
        assert chebi_id in body["predicted_parents"][0]
        assert name


def test_classify_inchi_is_translated(classify):
    response = classify(smiles=[ETHANOL_INCHI])
    assert response.status_code == 200
    body = response.get_json()
    assert body["smiles"] == ["CCO"]
    assert body["predicted_parents"][0]


def test_classify_explanations_cover_predictions(classify):
    body = classify(smiles=["CCO"]).get_json()
    predicted = body["predicted_parents"][0]
    explanations = body["explanations"][0]
    for cls in predicted:
        assert cls in explanations
        assert not explanations[cls]["near_miss"]
        assert explanations[cls]["score"] >= body["decision_threshold"]
    # everything else that is explained is a near miss
    for cls, explanation in explanations.items():
        if cls not in predicted:
            assert explanation["near_miss"]


def test_classify_ontology(classify):
    response = classify(smiles=["CCO"], ontology=True)
    assert response.status_code == 200
    body = response.get_json()
    graph = body["ontology"][0]
    assert graph["nodes"][MOLECULAR_ENTITY]["root"]
    assert len(graph["nodes"]) > 1
    for child, parent in graph["edges"]:
        assert child in graph["nodes"]
        assert parent in graph["nodes"]


def test_classify_without_ontology(classify):
    body = classify(smiles=["CCO"]).get_json()
    assert "ontology" not in body


# --- /api/classify: model selection -------------------------------------------------------------


def test_classify_single_model(classify, modelinfo):
    model = modelinfo["model_aliases"]["best_model"]
    response = classify(smiles=["CCO"], selectedModels={model: True})
    assert response.status_code == 200
    body = response.get_json()
    assert body["predicted_parents"][0]
    for explanation in body["explanations"][0].values():
        assert set(explanation["models"]) <= {model}


def test_classify_best_model_alias(classify, modelinfo):
    via_alias = classify(smiles=["CCO"], selectedModels={"best_model": True})
    assert via_alias.status_code == 200
    by_name = classify(
        smiles=["CCO"], selectedModels={modelinfo["model_aliases"]["best_model"]: True}
    )
    assert via_alias.get_json()["predicted_parents"] == by_name.get_json()["predicted_parents"]


def test_classify_unknown_selected_model(classify):
    response = classify(smiles=["CCO"], selectedModels={"no such model": True})
    assert response.status_code == 400
    assert "no such model" in response.get_json()["message"]


def test_classify_unknown_weighted_model(classify):
    response = classify(smiles=["CCO"], modelWeights={"no such model": 1})
    assert response.status_code == 400


def test_classify_all_models_weighted_zero(classify, modelinfo):
    weights = {model: 0 for model in modelinfo["available_models"]}
    response = classify(smiles=["CCO"], modelWeights=weights)
    assert response.status_code == 400


def test_classify_no_model_selected(classify, modelinfo):
    selection = {model: False for model in modelinfo["available_models"]}
    response = classify(smiles=["CCO"], selectedModels=selection)
    assert response.status_code == 400


# --- /api/details ("insights") ------------------------------------------------------------------


def test_details_without_smiles(client):
    response = client.post("/api/details", json={"type": "type"})
    assert response.status_code == 200
    assert response.get_json() == {"models": {}}


def test_details_lookup(client):
    response = client.post(
        "/api/details",
        json={"type": "type", "smiles": "CCO", "selectedModels": {"ChEBI Lookup": True}},
    )
    assert response.status_code == 200
    models = response.get_json()["models"]
    assert set(models) == {"ChEBI Lookup"}
    assert models["ChEBI Lookup"]["model_type"]


def test_details_all_models(client, modelinfo):
    response = client.post("/api/details", json={"type": "type", "smiles": "CCO"})
    assert response.status_code == 200
    models = response.get_json()["models"]
    assert models
    assert set(models) <= set(modelinfo["available_models"])


# --- routing ------------------------------------------------------------------------------------


def test_unknown_api_path(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.get_json() == {"message": "Not found"}
