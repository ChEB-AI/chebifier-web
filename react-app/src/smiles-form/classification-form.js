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
import {plot_ontology, MoleculeStructure} from "./ontology-utils";
import {Molecules} from "./ontology-utils";
import {CircularProgress} from "@mui/material";
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Collapse from '@mui/material/Collapse';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

export default function ClassificationGrid() {
  const [rows, setRows] = React.useState([]);
  const [detailsByRow, setDetailsByRow] = React.useState({});

  const [availableModels, setAvailableModels] = React.useState([]);
  const [availableModelsInfoTexts, setAvailableModelsInfoTexts] = React.useState([]);
  const [selectedModel, setSelectedModel] = React.useState('Ensemble');
  const [modelsLoaded, setModelsLoaded] = React.useState(false);

  const [inputText, setInputText] = React.useState("");
  const [predictionsLoading, setPredictionsLoading] = React.useState(false);
  const [hasPredicted, setHasPredicted] = React.useState(false);
  const [expandedRowId, setExpandedRowId] = React.useState(null);
  // Track which model option was active when predictions were triggered
  const [lastPredictedModel, setLastPredictedModel] = React.useState('Ensemble');
  // If user uploads before models are loaded, queue SMILES and auto-run when ready
  const [queuedSmiles, setQueuedSmiles] = React.useState(null);
  // map of `${rowId}-${classIdx}` -> boolean for per-chip "Why this class?" panel
  const [openWhyMap, setOpenWhyMap] = React.useState({});
  const toggleWhy = (rowId, classIdx) => () => {
    const key = `${rowId}-${classIdx}`;
    setOpenWhyMap(prev => ({...prev, [key]: !prev[key]}));
  };
  const isWhyOpen = (rowId, classIdx) => !!openWhyMap[`${rowId}-${classIdx}`];

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

  const selectedModels = buildSelectedModels();


  if (availableModels.length === 0) {
    axios.get('/api/modelinfo').then(response => {
      setAvailableModels(response.data.available_models);
      setAvailableModelsInfoTexts(response.data.available_models_info_texts);
      setModelsLoaded(true);

    });
  }

  // If user uploaded SMILES before models were ready, auto-run once models are loaded
  React.useEffect(() => {
    if (modelsLoaded && queuedSmiles && !predictionsLoading) {
      setLastPredictedModel(selectedModel);
      setHasPredicted(true);
      setPredictionsLoading(true);
      axios({
        url: '/api/classify',
        method: 'post',
        data: {
          smiles: queuedSmiles,
          ontology: true,
          selectedModels: selectedModels
        }
      }).then(response => {
        setRows((old) => old.map((row, i) => ({
          ...row,
          direct_parents: response.data.direct_parents[i],
          predicted_parents: response.data.predicted_parents[i],
          ontology: response.data.ontology[0][i],
        })));
      }).finally(() => {
        setPredictionsLoading(false);
        setQueuedSmiles(null);
      });
    }
  }, [modelsLoaded, queuedSmiles, predictionsLoading, selectedModels]);

  const renderClasses = (params) => {
    const data = params.value;
    const row = params.row || {};
    const isExpanded = row.id === expandedRowId;

    if (data === null) {
      return <Alert severity="error">Could not process input!</Alert>
    }

    if (data.length === 0 && !predictionsLoading) {
      return <Alert severity="info">No classes predicted.</Alert>
    }

    // Collapsed view: chips flowing inline
    const collapsedView = (
      <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
        {data.map((x, idx) => (
          <Box key={`class-collapsed-${row.id}-${idx}`} sx={{display: 'flex', alignItems: 'center', gap: 1}}>
            <Chip
              component="a"
              href={`http://purl.obolibrary.org/obo/CHEBI_${x[0]}`}
              label={x[1]}
              clickable
              target="_blank"
            />
          </Box>
        ))}
      </Box>
    );

    // Expanded view: one class per row with a Why button and collapsible table
    const expandedView = (
      <Box sx={{display: 'flex', flexDirection: 'column', gap: 1}}>
        {data.map((x, idx) => {
          const whyOpen = isWhyOpen(row.id, idx);
          return (
            <Box key={`class-expanded-${row.id}-${idx}`} sx={{borderRadius: 1, border: '1px solid #eee'}}>
              <Box sx={{display: 'flex', alignItems: 'center', gap: 1, p: 1}}>
                <Chip
                  component="a"
                  href={`http://purl.obolibrary.org/obo/CHEBI_${x[0]}`}
                  label={x[1]}
                  clickable
                  target="_blank"
                />
                {lastPredictedModel === 'Ensemble' && (
                  <Button size="small" onClick={toggleWhy(row.id, idx)} sx={{ml: 'auto'}}>
                    {whyOpen ? 'Hide' : 'Why this class?'}
                  </Button>
                )}
              </Box>
              <Collapse in={whyOpen} timeout="auto" unmountOnExit>
                <Box sx={{px: 1, pb: 1, overflowX: 'auto'}}>
                  <Typography variant="body2">
                    The ensemble decides by a weighted voting of models.
                    Each models receives a score (the product of confidence, trust and model weight).
                    Scores of models that make positive predictions are added, scores of models that make negative predictions are substracted.
                    If the sum is positive, the ensemble predicts this class.
                  </Typography>
                  <Table size="small" aria-label="why-this-class" sx={{minWidth: 700}}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Model</TableCell>
                        <TableCell>Prediction</TableCell>
                        <TableCell>Confidence</TableCell>
                        <TableCell>Trust</TableCell>
                        <TableCell>Model weight</TableCell>
                        <TableCell>Model score</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(x[2] || {}).map(([k, v]) => (
                        <TableRow key={`why-${row.id}-${idx}-${k}`}
                                  style={{backgroundColor: v?.model_score > 0 ? '#a8f099' : '#f0a699'}}>
                          <TableCell>{k}</TableCell>
                          <TableCell>{String(v?.prediction)}</TableCell>
                          <TableCell>{typeof v?.confidence === 'number' ? v.confidence.toFixed(3) : String(v?.confidence)}</TableCell>
                          <TableCell>{typeof v?.trust === 'number' ? v.trust.toFixed(3) : String(v?.trust)}</TableCell>
                          <TableCell>{typeof v?.model_weight === 'number' ? v.model_weight.toFixed(3) : String(v?.model_weight)}</TableCell>
                          <TableCell>{typeof v?.model_score === 'number' ? v.model_score.toFixed(3) : String(v?.model_score)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell><b>Ensemble</b></TableCell>
                        <TableCell><b>true</b></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell><b>{typeof x[3] === 'number' ? x[3].toFixed(3) : String(x[3])}</b></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    );

    return (
      <Box>
        <Collapse in={!isExpanded} timeout="auto" unmountOnExit>
          {collapsedView}
        </Collapse>
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          {expandedView}
        </Collapse>
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
      axios.post('/api/details', {smiles: thisRow.smiles, selectedModels: buildSelectedModels()}).then(response => {
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
        setLastPredictedModel(selectedModel);
        setHasPredicted(true);
        setPredictionsLoading(true);
        axios({
          url: '/api/classify',
          method: 'post',
          data: {
            smiles: smiles,
            ontology: true,
            selectedModels: selectedModels
          }
        }).then(response => {
          setRows((old) => old.map((row, i) => ({
            ...row,
            direct_parents: response.data.direct_parents[i],
            predicted_parents: response.data.predicted_parents[i],
            ontology: response.data.ontology[0][i],
          })));
        }).finally(() => setPredictionsLoading(false));
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
      "direct_parents": r["direct_parents"].map(element => [element[0], element[1]]),
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
              backgroundColor: '#f7f2e7',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <Box sx={{
                padding: 2,
                backgroundColor: '#f0f0f0',
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
                      label="Enter SMILES (one per line)"
                      placeholder="Cn1c(=O)c2c(ncn2C)n(C)c1=O"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          e.preventDefault();
                          if (!modelsLoaded || predictionsLoading) return;
                          const smiles = inputText.trim().replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
                          if (smiles.length === 0) return;
                          // initialize rows and run classification
                          addRows(smiles);
                          setLastPredictedModel(selectedModel);
                          setHasPredicted(true);
                          setPredictionsLoading(true);
                          axios({
                            url: '/api/classify',
                            method: 'post',
                            data: {
                              smiles: smiles,
                              ontology: true,
                              selectedModels: selectedModels
                            }
                          }).then(response => {
                            setRows((old) => old.map((row, i) => ({
                              ...row,
                              direct_parents: response.data.direct_parents[i],
                              predicted_parents: response.data.predicted_parents[i],
                              ontology: response.data.ontology[0][i],
                            })));
                          }).finally(() => setPredictionsLoading(false));
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
                      {/* Hidden file input for SMILES upload */}
                      <input
                        type="file"
                        accept="text/plain"
                        style={{display: 'none'}}
                        ref={fileInputRef}
                        onChange={handleUpload}
                      />
                      <Tooltip title="Upload SMILES from file (one per line)">
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
                        onClick={() => {
                          const smiles = inputText.trim().replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
                          if (smiles.length === 0) return;
                          const ids = smiles.map(() => randomId());
                          setRows(smiles.map((s, i) => ({
                            id: ids[i],
                            smiles: s,
                            direct_parents: [],
                            predicted_parents: []
                          })));
                          setLastPredictedModel(selectedModel);
                          setHasPredicted(true);
                          setPredictionsLoading(true);
                          axios({
                            url: '/api/classify',
                            method: 'post',
                            data: {
                              smiles: smiles,
                              ontology: true,
                              selectedModels: selectedModels
                            }
                          }).then(response => {
                            setRows((old) => old.map((row, i) => ({
                              ...row,
                              direct_parents: response.data.direct_parents[i],
                              predicted_parents: response.data.predicted_parents[i],
                              ontology: response.data.ontology[0][i],
                            })));
                          }).finally(() => setPredictionsLoading(false));
                        }}
                        disabled={predictionsLoading || !modelsLoaded}
                        startIcon={predictionsLoading ? <CircularProgress size={20}/> : <SlChemistry/>}
                      >
                        Predict
                      </Button>
                    </Box>
                  </Box>

                </Box>
              </Paper>

              {hasPredicted && (
                <Paper sx={{
                  mt: 2,
                  width: '90%',
                  mx: 'auto',
                  p: 2,
                  backgroundColor: '#ffffff',
                  borderRadius: 2,
                  boxShadow: 1,
                  overflowX: 'auto'
                }}>
                  {rows.length > 0 && (
                    <Box>
                      {rows.map((row) => {
                        const canExpand = (row.direct_parents) && !predictionsLoading;
                        return (
                          <Paper key={row.id} sx={{p: 2, mb: 1}}
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
                              <Typography variant="subtitle2">{row.smiles}</Typography>
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
                              <Box sx={{mt: 1}}>
                                {renderClasses({value: row.direct_parents, row})}
                              </Box>
                            )}
                            {expandedRowId === row.id && (
                              <Box sx={{mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2}}>
                                <Paper sx={{p: 2, flex: '1 1 700px', minWidth: 400}}>
                                  <Typography variant="subtitle2" gutterBottom>Predicted classes</Typography>
                                  {renderClasses({value: row.direct_parents, row})}
                                </Paper>
                                <Paper sx={{p: 2, flex: '1 1 280px', minWidth: 250, overflowX: 'auto'}}>
                                  <Typography variant="subtitle2" gutterBottom>Molecular graph</Typography>
                                  <MoleculeStructure smiles={row.smiles} height={250} width={250}/>
                                </Paper>
                                <Paper sx={{p: 2, flex: '2 1 820px', minWidth: 820, overflowX: 'auto'}}>
                                  <Typography variant="subtitle2" gutterBottom>Ontology graph</Typography>
                                  {plot_ontology(row.ontology, true, false)}
                                </Paper>
                                <Paper sx={{p: 2, flex: '1 1 600px', minWidth: 500, overflow: 'hidden'}}>
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
                      <Divider sx={{my: 2}}/>
                    </Box>
                  )}
                </Paper>
              )}

            </Box>
          );
        })()}
      </header>
    </div>
  );
}
