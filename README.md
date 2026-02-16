# Chebifier

Chebifier is a tool for automated classification of chemicals in the [ChEBI](https://www.ebi.ac.uk/chebi/) ontology. This repository only hosts the front end of Chebifier. For the classification itself, see [python-chebifier](https://github.com/ChEB-AI/python-chebifier).

## News
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
 * `type`: one of the available [MODEL_TYPES](https://github.com/ChEB-AI/python-chebifier/blob/dev/chebifier/model_registry.py), e.g. `electra`,
 * `batch_size`: Number of molecules that are passed to the model at once,
 * `target_labels_path`: List of ChEBI classes (the `classes.txt` file that comes as part of a [ChEB-AI](https://github.com/ChEB-AI/python-chebai) dataset)
 * `classwise_weights_path` (optional): Weights that should be assigned to each class (i.e., trust scores calculated on a validation set with [this script](https://github.com/ChEB-AI/python-chebai/blob/dev/chebai/result/generate_class_properties.py)



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

The server should now run at [localhost:5000](localhost:5000)

## Citation

If you found Chebifier useful, please cite: 
[Martin Glauer, Fabian Neuhaus, Simon Flügel, Marie Wosny, Till Mossakowski, Adel Memariani, Johannes Schwerdt and Janna Hastings "Chebifier: Automating Semantic Classification in ChEBI to Accelerate Data-driven Discovery."Digital Discovery, 2024, 3, 896.](https://pubs.rsc.org/en/content/articlehtml/2024/dd/d3dd00238a)

