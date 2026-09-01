import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import axios from "axios";
import * as React from "react";
import {SlChemistry} from "react-icons/sl";

/** One titled block of the page. Each section is its own card, so where one topic ends and the
 * next begins is visible before a word is read. */
const Section = ({title, children}) => (
    <Paper sx={{
        width: '100%',
        p: 3,
        mb: 2,
        backgroundColor: '#ffffff',
        borderRadius: 2,
        border: '1px solid #2a78d6',
        boxShadow: 0,
        textAlign: 'left',
    }}>
        {title && (
            <>
                <Typography
                    variant="h5"
                    component="h2"
                    sx={{display: 'flex', alignItems: 'center', gap: 1, fontSize: '1.4rem'}}
                >
                    <SlChemistry style={{flexShrink: 0}}/> {title}
                </Typography>
                <Divider sx={{mt: 1, mb: 2}}/>
            </>
        )}
        {children}
    </Paper>
);

const About = () => {
    const [availableModels, setAvailableModels] = React.useState([]);
    const [availableModelsInfoTexts, setAvailableModelsInfoTexts] = React.useState([]);
    const [numClasses, setNumClasses] = React.useState(null);

    // Load once on mount so About content is fetched when the site loads
    React.useEffect(() => {
        axios.get('/api/modelinfo').then(response => {
            setAvailableModels(response.data.available_models || []);
            setAvailableModelsInfoTexts(response.data.available_models_info_texts || []);
            setNumClasses(response.data.n_classes || null);
        }).catch(() => {
            // silently ignore, page content still renders
        });
    }, []);

    return (
        <div className="App">
            <header className="App-header">
                <Box sx={{
                    width: '100%',
                    minHeight: '100vh',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pt: 2,
                    pb: 4,
                }}>
                    <Box sx={{width: '90%', maxWidth: '900px', textAlign: 'left'}}>
                        <Section>
                            <Typography variant="h4" component="h1" gutterBottom>About Chebifier</Typography>
                            <Typography variant="body1" paragraph>
                                Chebifier is a tool for automated classification of chemicals in
                                the <Link href="https://www.ebi.ac.uk/chebi/">ChEBI</Link> ontology. It currently
                                predicts {numClasses ? numClasses.toLocaleString('en-US') : '2,200+'} ChEBI classes.
                            </Typography>
                            <Typography variant="body1" sx={{mb: 0}}>
                                To run a prediction, enter SMILES or InChI strings (one per line)
                                or upload a file. Running the models might take a few
                                seconds. Click on a result for more details about the prediction.
                            </Typography>
                            <Typography variant="body1" paragraph>
                                Chebifier is developed as part of the <Link href="https://hastingslab.org/projects/2_project/">StrOntEx project</Link>.
                                For more information on Chebifier, checkout the <Link href="https://github.com/ChEB-AI/python-chebifier">GitHub repository</Link> and 
                                our <Link href="https://www.researchsquare.com/article/rs-9023090/v1">latest publication (Flügel et al, 2026: Chebifier 2)</Link>.
                            </Typography>
                        </Section>

                        <Section title="The Ensemble">
                            <Typography variant="body1" paragraph>
                                Chebifier combines machine learning models, rule-based methods and a ChEBI lookup.
                                For every class, each model that covers it casts a vote. This vote gets weighted by how
                                reliable it proved to be for that class on validation data and
                                the model weight you can modify in the ensemble settings.
                            </Typography>
                            <Typography variant="body1" paragraph>
                                The resulting predictions are checked for consistency with the ChEBI ontology and 
                                corrected if necessary. The final predictions are then sorted by their confidence score and displayed to the user.
                            </Typography>
                            <Typography variant="body1" sx={{mb: 0}}>
                                Clicking a class in the ontology graph of a result shows how much of the decision
                                each model is responsible for. The ensemble settings also let you trade precision
                                against recall. More precision means that the ensemble is more conservative in its predictions.
                                More recall equates to a more daring ensemble. Note that these values are based on the ChEBI test
                                set and will be optimistic for unusual molecules and rare classes. 
                            </Typography>
                        </Section>

                        <Section title="Models">
                            <Typography variant="body1" paragraph>
                                At the moment, the following prediction models are supported by Chebifier. You can
                                either use them together in the ensemble or select a single model.
                            </Typography>
                            {availableModels.map((model, index) => (
                                <Box key={`model-${model}-${index}`} sx={{mb: index === availableModels.length - 1 ? 0 : 2}}>
                                    <Typography variant="subtitle1" component="h3" sx={{fontWeight: 600}}>
                                        {model}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        component="div"
                                        color="text.secondary"
                                        sx={{"& p": {margin: 0}}}
                                        dangerouslySetInnerHTML={{__html: availableModelsInfoTexts[index]}}
                                    />
                                </Box>
                            ))}
                        </Section>

                        <Section title="News">
                            {[
                                ['09/2026', 'Re-calibrated ensemble. Added new, better deep learning models trained on ChEBI ' +
                                'version 252. This increased the coverage by ~500 classes. Improved user interface, added InChI support and model attributions. Model weights can now be set manually' +
                                ''],
                                ['02/2026', 'Added Lopster and new deep learning models.'],
                                ['11/2025', 'Added new models (Graph Attention Networks and augmented Graph Neural ' +
                                'Networks). Improved the ensemble weighting mechanism. Redesigned the user interface.'],
                                ['08/2025', 'Added the ensemble. Added ChemLog, C3P and Graph Convolutional Networks.'],
                            ].map(([date, text], index, entries) => (
                                <Box key={date} sx={{display: 'flex', gap: 2, mb: index === entries.length - 1 ? 0 : 1.5}}>
                                    <Typography variant="body1" sx={{fontWeight: 600, minWidth: 72, flexShrink: 0}}>
                                        {date}
                                    </Typography>
                                    <Typography variant="body1">{text}</Typography>
                                </Box>
                            ))}
                        </Section>

                        <Section title="Main publication for Chebifier">
                            <Typography variant="body1" sx={{mb: 0}}>
                                Glauer, Martin, et al.: Chebifier: Automating Semantic Classification in ChEBI to
                                Accelerate Data-driven Discovery; Digital Discovery 3.5 (2024), <Link
                                href="https://doi.org/10.1039/D3DD00238A">Link</Link>
                            </Typography>
                        </Section>

                        <Section title="Your data">
                            <Typography variant="body1" sx={{mb: 0}}>
                                Chebifier does not store any information about you or your data.
                            </Typography>
                        </Section>
                    </Box>
                </Box>
            </header>
        </div>
    );
};

export default About;
