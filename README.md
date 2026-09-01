# Chebifier

Chebifier is a tool for automated classification of chemicals in the [ChEBI](https://www.ebi.ac.uk/chebi/) ontology. This repository only hosts the front end of Chebifier. For the classification itself, see [python-chebifier](https://github.com/ChEB-AI/python-chebifier).

## News
- 2026/08/18: Recalibrated ensemble (with ~500 new classes), added new deep learning models (v252) and model attributions. Now supports InChI input, user feedback, and extended ensemble settings.
- 2026/02/16: Added Lopster and new deep learning models.
- 2025/11/11: Fixed processing error for GNNs.
- 2025/11/05: Added new models (v244, including GAT, 3-STAR models and augmented GNNs), redesigned frontend.

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

To use the precision/recall sliders, you can download the csv table from [Hugging Face](https://huggingface.co/datasets/chebai/chebifier/blob/main/web_assets/pr_curve.csv) and set the "PR_CURVE" parameter in the config file. 

## Citation

If you found Chebifier useful, please cite: 
[Martin Glauer, Fabian Neuhaus, Simon Flügel, Marie Wosny, Till Mossakowski, Adel Memariani, Johannes Schwerdt and Janna Hastings "Chebifier: Automating Semantic Classification in ChEBI to Accelerate Data-driven Discovery."Digital Discovery, 2024, 3, 896.](https://pubs.rsc.org/en/content/articlehtml/2024/dd/d3dd00238a)

