import React from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import Typography from '@mui/material/Typography';

import Alert from "@mui/material/Alert";
import { loadRDKit } from '../lib/rdkit-loader';


const GLOBAL_MOL_PARAMS = {
	width: 300,
	height: 300,
}

const LayerComponent = (data) => {
    const [value, setValue] = React.useState(0);

    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    if (data.mol === null) {
      return (
        <Alert severity="error">RDKit failed to process input!</Alert>
      )
    }

    return (
        <Box sx={{width: '100%', typography: 'body1'}}>
            <TabContext value={value}>
                <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                    <TabList onChange={handleChange} aria-label="lab API tabs example">
                        {data.layer.highlights.map((highlight, i) => <Tab label={data.layer.name + " " + (i + 1)} value={i}/>)}
                    </TabList>
                </Box>
                {data.layer.highlights.map((g, i) => <TabPanel value={i}><div className="svg-mol" dangerouslySetInnerHTML={{__html: data.mol.get_svg_with_highlights(JSON.stringify({...GLOBAL_MOL_PARAMS, 'atoms': g}))}}></div></TabPanel>)}
            </TabContext>
        </Box>
    );
}


export function LayerTabs(data) {
    const [value, setValue] = React.useState(0);
    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    return (
        <Box sx={{width: '100%', typography: 'body1'}}>
            <TabContext value={value}>
                <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                    <TabList onChange={handleChange} aria-label="lab API tabs example">
                        {data.layers.map((layer, i) => <Tab label={layer.name} value={i} centered/>)}
                    </TabList>
                </Box>
                {data.layers.map((layer, i) => <TabPanel value={i}><LayerComponent mol={data.mol} layer={layer}/></TabPanel>)}
            </TabContext>
        </Box>
    );
}


export function HighlightsBlocks(data) {
    var blocks = data.highlights;
    var blocks_content = [];
    for (let i = 0; i < blocks.length; i++) {
    	var block_type = blocks[i][0];
    	var block_content = blocks[i][1];


    	if (block_type === "text") {
			blocks_content.push(
				<Box>
					<Typography>{block_content}</Typography>
				</Box>
			);
		} else if (block_type === "single") {
			var mdetails = {...GLOBAL_MOL_PARAMS};
			mdetails["atoms"] = block_content;
			var svg_mol = data.mol.get_svg_with_highlights(JSON.stringify(mdetails));
			blocks_content.push(
				<Box>
					<div className="svg-mol" dangerouslySetInnerHTML={{__html: svg_mol}}></div>
				</Box>
			);

		} else if (block_type === "tabs") {
			var layers = [];
			for (const[key, value] of Object.entries(block_content)) {
				layers.push({name: key, highlights: value});
			}

			blocks_content.push(
				<LayerTabs layers={layers} mol={data.mol}/>
			);
		} else if (block_type === "heading") {
			blocks_content.push(
				<Box>
					<h5>{block_content}</h5>
				</Box>
			);
		} else {
			console.log("Unidentified block type:", block_type)
		}
	}
	return blocks_content;

}


export function DetailsBlockwise(data) {
    data = data.model_data;
    const smiles = data.smiles;
    // RDKit is fetched once for the whole app, so it may not be there on the first render
    const [rdkit, setRdkit] = React.useState(window.RDKit || null);
    React.useEffect(() => {
        let mounted = true;
        loadRDKit().then((module) => {
            if (mounted) setRdkit(module);
        }).catch(() => {});
        return () => {
            mounted = false;
        };
    }, []);
    var mol = null;
    if (rdkit && !(smiles === null || smiles === undefined)) {
        mol = rdkit.get_mol(smiles);
    }
  	//var svg_mol = mol.get_svg_with_highlights(JSON.stringify(GLOBAL_MOL_PARAMS));
  	//svg_mol = svg_mol.substring(svg_mol.indexOf("<svg"));

    return (
        <Box>
			<HighlightsBlocks highlights={data.highlights} mol={mol}/>
		</Box>
    )
}


