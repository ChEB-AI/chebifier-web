import React from 'react';
import axios from 'axios'

import {useEffect, useRef} from "react";
import {Network} from "vis-network";

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CancelIcon from '@mui/icons-material/Close';
import Divider from '@mui/material/Divider';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {styled} from '@mui/material/styles';

import Alert from "@mui/material/Alert";


const GLOBAL_MOL_PARAMS = {
	width: 300,
	height: 300,
}
window
      .initRDKitModule()
      .then(function (RDKit) {
        console.log("RDKit version: " + RDKit.version());
        window.RDKit = RDKit;
        /**
         * The RDKit module is now loaded.
         * You can use it anywhere.
         */
      })
      .catch(() => {
        // handle loading errors here...
      });


const NetworkElement = (data) => {
    const visJsRef = useRef(null);
    useEffect(() => {
        if(data.graph != null){
            const g = {
                nodes: data.graph.nodes,
                edges: data.graph.edges
            }
            const network = visJsRef.current && new Network(
                visJsRef.current, g, {
                physics: false,
                width: "100%",
                height: "100%",
                clickToUse: true
            });
            network.fit()
        }
    }, [visJsRef, data]);
    return <Box><div ref={visJsRef}/></Box>
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
	const [value, setValue] = React.useState(0);
    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

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
    const handleClose = data.handleClose;
    data = data.model_data;
    var smiles = data.smiles
    var mol = null;
    if (!(smiles === null || smiles === undefined)) {
        mol = window.RDKit.get_mol(smiles);
    }
  	//var svg_mol = mol.get_svg_with_highlights(JSON.stringify(GLOBAL_MOL_PARAMS));
  	//svg_mol = svg_mol.substring(svg_mol.indexOf("<svg"));

    return (
        <Box>
			<HighlightsBlocks highlights={data.highlights} mol={mol}/>
		</Box>
    )
}


