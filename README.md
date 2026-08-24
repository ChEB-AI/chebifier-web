# Chebifier

Chebifier is a tool for automated classification of chemicals in the [ChEBI](https://www.ebi.ac.uk/chebi/) ontology. This repository only hosts the front end of Chebifier. For the classification itself, see [python-chebifier](https://github.com/ChEB-AI/python-chebifier).

## News
- 2026/08/18: Recalibrated ensemble (with ~500 new classes), added new deep learning models (v252) and model attributions. Now supports InChI input, user feedback, and extended ensemble settings.
- 2026/02/16: Added Lopster and new deep learning models.
- 2025/11/11: Fixed processing error for GNNs.
- 2025/11/05: Added new models (v244, including GAT, 3-STAR models and augmented GNNs), redesigned frontend.
- 2025/10/01: Fixed issue where server crashed if running predict without adding a SMILES string.
- 2025/10/01: Improved loading times significantly by only passing ChEBI-related information when needed.

## Installation

### Setup Backend

Some dependencies require that pytorch is already installed:

`pip install torch`

After that, you can install the prediction system and web framework:

`pip install -r backend/requirements.txt`

*Chebifier* comes with a number of mandatory configuration files. `config.template.json` contains a template for a *Chebifier* configuration. Copy the contents of this file 

`cp backend/config.template.json backend/config.json`

and change the path for each setting according to your setup.

The ensemble can take any models that are implemented in [python-chebifier](https://github.com/ChEB-AI/python-chebifier). See the repository for example configurations. Common arguments for a model are:
 * `type`: one of the available [MODEL_TYPES](https://github.com/ChEB-AI/python-chebifier/blob/dev/chebifier/model_registry.py), e.g. `gat`,
 * `ckpt_path`: path to the model checkpoint (deep learning models only),
 * `batch_size`: number of molecules that are passed to the model at once,
 * `calibration_name` (optional): the name the model's calibration files in `ENSEMBLE_DIR` were written under, if it differs from the name shown in the web app,
 * `model_weight` (optional, default 1): how much the model's votes count, independently of the class. This is the value the "Ensemble settings" sliders start from.

Besides the models, the configuration points at the calibration of the ensemble:
 * `ENSEMBLE_DIR`: directory holding the calibration written by `chebifier build` (`prediction_thresholds.yaml`, `<model>_classwise_f1.txt`, `best_hyperparameters.csv`). Only the files of the models listed in `MODELS` have to be present - a model without a `_classwise_f1.txt` votes with full trust and a neutral threshold, so its influence is set by its model weight alone.
 * `ENSEMBLE_CLASSES`: the class list the ensemble was calibrated on, one ChEBI id per line. The class-wise F1 scores are stored positionally, so this list has to match the calibration exactly.
 * `CHEBI_GRAPH`: the ChEBI graph pickle the calibration was built against. If the file is missing, it is downloaded from [Hugging Face](https://huggingface.co/datasets/chebai/chebifier).
 * `INCONSISTENCY_RESOLUTION`: `score-based` (the default) or `none`.
 * `BEST_MODEL` (optional): the `MODELS` key that the `best_model` alias resolves to. API clients
   that want the strongest single model can select `best_model` instead of naming it, so the model
   can be swapped out without breaking them. A name that is not in `MODELS` is a startup error;
   without the setting the alias simply does not exist.
 * `STATS_DB` (optional): SQLite file the number of classified molecules is counted in, shown in the
   app as "x molecules classified since ...". Only a per-day count is stored, never the molecules.
   Under uWSGI the request is answered by one of several worker processes, so the count cannot live
   in memory - the increment is a single upserting statement in a transaction, which concurrent
   workers cannot lose the way a read-modify-write on a plain file would. Put the file on local
   disk (SQLite locking is unreliable over NFS) and on a path that survives a deploy. Delete the
   file to reset the counter.
 * `PR_CURVE` (optional): a CSV of measured operating points (`threshold`, `full_micro_precision`,
   `full_micro_recall`), as written by the evaluation grid. It backs the precision/recall sliders in
   the ensemble settings: the user asks for more precision or more recall, and the app picks the
   threshold that delivered it on the test set. Without the file the operating point stays fixed at
   the one the ensemble reports.

### How a prediction is explained

Molecules can be entered as SMILES or InChI strings, mixed freely. An InChI is translated to SMILES
before it reaches the base learners, and the response carries the SMILES each input was read as.

For each predicted class, the web app reports the ensemble score - a probability in [0, 1], with the class predicted above the ensemble's decision threshold - together with the share of that decision each base learner is responsible for (the shares sum to 1) and the raw 0-1 prediction each model made for the class.

### Setup Frontend

Change to the respective directory and build the node.js files
```
cd react-app
npm run build
```

### Run in development

You can now start the development server with

```
cd backend
flask run
```

The server should now run at [localhost:5000](localhost:5000), serving both the API and the built
frontend. Start it from the `backend` directory - the configuration and `data/disjoint_*.csv` are
looked up relative to the working directory. Startup takes a while: the ChEBI graph, the model
checkpoints and the SMILES lookup table are all loaded up front.

The backend has to run in an environment that has `chebifier` and all of its base learners
installed (`chebai`, `chebai-graph`, `chemlog`, `chemlog-extra`, `c3p`). If that environment is a
virtualenv of the python-chebifier checkout, run flask from it directly, e.g.
`../../python-chebifier/.venv/Scripts/python -m flask --app app run`.

## Citation

If you found Chebifier useful, please cite: 
[Martin Glauer, Fabian Neuhaus, Simon Flügel, Marie Wosny, Till Mossakowski, Adel Memariani, Johannes Schwerdt and Janna Hastings "Chebifier: Automating Semantic Classification in ChEBI to Accelerate Data-driven Discovery."Digital Discovery, 2024, 3, 896.](https://pubs.rsc.org/en/content/articlehtml/2024/dd/d3dd00238a)

