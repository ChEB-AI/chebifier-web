import * as React from 'react';
import axios from "axios";
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import StartIcon from '@mui/icons-material/Start';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import {SlChemistry} from "react-icons/sl";
// import Modal from '@mui/material/Modal';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Tooltip from '@mui/material/Tooltip';
import {randomId} from '../lib/random-id';

import DetailsPage from "./details-page";
import {OntologyGraph, MoleculeStructure} from "./ontology-utils";
import {CircularProgress} from "@mui/material";
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import AttributionChart from "./attribution-chart";
import EnsembleSettings from "./ensemble-settings";

// Everything is white, so the pieces of a prediction are told apart by an outline rather than by
// their fill: the card carries a shadow, the panels on it carry a blue border.
export const ACCENT = '#2a78d6';

// Feedback on a prediction goes to the issue tracker, through the "wrong prediction" issue form.
const FEEDBACK_REPO = 'https://github.com/ChEB-AI/chebifier-web';


const panelSx = {
  p: 2,
  borderRadius: 2,
  backgroundColor: '#ffffff',
  border: `1px solid ${ACCENT}`,
};

export default function ClassificationGrid() {
  const [rows, setRows] = React.useState([]);
  const [detailsByRow, setDetailsByRow] = React.useState({});

  const [availableModels, setAvailableModels] = React.useState([]);
  const [availableModelsInfoTexts, setAvailableModelsInfoTexts] = React.useState([]);
  const [selectedModel, setSelectedModel] = React.useState('Ensemble');
  const [modelsLoaded, setModelsLoaded] = React.useState(false);
  // model weights: how much say each model has in the ensemble vote (tunable in "Ensemble settings")
  const [defaultModelWeights, setDefaultModelWeights] = React.useState({});
  const [modelWeights, setModelWeights] = React.useState({});
  const [decisionThreshold, setDecisionThreshold] = React.useState(0.5);
  const [defaultThreshold, setDefaultThreshold] = React.useState(0.5);
  const [operatingPoints, setOperatingPoints] = React.useState([]);
  // predictions that contradict the ChEBI hierarchy are corrected against each other by default
  const [resolveInconsistencies, setResolveInconsistencies] = React.useState(true);

  const [inputText, setInputText] = React.useState("");
  const [predictionsLoading, setPredictionsLoading] = React.useState(false);
  const [hasPredicted, setHasPredicted] = React.useState(false);
  const [expandedRowId, setExpandedRowId] = React.useState(null);
  // If user uploads before models are loaded, queue SMILES and auto-run when ready
  const [queuedSmiles, setQueuedSmiles] = React.useState(null);
  // map of rowId -> the ChEBI id picked in that row's ontology graph
  const [selectedClassByRow, setSelectedClassByRow] = React.useState({});
  // map of rowId -> whether that row's graph also shows the classes that just missed the threshold
  const [nearMissesByRow, setNearMissesByRow] = React.useState({});
  const selectClass = (rowId) => (chebiId) =>
    setSelectedClassByRow(prev => ({...prev, [rowId]: chebiId}));

  // Ref to hidden file input for uploading SMILES
  const fileInputRef = React.useRef(null);

  const buildSelectedModels = () => {
    // Backend expects an object map of modelName -> boolean
    if (selectedModel === 'Ensemble') {
      const allTrue = {};
      availableModels.forEach(m => {
        allTrue[m] = true;
      });
      return allTrue;
    } else {
      const map = {};
      availableModels.forEach(m => {
        map[m] = (m === selectedModel);
      });
      return map;
    }
  };

  React.useEffect(() => {
    axios.get('/api/modelinfo').then(response => {
      const weights = response.data.default_model_weights || {};
      setAvailableModels(response.data.available_models);
      setAvailableModelsInfoTexts(response.data.available_models_info_texts);
      setDefaultModelWeights(weights);
      setModelWeights({...weights});
      if (typeof response.data.decision_threshold === 'number') {
        setDecisionThreshold(response.data.decision_threshold);
        setDefaultThreshold(response.data.decision_threshold);
      }
      setOperatingPoints(response.data.operating_points || []);
      setModelsLoaded(true);
    });
  }, []);

  // Single entry point for classification: every trigger (button, Ctrl+Enter, upload, queued
  // upload, re-run after a weight change) goes through here so they cannot drift apart.
  const runPrediction = (smiles) => {
    if (!smiles || smiles.length === 0) return;
    const settings = {
      models: selectedModel === 'Ensemble' ? 'Ensemble (all models)' : `single model: ${selectedModel}`,
      weights: {...modelWeights},
      resolve: resolveInconsistencies,
    };
    setHasPredicted(true);
    setPredictionsLoading(true);
    setExpandedRowId(null);
    setDetailsByRow({});
    setSelectedClassByRow({});
    setNearMissesByRow({});
    return axios({
      url: '/api/classify',
      method: 'post',
      data: {
        smiles: smiles,
        ontology: true,
        selectedModels: buildSelectedModels(),
        modelWeights: modelWeights,
        decisionThreshold: decisionThreshold,
        resolveInconsistencies: resolveInconsistencies
      }
    }).then(response => {
      setRows((old) => old.map((row, i) => ({
        ...row,
        direct_parents: response.data.direct_parents[i],
        predicted_parents: response.data.predicted_parents[i],
        ontology: response.data.ontology[i],
        explanations: (response.data.explanations || [])[i],
        // what the backend read the input as - an InChI comes back translated to SMILES, which is
        // what the structure drawing and the per-model insights need
        resolved_smiles: (response.data.smiles || [])[i],
        threshold: response.data.decision_threshold,
        settings: {...settings, threshold: response.data.decision_threshold},
      })));
    }).finally(() => setPredictionsLoading(false));
  };

  const predictFromInput = () => {
    const smiles = inputText.trim().replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
    if (smiles.length === 0) return;
    addRows(smiles);
    runPrediction(smiles);
  };

  // If user uploaded SMILES before models were ready, auto-run once models are loaded
  React.useEffect(() => {
    if (modelsLoaded && queuedSmiles && !predictionsLoading) {
      const smiles = queuedSmiles;
      setQueuedSmiles(null);
      runPrediction(smiles);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelsLoaded, queuedSmiles]);

  /**
   * A link to the "wrong prediction" issue form, with the molecule and the prediction filled in.
   * Feedback goes to the issue tracker rather than to us: nothing about a prediction is kept on
   * the server, so the report has to carry its own context.
   */
  const feedbackUrl = (row) => {
    const selected = selectedClassByRow[row.id];
    const explanation = selected && (row.explanations || {})[selected];
    const settings = row.settings || {};
    const changedWeights = Object.entries(settings.weights || {})
      .filter(([model, weight]) => Number(weight) !== Number(defaultModelWeights[model] ?? 1))
      .map(([model, weight]) => `${model}=${weight}`);

    const lines = [`Molecule (as entered): ${row.smiles}`];
    if (row.resolved_smiles && row.resolved_smiles !== row.smiles) {
      lines.push(`Molecule (as classified): ${row.resolved_smiles}`);
    }
    if (explanation) {
      lines.push(
        '',
        `Selected class: ${explanation.name} (CHEBI:${selected})`,
        `Ensemble score: ${explanation.score?.toFixed(3)} (predicted above ${settings.threshold ?? decisionThreshold})`,
        explanation.near_miss ? 'This class was NOT predicted - it stayed below the threshold.' : '',
        'Model contributions:',
        ...Object.entries(explanation.models || {}).map(([model, values]) =>
          `  ${model}: prediction ${values.prediction?.toFixed(3)}, ` +
          `${values.vote > 0 ? 'supports' : 'opposes'}, ` +
          `${((values.attribution || 0) * 100).toFixed(1)}% of the decision`),
      );
    }
    lines.push(
      '',
      'Settings:',
      `  Models: ${settings.models || 'Ensemble (all models)'}`,
      `  Decision threshold: ${settings.threshold ?? decisionThreshold}`,
      `  Inconsistency resolution: ${settings.resolve === false ? 'off' : 'on'}`,
      `  Model weights: ${changedWeights.length ? changedWeights.join(', ') : 'default'}`,
      '',
      `All predicted classes: ${(row.predicted_parents || []).map(cls => `CHEBI:${cls}`).join(', ')}`,
    );

    const params = new URLSearchParams({
      template: 'wrong-prediction.yml',
      title: `[Prediction] ${explanation ? `${explanation.name} for ` : ''}${row.smiles}`.slice(0, 120),
      molecule: row.smiles,
      // an over-long URL is rejected by the browser rather than truncated, so cap the dump
      prediction: lines.filter(line => line !== '').join('\n').slice(0, 4000),
    });
    if (explanation) {
      params.set('classes', `CHEBI:${selected} (${explanation.name})`);
    }
    return `${FEEDBACK_REPO}/issues/new?${params.toString()}`;
  };

  /** Whether a row has classes that came close to the threshold without reaching it. */
  const hasNearMisses = (row) =>
    Object.values(row.explanations || {}).some((explanation) => explanation.near_miss);

  /** Summary of a collapsed row: the most specific classes the ensemble predicted. */
  const renderClassSummary = (row) => {
    const data = row.direct_parents;
    if (data === null) return <Alert severity="error">Could not process input!</Alert>;
    if (!data || (data.length === 0 && !predictionsLoading)) {
      return <Alert severity="info">No classes predicted.</Alert>;
    }
    return (
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
        {data.map((x, idx) => (
          <Chip
            key={`class-${row.id}-${idx}`}
            component="a"
            href={`http://purl.obolibrary.org/obo/CHEBI_${x[0]}`}
            label={x[1]}
            clickable
            target="_blank"
          />
        ))}
      </Box>
    );
  };

  /** The class selected in the ontology graph, and why the ensemble predicted it. */
  const renderSelectedClass = (row) => {
    if (row.direct_parents === null) return <Alert severity="error">Could not process input!</Alert>;
    const selected = selectedClassByRow[row.id];
    const explanation = selected && (row.explanations || {})[selected];

    if (!selected) {
      return (
        <Typography variant="body2" color="text.secondary">
          Click on a node in the ontology graph.
        </Typography>
      );
    }
    if (!explanation) {
      // the top class is drawn but never predicted - it holds for every molecule
      return (
        <Typography variant="body2" color="text.secondary">
          Every molecule is a molecular entity, so the ensemble does not predict this class.
        </Typography>
      );
    }
    return (
      <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5}}>
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
          <Chip
            component="a"
            href={`http://purl.obolibrary.org/obo/CHEBI_${selected}`}
            label={explanation.name}
            clickable
            target="_blank"
          />
          {explanation.near_miss && (
            <Typography variant="caption" color="text.secondary">
              not predicted - the score stayed below the threshold
            </Typography>
          )}
        </Box>
        <AttributionChart
          calculations={explanation.models}
          netScore={explanation.score}
          threshold={row.threshold ?? decisionThreshold}
        />
      </Box>
    );
  };

  const addRows = ((smiles) => {
    const ids = smiles.map(() => randomId());
    setRows(smiles.map((s, i) => ({
      id: ids[i],
      smiles: s,
      direct_parents: [],
      predicted_parents: []
    })));

  })

  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const handleToggleExpand = (id) => () => {
    if (expandedRowId === id) {
      setExpandedRowId(null);
      return;
    }
    setExpandedRowId(id);

    // fetch details if not cached
    if (!detailsByRow[id]) {
      const thisRow = rows.find((row) => row.id === id);
      if (!thisRow) return;
      setDetailsLoading(id);
      axios.post('/api/details', {
        smiles: thisRow.resolved_smiles || thisRow.smiles,
        selectedModels: buildSelectedModels()
      }).then(response => {
        const detailObj = {
          models_info: response.data.models,
          chebi: response.data.classification,
          chebi_legend: response.data.color_legend
        };
        setDetailsByRow(prev => ({...prev, [id]: detailObj}));
      }).finally(() => {
        setDetailsLoading(false);
      });
    }
  }

  const handleUpload = (event) => {
    event.preventDefault();
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = String(e.target.result || '').replace(/\r/g, '').trim();
      // Show uploaded content in the input field
      setInputText(text);
      // Parse SMILES from lines
      const smiles = text.split('\n').map(s => s.trim()).filter(Boolean);
      if (smiles.length === 0) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      // Initialize rows
      addRows(smiles);
      // Auto-run prediction if models are loaded and we're not already loading
      if (modelsLoaded && !predictionsLoading) {
        runPrediction(smiles);
      } else {
        // Queue the SMILES to auto-run once models are loaded / ready
        setQueuedSmiles(smiles);
      }
      // Reset input so the same file can be uploaded again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDownload = (event) => {
    event.preventDefault();
    const fileData = JSON.stringify(rows.map((r) => ({
      "smiles": r["smiles"],
      "direct_parents": (r["direct_parents"] || []).map(element => [element[0], element[1]]),
      "predicted_parents": r["predicted_parents"],
    })).filter((d) => d.direct_parents?.length >= 0));
    const blob = new Blob([fileData], {type: "text/plain"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "chebifier-predictions.json";
    link.href = url;
    link.click();
  };

  // Append helper for example SMILES buttons
  const appendSmiles = (smiles) => {
    setInputText((prev) => {
      const p = String(prev || '').replace(/\r/g, '');
      if (!p) return smiles;
      const needsNewline = !p.endsWith('\n');
      return p + (needsNewline ? '\n' : '') + smiles;
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        {(() => {
          const isCentered = !hasPredicted && rows.length === 0;
          return (
            <Box sx={{
              width: '100%',
              minHeight: '100vh',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Box sx={{
                padding: 2,
                backgroundColor: '#ffffff',
                border: `1px solid ${ACCENT}`,
                marginBottom: 2,
                borderRadius: 1,
                marginLeft: 2,
                marginRight: 2
              }}>
                <Typography variant="h6" align="left" color="textPrimary" gutterBottom>
                  If you like Chebifier, please cite: Glauer, Martin, et al. "Chebifier: Automating Semantic
                  Classification in ChEBI to Accelerate Data-driven Discovery."
                  <a href={"https://pubs.rsc.org/en/content/articlehtml/2024/dd/d3dd00238a"}>Digital Discovery, 2024, 3,
                    896</a>.
                </Typography>
              </Box>

              <Paper sx={{
                width: 'fit-content',
                height: 'fit-content',
                backgroundColor: '#ffffff',
                boxShadow: 3,
                borderRadius: 2,
                flex: '0 0 auto',
                display: isCentered ? 'flex' : 'block',
                alignItems: isCentered ? 'center' : 'stretch',
                justifyContent: isCentered ? 'center' : 'flex-start',
                minHeight: 'auto',
                marginX: 'auto'
              }}>
                <Box sx={{width: 'auto', height: 'auto'}}>
                  <Box sx={{p: 2, width: 'auto', minWidth: '700px', display: 'inline-flex', flexDirection: 'column'}}>
                    <TextField
                      label="Enter SMILES or InChI (one per line)"
                      placeholder="Cn1c(=O)c2c(ncn2C)n(C)c1=O"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          e.preventDefault();
                          if (!modelsLoaded || predictionsLoading) return;
                          predictFromInput();
                        }
                      }}
                      fullWidth
                      multiline
                      minRows={3}
                    />
                    {/* Example SMILES quick-add buttons */}
                    <Box sx={{ mt: 0.5, mb: 0.5, display: 'flex', gap: 2 }}>
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => appendSmiles('CO')}
                        sx={{
                          p: 0,
                          minWidth: 'auto',
                          textTransform: 'none',
                          fontSize: '0.8rem'
                        }}
                      >
                        Try methanol
                      </Button>
                      <Button
                        variant="text"
                        size="small"
                        onClick={() => appendSmiles('Cn1c(=O)c2c(ncn2C)n(C)c1=O')}
                        sx={{
                          p: 0,
                          minWidth: 'auto',
                          textTransform: 'none',
                          fontSize: '0.8rem'
                        }}
                      >
                        Try caffeine
                      </Button>
                    </Box>
                    <Box sx={{mt: 1, display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap', width: '100%'}}>
                      <FormControl size="small" sx={{
                        minWidth: 200,
                        '& .MuiOutlinedInput-root': { height: 36 },
                        '& .MuiSelect-select': { py: 0.5 }
                      }}>
                        <Select
                          value={selectedModel}
                          onChange={(e) => setSelectedModel(e.target.value)}
                          disabled={!modelsLoaded}
                        >
                          <MenuItem value={'Ensemble'}>Ensemble</MenuItem>
                          {availableModels.map((m, idx) => (
                            <MenuItem key={m} value={m}>{m}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {/* model weights only have an effect when the models actually vote against
                          each other, i.e. when the ensemble is selected */}
                      {selectedModel === 'Ensemble' && (
                        <EnsembleSettings
                          models={availableModels}
                          weights={modelWeights}
                          defaultWeights={defaultModelWeights}
                          disabled={!modelsLoaded || predictionsLoading}
                          canRerun={rows.length > 0}
                          onChange={(model, value) => setModelWeights(prev => ({...prev, [model]: value}))}
                          onReset={() => {
                            setModelWeights({...defaultModelWeights});
                            setDecisionThreshold(defaultThreshold);
                            setResolveInconsistencies(true);
                          }}
                          operatingPoints={operatingPoints}
                          threshold={decisionThreshold}
                          defaultThreshold={defaultThreshold}
                          onThresholdChange={setDecisionThreshold}
                          resolveInconsistencies={resolveInconsistencies}
                          onResolveChange={setResolveInconsistencies}
                          onRerun={() => runPrediction(rows.map(row => row.smiles))}
                        />
                      )}
                      {/* Hidden file input for SMILES upload */}
                      <input
                        type="file"
                        accept="text/plain"
                        style={{display: 'none'}}
                        ref={fileInputRef}
                        onChange={handleUpload}
                      />
                      <Tooltip title="Upload SMILES or InChI strings from file (one per line)">
                        <span>
                          <Button
                            variant="outlined"
                            startIcon={<UploadFileIcon/>}
                            onClick={() => fileInputRef.current && fileInputRef.current.click()}
                            disabled={predictionsLoading}
                            sx={{ml: 'auto'}}
                          >
                            Upload
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title={rows.length === 0 ? "No results to download yet" : "Download results as JSON"}>
                        <span>
                          <Button
                            variant="outlined"
                            startIcon={<DownloadIcon/>}
                            onClick={handleDownload}
                            disabled={rows.length === 0}
                            sx={{ml: 'auto'}}
                          >
                            Download
                          </Button>
                        </span>
                      </Tooltip>
                      <Button
                        variant="contained"
                        sx={{ml: 'auto'}}
                        onClick={predictFromInput}
                        disabled={predictionsLoading || !modelsLoaded}
                        startIcon={predictionsLoading ? <CircularProgress size={20}/> : <SlChemistry/>}
                      >
                        Predict
                      </Button>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{mt: 1.5}}>
                      Chebifier does not collect or store the molecules you submit. They are
                      processed only to compute the prediction and are never written to disk or
                      passed on to anyone else.
                    </Typography>
                  </Box>

                </Box>
              </Paper>

              {hasPredicted && (
                <Box sx={{mt: 2, width: '90%', mx: 'auto'}}>
                  {rows.length > 0 && (
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                      gap: 2,
                      alignItems: 'start',
                    }}>
                      {rows.map((row) => {
                        const canExpand = (row.direct_parents) && !predictionsLoading;
                        return (
                          <Paper key={row.id} sx={{
                            p: 2, borderRadius: 2, boxShadow: 2,
                            backgroundColor: '#ffffff', overflowX: 'auto',
                            // an expanded card needs the whole row for its panels
                            gridColumn: expandedRowId === row.id ? '1 / -1' : 'auto',
                            cursor: canExpand && expandedRowId !== row.id ? 'pointer' : 'default',
                            // the app centres text globally, which leaves headings and the
                            // attribution rows floating over their columns
                            textAlign: 'left'
                          }}
                                 onClick={(e) => {
                                   if (!canExpand) return;
                                   const t = e.target;
                                   const interactive = t.closest(
                                     'a, button, [role="button"], input, textarea, select, .MuiButtonBase-root, .MuiLink-root, .MuiChip-root'
                                   );
                                   if (interactive) return;
                                   const nestedPaper = t.closest('.MuiPaper-root');
                                   if (nestedPaper && nestedPaper !== e.currentTarget) return;
                                   handleToggleExpand(row.id)();
                                 }}
                          >
                            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                              <Typography variant="subtitle2" noWrap title={row.smiles} sx={{minWidth: 0}}>
                                {row.smiles}
                              </Typography>
                              <Button
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleExpand(row.id)();
                                }}
                                disabled={!canExpand}
                                startIcon={detailsLoading === row.id && expandedRowId !== row.id ?
                                  <CircularProgress size={16}/> : <LightbulbIcon/>}
                              >
                                {expandedRowId === row.id ? 'Hide' : 'Details'}
                              </Button>
                            </Box>
                            {expandedRowId !== row.id && (
                              <Box sx={{mt: 1, display: 'flex', gap: 2, alignItems: 'flex-start'}}>
                                {/* nothing to draw for an input the backend could not read */}
                                {row.resolved_smiles && (
                                  <Box sx={{flex: '0 0 auto', width: 150}}>
                                    <MoleculeStructure
                                      smiles={row.resolved_smiles}
                                      height={150}
                                      width={150}
                                    />
                                  </Box>
                                )}
                                <Box sx={{flex: 1, minWidth: 0}}>
                                  {renderClassSummary(row)}
                                </Box>
                              </Box>
                            )}
                            {expandedRowId === row.id && (
                              <Box sx={{mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2}}>
                                {/* the graph and the class it selects belong together, so they sit
                                    side by side */}
                                <Paper elevation={0} sx={{...panelSx, flex: '3 1 700px', minWidth: 420, overflowX: 'auto'}}>
                                  <Box sx={{display: 'flex', alignItems: 'center', gap: 2, mb: 1}}>
                                    <Typography variant="subtitle2">Ontology graph</Typography>
                                    {hasNearMisses(row) && (
                                      <Button
                                        size="small"
                                        onClick={() => setNearMissesByRow(prev => ({...prev, [row.id]: !prev[row.id]}))}
                                        sx={{ml: 'auto'}}
                                      >
                                        {nearMissesByRow[row.id] ? 'Hide near-misses' : 'Show near-misses'}
                                      </Button>
                                    )}
                                  </Box>
                                  <OntologyGraph
                                    graph={row.ontology}
                                    selected={selectedClassByRow[row.id] || null}
                                    onSelect={selectClass(row.id)}
                                    showNearMisses={!!nearMissesByRow[row.id]}
                                  />
                                </Paper>
                                <Paper elevation={0} sx={{...panelSx, flex: '1 1 440px', minWidth: 380}}>
                                  <Box sx={{display: 'flex', alignItems: 'center', gap: 2, mb: 1}}>
                                    <Typography variant="subtitle2">Predicted class</Typography>
                                    <Tooltip title="Something wrong here? Open a pre-filled report on GitHub">
                                      <Button
                                        size="small"
                                        component="a"
                                        href={feedbackUrl(row)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        startIcon={<FlagOutlinedIcon/>}
                                        sx={{ml: 'auto'}}
                                      >
                                        Report
                                      </Button>
                                    </Tooltip>
                                  </Box>
                                  {renderSelectedClass(row)}
                                </Paper>
                                <Paper elevation={0} sx={{...panelSx, flex: '1 1 280px', minWidth: 250, overflowX: 'auto'}}>
                                  <Typography variant="subtitle2" gutterBottom>Molecular graph</Typography>
                                  <MoleculeStructure smiles={row.resolved_smiles || row.smiles} height={250} width={250}/>
                                </Paper>
                                <Paper elevation={0} sx={{...panelSx, flex: '1 1 600px', minWidth: 500, overflow: 'hidden'}}>
                                  <Typography variant="subtitle2" gutterBottom>Model-specific insights</Typography>
                                  {detailsByRow[row.id] ? (
                                    <DetailsPage detail={detailsByRow[row.id]}
                                                 handleClose={() => setExpandedRowId(null)}/>
                                  ) : (
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                      <CircularProgress size={20}/>
                                      <Typography variant="body2">Loading model-specific insights…</Typography>
                                    </Box>
                                  )}
                                </Paper>

                              </Box>
                            )}
                          </Paper>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              )}

            </Box>
          );
        })()}
      </header>
    </div>
  );
}
