/**
 * @jest-environment node
 */
// Runs against the real RDKit wasm (jsdom can't load it, hence the node environment above).
import path from 'path';
import { getMol } from './rdkit-mol';

// CHEBI:65618 as served by ChEBI online: the aromatic N lacks its H, so RDKit can't kekulize it
const UNKEKULIZABLE = '[H][C@@]12NC(=O)[C@@H](c3cc(Cl)c(O)c(Cl)c3)NC(=O)[C@H](NC(=O)C(=O)c3cc(Cl)c(O)c(Cl)c3)Cc3cnc4c(cccc34)-c3cc1cc(c3O)Oc1ccc(cc1)C[C@@]([H])(C(=O)N[C@@H](C(=O)O)c1ccc(O)cc1)N(C)C(=O)[C@@H](c1cc(Cl)c(O)c(Cl)c1)NC2=O';

let RDKit;
beforeAll(async () => {
  const dist = path.dirname(require.resolve('@rdkit/rdkit/dist/RDKit_minimal.js'));
  const initRDKitModule = require('@rdkit/rdkit/dist/RDKit_minimal.js');
  RDKit = await initRDKitModule({locateFile: (file) => path.join(dist, file)});
}, 30000);

function svgOf(input) {
  const mol = getMol(RDKit, input);
  if (!mol) return null;
  try {
    return mol.get_svg();
  } finally {
    mol.delete();
  }
}

test('plain RDKit refuses the molecule from issue #24', () => {
  expect(RDKit.get_mol(UNKEKULIZABLE)).toBeNull();
});

test('a molecule RDKit cannot kekulize is still drawn', () => {
  expect(svgOf(UNKEKULIZABLE)).toContain('<svg');
});

test('the fallback keeps atom indices, so highlights still work', () => {
  const mol = getMol(RDKit, UNKEKULIZABLE);
  try {
    expect(mol.get_svg_with_highlights(JSON.stringify({atoms: [0, 1, 2]}))).toContain('<svg');
  } finally {
    mol.delete();
  }
});

test('ordinary molecules are drawn exactly as before', () => {
  const smiles = 'O=C(O)[C@@H](N)Cc1c[nH]c2ccccc12';
  const plain = RDKit.get_mol(smiles);
  try {
    expect(svgOf(smiles)).toBe(plain.get_svg());
  } finally {
    plain.delete();
  }
});

test('input that is not a molecule still fails', () => {
  expect(getMol(RDKit, 'C(((')).toBeNull();
  expect(getMol(RDKit, 'not a smiles')).toBeNull();
});
