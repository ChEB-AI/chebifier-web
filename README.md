# Chebifier

Chebifier is a tool for automated classification of chemicals in the [ChEBI](https://www.ebi.ac.uk/chebi/) ontology. This repository only hosts the front end of Chebifier. For the classification itself, see [python-chebifier](https://github.com/ChEB-AI/python-chebifier).

A web server running Chebifier is available [here](https://chebifier.hastingslab.org/).

## News
- 2026/08/18: Recalibrated ensemble (with ~500 new classes), added new deep learning models (v252) and model attributions. Now supports InChI input, user feedback, and extended ensemble settings. Uses `chebifier==1.3.0` and ensemble config `26-09_web`.
- 2026/02/16: Added Lopster and new deep learning models.

## Installation

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
looked up relative to the working directory. The first startup may take a bit longer: the ChEBI graph, the model
checkpoints and the ChEBI lookup table are all loaded up front.

The backend has to run in an environment that has `chebifier` installed.

### Setup Backend

Some dependencies require that pytorch is already installed:

`pip install torch`

After that, you can install the prediction system and web framework:

`pip install -r backend/requirements.txt`

`config.template.json` contains a template for a *Chebifier* configuration. Copy the contents of this file 

`cp backend/config.template.json backend/config.json`

and change the path for each setting according to your setup. An example configuration is available on [Hugging Face](https://huggingface.co/datasets/chebai/chebifier/blob/main/web_assets/config.json). Note that this does not touch the actual ensemble behaviour. For the ensemble, see [python-chebifier](https://github.com/ChEB-AI/python-chebifier). 

### Reproducing chebifier.hastingslab.org

To get the same results as the version currently running on [chebifier.hastingslab.org](chebifier.hastingslab.org), 
make sure to match the [`chebifier`](https://github.com/ChEB-AI/python-chebifier) version displayed on the [about page](https://chebifier.hastingslab.org/about)
and the ensemble configuration. The ensemble configuration defines which models are used and how they get weighted. Currently, two configs are supported, [`web`](https://huggingface.co/datasets/chebai/chebifier/blob/main/config_26-09_web.yml) for the online version, [`eval`](https://huggingface.co/datasets/chebai/chebifier/blob/main/config_26-09_eval.yml) for the version used 
in [Flügel et al.: _Chebifier 2: An Ensemble for Chemistry_, 2026 (preprint)](https://www.researchsquare.com/article/rs-9023090/latest).

To use the precision/recall sliders, you can download the csv table from [Hugging Face](https://huggingface.co/datasets/chebai/chebifier/blob/main/web_assets/pr_curve.csv) and set the "PR_CURVE" parameter in the config file. 

### Windows: enable long paths

On the first startup the model checkpoints are downloaded from Hugging Face into the local cache. Some
checkpoint paths exceed Windows' default 260-character `MAX_PATH` limit, which makes the download fail
with a `FileNotFoundError` during `build_base_learners`. Enable long-path support once, in an
**Administrator** PowerShell:

```powershell
Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -Value 1 -Type DWord
```

Then start a fresh terminal (the flag is read at process startup) before running the backend again; a
reboot may be needed if a fresh shell still fails. Python 3.6+ is long-path-aware, so no code or cache
changes are required.

## Tests

Every push and pull request to `main` runs both test suites on GitHub Actions (`.github/workflows/ci.yml`).

The backend tests run the API against the real ensemble, so they need a working `backend/config.json`
(CI uses [`backend/tests/config.ci.json`](backend/tests/config.ci.json)) and the models (downloaded on first use):

```
cd backend
pip install pytest
pytest
```

Besides the API contract (empty and invalid input, unknown models, insights, ...), they check that
the models give realistic results for a few obvious molecules - e.g. that ethanol is predicted to be
an alcohol and not a carboxylic acid. This catches a broken system, such as a model with a swapped
classes file. The graph models also need PyTorch Geometric and `torch_scatter`
(`pip install torch_geometric torch_scatter -f https://data.pyg.org/whl/torch-<torch version>+cpu.html`).

The frontend tests mock the backend:

```
cd react-app
CI=true npm test
```

## Citation

If you found Chebifier useful, please cite: 
[Martin Glauer, Fabian Neuhaus, Simon Flügel, Marie Wosny, Till Mossakowski, Adel Memariani, Johannes Schwerdt and Janna Hastings "Chebifier: Automating Semantic Classification in ChEBI to Accelerate Data-driven Discovery."Digital Discovery, 2024, 3, 896.](https://pubs.rsc.org/en/content/articlehtml/2024/dd/d3dd00238a)

