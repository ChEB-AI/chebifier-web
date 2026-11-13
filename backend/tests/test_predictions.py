"""Sanity checks that the models produce realistic results.

For a handful of molecules whose classification is beyond doubt, the ensemble has to predict the
obvious classes and must not predict classes that plainly do not apply. These are not meant to
measure quality - they are there to catch a system that is broken outright, e.g. a model whose
classes file got swapped, or a calibration that does not match the models it is used with.

The ChEBI lookup is left out: it returns ChEBI's own classification for every molecule in ChEBI,
which would cover up a broken model for exactly the well-known molecules used here.
"""

import pytest

# ChEBI ids
PRIMARY_ALCOHOL = "15734"
ALCOHOL = "30879"
CARBOXYLIC_ACID = "33575"
MONOCARBOXYLIC_ACID = "25384"
AROMATIC_COMPOUND = "33655"
BENZENES = "22712"
AMINO_ACID = "33709"
ALPHA_AMINO_ACID = "33704"
HEXOSE = "18133"
MONOSACCHARIDE = "35381"
PEPTIDE = "16670"
DIPEPTIDE = "46761"
ORGANOCHLORINE_COMPOUND = "36683"
ORGANONITROGEN_COMPOUND = "35352"

# (name, SMILES, classes that have to be predicted, classes that must not be predicted)
CASES = [
    ("ethanol", "CCO", [PRIMARY_ALCOHOL, ALCOHOL], [CARBOXYLIC_ACID, AROMATIC_COMPOUND]),
    ("acetic acid", "CC(=O)O", [MONOCARBOXYLIC_ACID, CARBOXYLIC_ACID], [ALCOHOL, AROMATIC_COMPOUND]),
    ("benzene", "c1ccccc1", [BENZENES, AROMATIC_COMPOUND], [ALCOHOL, CARBOXYLIC_ACID]),
    ("glycine", "NCC(=O)O", [AMINO_ACID, ALPHA_AMINO_ACID], [AROMATIC_COMPOUND, PEPTIDE]),
    (
        "glucose",
        "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O",
        [HEXOSE, MONOSACCHARIDE],
        [PEPTIDE, AROMATIC_COMPOUND, ORGANONITROGEN_COMPOUND],
    ),
    ("glycylglycine", "NCC(=O)NCC(=O)O", [DIPEPTIDE, PEPTIDE], [MONOSACCHARIDE, AROMATIC_COMPOUND]),
    (
        "chloromethane",
        "CCl",
        [ORGANOCHLORINE_COMPOUND],
        [ORGANONITROGEN_COMPOUND, AROMATIC_COMPOUND, ALCOHOL],
    ),
]
CASE_IDS = [case[0] for case in CASES]

LOOKUP = "ChEBI Lookup"


@pytest.fixture(scope="module")
def predictions(client, modelinfo):
    """One batch prediction for all molecules by the ensemble without the ChEBI lookup."""
    selection = {model: model != LOOKUP for model in modelinfo["available_models"]}
    response = client.post(
        "/api/classify",
        json={"smiles": [case[1] for case in CASES], "selectedModels": selection},
    )
    assert response.status_code == 200
    body = response.get_json()
    return {
        name: (body["predicted_parents"][idx], body["explanations"][idx])
        for idx, name in enumerate(CASE_IDS)
    }


@pytest.mark.parametrize("name, smiles, expected, forbidden", CASES, ids=CASE_IDS)
def test_obvious_classes_predicted(predictions, name, smiles, expected, forbidden):
    predicted, _ = predictions[name]
    assert predicted is not None, f"{name} ({smiles}) could not be classified"
    missing = [cls for cls in expected if cls not in predicted]
    assert not missing, f"{name} ({smiles}) is missing obvious classes {missing}"


@pytest.mark.parametrize("name, smiles, expected, forbidden", CASES, ids=CASE_IDS)
def test_wrong_classes_not_predicted(predictions, name, smiles, expected, forbidden):
    predicted, _ = predictions[name]
    assert predicted is not None, f"{name} ({smiles}) could not be classified"
    wrong = [cls for cls in forbidden if cls in predicted]
    assert not wrong, f"{name} ({smiles}) is predicted to be in {wrong}"


# a model has to have voted on at least this many of the obvious classes to be judged by them
MIN_VOTES_PER_MODEL = 3


def test_each_model_mostly_agrees_on_obvious_classes(predictions):
    """Each model has to vote for the obvious classes more often than against them.

    A single broken model can be outvoted by the rest of the ensemble, so checking the ensemble
    result alone would not notice it - but its votes show up in the explanations. Unanimity would
    be too strict: the models do disagree on some of these tiny molecules. A model with a swapped
    classes file, however, would hardly ever vote for the right class.
    """
    votes = {}  # model -> [votes for, votes against]
    for name, _, expected, _ in CASES:
        _, explanations = predictions[name]
        for cls in expected:
            for model, info in explanations.get(cls, {}).get("models", {}).items():
                votes.setdefault(model, [0, 0])[0 if info["vote"] > 0 else 1] += 1
    disagreeing = {
        model: f"{pro} for, {contra} against"
        for model, (pro, contra) in votes.items()
        if pro + contra >= MIN_VOTES_PER_MODEL and pro <= contra
    }
    assert not disagreeing, f"models voting against the obvious classes: {disagreeing}"
