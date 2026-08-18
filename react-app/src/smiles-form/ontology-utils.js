import {useEffect, useRef} from "react";
import * as React from 'react';
import {Network} from "vis-network";

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { loadRDKit } from '../lib/rdkit-loader';
import Alert from "@mui/material/Alert";

const MIN_SCALE = 0.62;
// grey, and dashed, so a near miss is never mistaken for a prediction
const NEAR_MISS_COLOR = {background: '#f0efec', border: '#a8a69c', highlight: {background: '#e4e2dc', border: '#8a887e'}};
const ROOT_COLOR = {background: '#eceae3', border: '#c3bfb2', highlight: {background: '#e2dfd5', border: '#a9a496'}};
const CLASS_COLOR = {background: '#dbe8fa', border: '#2a78d6', highlight: {background: '#bcd6f6', border: '#1b5ea9'}};

const GRAPH_OPTIONS = {
    layout: {
        hierarchical: {
            enabled: true,
            // the top class sits at the top and the hierarchy grows downwards from it
            direction: 'UD',
            sortMethod: 'directed',
            levelSeparation: 62,
            nodeSpacing: 150,
            treeSpacing: 110,
            parentCentralization: true,
        },
    },
    physics: false,
    nodes: {
        shape: 'box',
        margin: 6,
        widthConstraint: {maximum: 140},
        borderWidth: 1,
        font: {size: 13, face: 'inherit', color: '#1a1a1a', multi: false},
        shadow: false,
    },
    edges: {
        arrows: {to: {enabled: true, scaleFactor: 0.6}},
        color: {color: '#9fb3c8', highlight: '#2a78d6'},
        smooth: {enabled: true, type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.55},
        width: 1,
    },
    interaction: {
        dragNodes: false,
        dragView: true,
        zoomView: true,
        hover: true,
        selectConnectedEdges: false,
        tooltipDelay: 300,
    },
};

/**
 * The predicted part of the ChEBI hierarchy, drawn top-down from the class every molecule belongs
 * to. Selecting a node reports it to the parent, which shows why that class was predicted.
 */
export function OntologyGraph({graph, selected, onSelect, showNearMisses = false, height = '620px'}) {
    const visJsRef = useRef(null);
    const networkRef = useRef(null);
    // kept in refs so that re-rendering the parent does not rebuild the network
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const selectedRef = useRef(selected);
    selectedRef.current = selected;

    const fitView = React.useCallback(() => {
        const network = networkRef.current;
        if (!network) return;
        network.fit();
        // fit() alone shrinks a deep hierarchy until the labels are unreadable; below this scale
        // the graph is pannable instead
        if (network.getScale() < MIN_SCALE) network.moveTo({scale: MIN_SCALE});
    }, []);

    useEffect(() => {
        if (!graph || !visJsRef.current) return undefined;
        const rootId = Object.keys(graph.nodes).find((id) => graph.nodes[id].root);
        const visible = new Set(
            Object.keys(graph.nodes).filter((id) => showNearMisses || !graph.nodes[id].near_miss)
        );
        const nodes = [...visible].map((id) => {
            const node = graph.nodes[id];
            const visNode = {
                id,
                label: node.name || id,
                title: node.root
                    ? 'Every molecule is a molecular entity'
                    : node.near_miss ? `${node.name} (not predicted)` : node.name,
                color: node.root ? ROOT_COLOR : node.near_miss ? NEAR_MISS_COLOR : CLASS_COLOR,
            };
            if (node.near_miss) {
                // vis merges these into its defaults, so they are only set where they apply -
                // handing it `undefined` replaces the default object and breaks rendering
                visNode.font = {color: '#5c5b56'};
                visNode.shapeProperties = {borderDashes: [4, 3]};
            }
            return visNode;
        });

        const hierarchy = graph.edges.filter(([child, parent]) => visible.has(child) && visible.has(parent));
        // a class whose only superclass is hidden would float free, so it falls back to the root
        const hasSuperclass = new Set(hierarchy.map(([child]) => child));
        const orphans = [...visible].filter((id) => id !== rootId && !hasSuperclass.has(id));
        // is-a edges point from a class to its superclass, while the layout grows downwards from
        // the superclass - so the edges are handed to vis the other way round
        const edges = [...hierarchy, ...orphans.map((id) => [id, rootId])]
            .map(([child, parent]) => ({from: parent, to: child}));

        const network = new Network(visJsRef.current, {nodes, edges}, {...GRAPH_OPTIONS, height});
        networkRef.current = network;
        network.on('selectNode', (params) => onSelectRef.current(params.nodes[0] || null));
        network.on('deselectNode', () => onSelectRef.current(null));
        fitView();
        if (selectedRef.current && visible.has(selectedRef.current)) {
            network.selectNodes([selectedRef.current]);
        }
        return () => {
            network.destroy();
            networkRef.current = null;
        };
    }, [graph, height, showNearMisses, fitView]);

    // follow a selection that was cleared or set from outside the graph
    useEffect(() => {
        if (!networkRef.current) return;
        networkRef.current.selectNodes(selected ? [selected] : []);
    }, [selected]);

    if (!graph) return null;

    return (
        <Box>
            <Box sx={{position: 'relative'}}>
                <div ref={visJsRef} style={{height}}/>
                <Tooltip title="Fit the graph back into view">
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<CenterFocusStrongIcon/>}
                        onClick={fitView}
                        sx={{position: 'absolute', top: 8, left: 8, backgroundColor: '#ffffff'}}
                    >
                        Reset view
                    </Button>
                </Tooltip>
            </Box>
            <Typography variant="caption" color="text.secondary">
                Click a class to see why it was predicted. Scroll to zoom, drag to pan.
            </Typography>
        </Box>
    );
}

export function MoleculeStructure(data) {
  const [svg, setSvg] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    let mol = null;

    async function run() {
      try {
        const RDKit = await loadRDKit();
        if (!mounted) return;
        mol = RDKit.get_mol(data.smiles);
        if (!mol || mol.is_valid?.() === false) {
          throw new Error('Invalid molecule');
        }
        const svgStr = mol.get_svg();
        if (mounted) setSvg(svgStr);
      } catch (e) {
        if (mounted) setError(String(e));
      } finally {
        if (mol) mol.delete?.();
      }
    }

    if (data.smiles) run();
    return () => { mounted = false; };
  }, [data.smiles]);

  if (error) return <Alert severity="error">RDKit failed to process input!</Alert>
  if (!svg) return <div>Loading molecule…</div>;

  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg.replace('<svg', `<svg width="${data.width}" height="${data.height}"`) }}
    />
  );
}