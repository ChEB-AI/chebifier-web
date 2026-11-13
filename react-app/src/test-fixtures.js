// Responses of the backend as the frontend tests see them, shaped like the real API's.

export const MODEL_INFO = {
  available_models: ['GAT-aug (ChEBI25-3STAR)', 'ChemLog', 'ChEBI Lookup'],
  available_models_info_texts: [
    'A Graph Attention Network.',
    'A rule-based method for peptides.',
    'Retrieves the ChEBI classification.',
  ],
  model_aliases: {best_model: 'GAT-aug (ChEBI25-3STAR)'},
  default_model_weights: {'GAT-aug (ChEBI25-3STAR)': 1, 'ChemLog': 1, 'ChEBI Lookup': 1},
  decision_threshold: 0.5,
  operating_points: [],
  n_classes: 2234,
};

// /api/classify for ["CCO", "not_a_smiles"]
export const CLASSIFY_RESPONSE = {
  decision_threshold: 0.5,
  predicted_parents: [['30879', '15734'], null],
  direct_parents: [[['15734', 'primary alcohol']], null],
  explanations: [
    {
      '30879': {name: 'alcohol', score: 0.9, models: {}, near_miss: false},
      '15734': {name: 'primary alcohol', score: 0.8, models: {}, near_miss: false},
    },
    null,
  ],
  smiles: ['CCO', null],
  ontology: [
    {
      nodes: {
        '15734': {name: 'primary alcohol'},
        '30879': {name: 'alcohol'},
        '23367': {name: 'molecular entity', root: true},
      },
      edges: [['15734', '30879'], ['30879', '23367']],
    },
    null,
  ],
};

/** An axios mock that answers like the backend. `classify` is the /api/classify response. */
export function mockBackend(axios, {classify = CLASSIFY_RESPONSE} = {}) {
  axios.get.mockImplementation((url) => {
    if (url === '/api/modelinfo') return Promise.resolve({data: MODEL_INFO});
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  axios.post.mockImplementation(() => Promise.resolve({data: {models: {}}}));
  // the classification is requested with axios({...}) rather than axios.post
  axios.mockImplementation(({url}) => {
    if (url === '/api/classify') return Promise.resolve({data: classify});
    return Promise.reject(new Error(`unexpected request to ${url}`));
  });
}
