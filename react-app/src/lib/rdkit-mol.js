// src/lib/rdkit-mol.js

// Some valid structures can't be sanitized by RDKit, typically because their aromatic system
// can't be kekulized (e.g. CHEBI:65618, whose SMILES leaves an aromatic N without its H). Python
// RDKit can still draw these via Chem.MolFromSmiles(smiles, sanitize=False); this is the RDKit.js
// counterpart. Sanitization is skipped only after a normal parse failed, so every molecule that
// parses normally is drawn exactly as before.
const UNSANITIZED = JSON.stringify({sanitize: false});

/**
 * Parse a SMILES (or other input understood by RDKit.get_mol) into a JSMol, falling back to an
 * unsanitized molecule if RDKit refuses the input as-is. Returns null if neither works (i.e. the
 * input is not a molecule at all). The caller owns the returned mol and has to delete() it.
 */
export function getMol(rdkit, input) {
  const mol = tryGetMol(rdkit, input);
  if (mol) return mol;

  const unsanitized = tryGetMol(rdkit, input, UNSANITIZED);
  if (!unsanitized) return null;
  // without sanitization RDKit's default depiction tends to draw macrocycles on top of themselves;
  // CoordGen lays them out properly. Atom indices are unaffected, so highlights still line up.
  try {
    unsanitized.set_new_coords(true);
  } catch (e) {
    // keep RDKit's default coordinates - a cluttered drawing beats none
  }
  return unsanitized;
}

function tryGetMol(rdkit, input, details) {
  let mol = null;
  try {
    mol = details === undefined ? rdkit.get_mol(input) : rdkit.get_mol(input, details);
  } catch (e) {
    return null;
  }
  if (mol && mol.is_valid?.() === false) {
    mol.delete?.();
    return null;
  }
  return mol || null;
}
