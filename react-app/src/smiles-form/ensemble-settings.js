import * as React from 'react';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
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
                                         }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  if (!models || models.length === 0) return null;

  const weightOf = (model) => Number(weights[model] ?? defaultWeights[model] ?? 1);
  const changed = models.filter((model) => weightOf(model) !== Number(defaultWeights[model] ?? 1));

  return (
    <>
      <Tooltip title="Ensemble settings: model weights">
        <span>
          <IconButton
            size="small"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            disabled={disabled}
            aria-label="Ensemble settings"
            sx={{height: 36, width: 36}}
          >
            <Badge color="primary" variant="dot" invisible={changed.length === 0}>
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
        slotProps={{paper: {sx: {p: 2, width: 420, maxWidth: '90vw'}}}}
      >
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
          <Button size="small" startIcon={<RestartAltIcon/>} onClick={onReset} disabled={changed.length === 0}>
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
              Re-run with these weights
            </Button>
          )}
        </Box>
      </Popover>
    </>
  );
}
