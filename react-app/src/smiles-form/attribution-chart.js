import * as React from 'react';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

// Two poles that read as opposite and stay separable under colour-vision deficiency
// (validated: worst CVD deltaE 23.8, contrast >= 3:1 on a light surface). The arrow beside each
// bar repeats the direction, so the colour never carries it alone.
const VOTE_STYLE = {
  1: {color: '#2a78d6', label: 'supports', Icon: ArrowDropUpIcon},
  '-1': {color: '#d03b3b', label: 'opposes', Icon: ArrowDropDownIcon},
};

const formatPrediction = (value) =>
  typeof value === 'number' ? value.toFixed(3) : '–';

const formatShare = (share) => {
  if (typeof share !== 'number') return '–';
  if (share > 0 && share < 0.001) return '<0.1%';
  return `${(share * 100).toFixed(1)}%`;
};

function ScoreBar({score, threshold}) {
  const value = typeof score === 'number' ? Math.min(Math.max(score, 0), 1) : 0;
  return (
    <Box sx={{width: '100%', maxWidth: 420}}>
      <Box sx={{display: 'flex', alignItems: 'baseline', gap: 1}}>
        <Typography variant="h6" sx={{fontVariantNumeric: 'tabular-nums'}}>
          {typeof score === 'number' ? score.toFixed(3) : '–'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ensemble score (predicted above {threshold})
        </Typography>
      </Box>
      <Box sx={{position: 'relative', height: 10, borderRadius: '4px', backgroundColor: '#ececea', mt: 0.5}}>
        <Box sx={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${value * 100}%`,
          backgroundColor: value > threshold ? '#2a78d6' : '#d03b3b',
          borderRadius: '4px',
        }}/>
        <Box sx={{
          position: 'absolute', top: -3, bottom: -3,
          left: `${threshold * 100}%`,
          width: 2, backgroundColor: '#6b6a65',
        }}/>
      </Box>
      <Box sx={{display: 'flex', justifyContent: 'space-between'}}>
        <Typography variant="caption" color="text.secondary">0</Typography>
        <Typography variant="caption" color="text.secondary">1</Typography>
      </Box>
    </Box>
  );
}

/**
 * Per-model attributions for one predicted class: the share of the ensemble decision each base
 * learner is responsible for (the shares sum to 1), together with the raw 0-1 prediction the
 * model made for this class. Models that did not cover the class are left out - they cast no vote
 * and hold no share.
 */
export default function AttributionChart({calculations, netScore, threshold = 0.5}) {
  const entries = Object.entries(calculations || {}).filter(([, values]) => values?.vote);
  const maxShare = Math.max(...entries.map(([, v]) => v?.attribution || 0), 0.001);

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 1.5}}>
      <ScoreBar score={netScore} threshold={threshold}/>

      {entries.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No model made a prediction for this class. It was predicted because it follows from the
          predictions for classes below it in the ChEBI hierarchy.
        </Typography>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(140px, auto) auto 1fr auto',
          columnGap: 1.5, rowGap: 0.75, alignItems: 'center'
        }}>
          <Typography variant="caption" color="text.secondary">Model</Typography>
          <Typography variant="caption" color="text.secondary">Prediction</Typography>
          <Typography variant="caption" color="text.secondary">Share</Typography>
          <span/>
          {entries.map(([model, values]) => {
            const vote = VOTE_STYLE[String(values.vote)];
            const share = values?.attribution || 0;
            const VoteIcon = vote.Icon;
            return (
              <React.Fragment key={`attr-${model}`}>
                <Typography variant="body2" noWrap title={model}>{model}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{fontVariantNumeric: 'tabular-nums'}}>
                  {formatPrediction(values?.prediction)}
                </Typography>
                <Tooltip
                  placement="top"
                  title={`${model}: prediction ${formatPrediction(values?.prediction)}, ${vote.label} this class, ${formatShare(share)} of the decision`}
                >
                  <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5}}>
                    <VoteIcon sx={{fontSize: 18, color: vote.color}}/>
                    <Box sx={{position: 'relative', flex: 1, height: 10, backgroundColor: '#f2f2f0', borderRadius: '4px'}}>
                      <Box sx={{
                        position: 'absolute', left: 0, top: 0, bottom: 0,
                        width: `${Math.max((share / maxShare) * 100, share > 0 ? 1 : 0)}%`,
                        backgroundColor: vote.color,
                        borderRadius: '4px',
                      }}/>
                    </Box>
                  </Box>
                </Tooltip>
                <Typography variant="caption" sx={{textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>
                  {formatShare(share)}
                </Typography>
              </React.Fragment>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
