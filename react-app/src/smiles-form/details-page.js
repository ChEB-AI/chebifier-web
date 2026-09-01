import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Box from '@mui/material/Box';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Typography from '@mui/material/Typography';

import {DetailsElectra} from "./details-electra";
import {DetailsBlockwise} from "./details-page-chemlog";

export function DetailsPerModel(data) {
  const models_info = data.models_info || {};
  return (
    <Box sx={{ mt: 2 }}>
      {Object.entries(models_info).map(([model_name, model_data]) => (
        <Accordion key={model_name} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">Insights for {model_name}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {model_data?.model_type === "ElectraPredictor" ? (
              <DetailsElectra model_data={model_data} />
            ) : (
              <DetailsBlockwise model_data={model_data} />
            )}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default function DetailsPage(data) {
  // Render directly inside parent Paper; do not include own Paper or close button
  const detail = data.detail;

  if (!detail) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {DetailsPerModel(detail)}
    </Box>
  );
}


