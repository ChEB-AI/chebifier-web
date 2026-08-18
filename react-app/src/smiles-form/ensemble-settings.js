import * as React from 'react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import TuneIcon from '@mui/icons-material/Tune';
import Typography from '@mui/material/Typography';

/**
 * Popover for tuning how much say each base learner has in the ensemble vote. The weight scales a
 * model's votes for every class, on top of the confidence and the class-wise reliability the
 * ensemble weights them by. A weight of 0 silences a model without removing it.
 */
export default function EnsembleSettings({
                                           models,
                                           weights,
                                           defaultWeights,
                                           onChange,
                                           onReset,
                                           onRerun,
                                           canRerun,
                                           disabled,
                                           operatingPoints,
                                           threshold,
                                           defaultThreshold,
                                           onThresholdChange,
                                           resolveInconsistencies,
                                           onResolveChange,
                                         }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  if (!models || models.length === 0) return null;

  const weightOf = (model) => Number(weights[model] ?? defaultWeights[model] ?? 1);
  const changed = models.filter((model) => weightOf(model) !== Number(defaultWeights[model] ?? 1));

  // The operating points are ordered by threshold, so precision rises and recall falls along the
  // list. Both sliders address the same index, which is what makes one give way to the other.
  const points = operatingPoints || [];
  const last = points.length - 1;
  const nearestIndex = (value) => {
    let best = 0;
    points.forEach((point, index) => {
      if (Math.abs(point.threshold - value) < Math.abs(points[best].threshold - value)) best = index;
    });
    return best;
  };
  const index = points.length ? nearestIndex(threshold) : 0;
  const point = points[index];
  const percent = (value) => `${(value * 100).toFixed(1)}%`;
  const thresholdChanged = points.length > 0 && index !== nearestIndex(defaultThreshold);
  const settingsChanged = changed.length > 0 || thresholdChanged || !resolveInconsistencies;

  const operatingPointSection = points.length === 0 ? null : (
    <>
      <Typography variant="subtitle2" sx={{mb: 0.5}}>Precision vs. recall</Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{mb: 1.5}}>
        Experimental. The percentages are what the ensemble reached on the ChEBI test set - on
        molecules unlike those, and on rare classes, it will be less reliable than they suggest.
      </Typography>
      <Box sx={{display: 'grid', gridTemplateColumns: 'minmax(70px, auto) 1fr 56px', columnGap: 1.5, rowGap: 0.5, alignItems: 'center'}}>
        <Typography variant="body2">Precision</Typography>
        <Slider
          size="small"
          min={0}
          max={last}
          step={1}
          value={index}
          onChange={(e, value) => onThresholdChange(points[value].threshold)}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => percent(points[value].precision)}
          aria-label="Precision"
        />
        <Typography variant="caption" sx={{textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>
          {percent(point.precision)}
        </Typography>
        <Typography variant="body2">Recall</Typography>
        <Slider
          size="small"
          min={0}
          max={last}
          step={1}
          // recall falls as the index rises, so this slider runs the other way round
          value={last - index}
          onChange={(e, value) => onThresholdChange(points[last - value].threshold)}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => percent(points[last - value].recall)}
          aria-label="Recall"
        />
        <Typography variant="caption" sx={{textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>
          {percent(point.recall)}
        </Typography>
      </Box>
      <Divider sx={{my: 2}}/>
    </>
  );

  return (
    <>
      <Tooltip title="Ensemble settings: precision/recall and model weights">
        <span>
          <IconButton
            size="small"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            disabled={disabled}
            aria-label="Ensemble settings"
            sx={{height: 36, width: 36}}
          >
            <Badge color="primary" variant="dot" invisible={!settingsChanged}>
              <TuneIcon fontSize="small"/>
            </Badge>
          </IconButton>
        </span>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{vertical: 'bottom', horizontal: 'left'}}
        slotProps={{paper: {sx: {p: 2, width: 440, maxWidth: '90vw'}}}}
      >
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={resolveInconsistencies}
              onChange={(e) => onResolveChange(e.target.checked)}
            />
          }
          label={
            <Tooltip title="Correct predictions that contradict the ChEBI hierarchy or its disjointness axioms">
              <Typography variant="body2">Resolve inconsistencies</Typography>
            </Tooltip>
          }
          sx={{ml: 0, mb: 1.5}}
        />
        <Divider sx={{mb: 2}}/>
        {operatingPointSection}
        <Typography variant="subtitle2" sx={{mb: 1.5}}>Model weights</Typography>
        <Box sx={{display: 'grid', gridTemplateColumns: 'minmax(120px, auto) 1fr 32px', columnGap: 1.5, rowGap: 0.5, alignItems: 'center'}}>
          {models.map((model) => (
            <React.Fragment key={`weight-${model}`}>
              <Typography variant="body2" noWrap title={model}>{model}</Typography>
              <Slider
                size="small"
                min={0}
                max={100}
                step={1}
                value={weightOf(model)}
                onChange={(e, value) => onChange(model, value)}
                valueLabelDisplay="auto"
                aria-label={`Model weight for ${model}`}
              />
              <Typography variant="caption" sx={{textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>
                {weightOf(model)}
              </Typography>
            </React.Fragment>
          ))}
        </Box>
        <Box sx={{mt: 1.5, display: 'flex', gap: 1}}>
          <Button size="small" startIcon={<RestartAltIcon/>} onClick={onReset} disabled={!settingsChanged}>
            Reset
          </Button>
          {canRerun && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setAnchorEl(null);
                onRerun();
              }}
            >
              Re-run
            </Button>
          )}
        </Box>
      </Popover>
    </>
  );
}
