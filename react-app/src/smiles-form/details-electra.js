import React from 'react';

import {useEffect, useRef} from "react";
import {Network} from "vis-network";

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import Typography from '@mui/material/Typography';


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

    return (
        <Box sx={{width: '100%', typography: 'body1'}}>
            <TabContext value={value}>
                <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                    <TabList onChange={handleChange} aria-label="lab API tabs example">
                        {data.layer.map((layer, i) => <Tab label={"Head " + (i + 1)} value={i}/>)}
                    </TabList>
                </Box>
                {data.layer.map((g, i) => <TabPanel value={i}>< NetworkElement graph={g} /></TabPanel>)}
            </TabContext>
        </Box>
    );
}


export function LayerTabs(layers) {
    const [value, setValue] = React.useState(0);
    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    return (
        <Box sx={{width: '100%', typography: 'body1'}}>
            <TabContext value={value}>
                <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                    <TabList onChange={handleChange} aria-label="lab API tabs example">
                        {layers.layers.map((layer, i) => <Tab label={"Layer " + (i + 1)} value={i} centered/>)}
                    </TabList>
                </Box>
                {layers.layers.map((layer, i) => <TabPanel value={i}><LayerComponent layer={layer}/></TabPanel>)}
            </TabContext>
        </Box>
    );
}


export function DetailsElectra(data) {
	data = data.model_data;
	console.log(data);
	return (
		<Box>
        	<Typography><h2>Attention</h2></Typography>
            <Typography>
            	<h3>What am I seeing?</h3>
            	The model iterates over all parts of the molecule. For each of this parts, the
                system is distributing its attention over all parts of the molecule. E.g. if an
                opening parenthesis is encountered, the system may try to identify the closing
                counterpart. The parts of the molecule that the system is paying attention to, are
                indicated by lines. Darker shades indicate stronger attention.
            </Typography>
       		<Box sx={{height: "400px"}}>
           		<LayerTabs layers={data.graphs}/>
            </Box>
        </Box>
    );
}