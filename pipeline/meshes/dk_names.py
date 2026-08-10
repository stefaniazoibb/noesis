"""Display names and lobe groupings for the Desikan-Killiany parcellation.

Canonical ids come from the aparc.annot color table at build time; this module
only maps those annot names to human-readable labels and standard lobar groups.
"""

# annot name -> display name (standard DK region names)
DISPLAY_NAMES = {
    "bankssts": "Banks of the superior temporal sulcus",
    "caudalanteriorcingulate": "Caudal anterior cingulate cortex",
    "caudalmiddlefrontal": "Caudal middle frontal gyrus",
    "cuneus": "Cuneus",
    "entorhinal": "Entorhinal cortex",
    "fusiform": "Fusiform gyrus",
    "inferiorparietal": "Inferior parietal cortex",
    "inferiortemporal": "Inferior temporal gyrus",
    "isthmuscingulate": "Isthmus of the cingulate cortex",
    "lateraloccipital": "Lateral occipital cortex",
    "lateralorbitofrontal": "Lateral orbitofrontal cortex",
    "lingual": "Lingual gyrus",
    "medialorbitofrontal": "Medial orbitofrontal cortex",
    "middletemporal": "Middle temporal gyrus",
    "parahippocampal": "Parahippocampal gyrus",
    "paracentral": "Paracentral lobule",
    "parsopercularis": "Pars opercularis",
    "parsorbitalis": "Pars orbitalis",
    "parstriangularis": "Pars triangularis",
    "pericalcarine": "Pericalcarine cortex",
    "postcentral": "Postcentral gyrus",
    "posteriorcingulate": "Posterior cingulate cortex",
    "precentral": "Precentral gyrus",
    "precuneus": "Precuneus",
    "rostralanteriorcingulate": "Rostral anterior cingulate cortex",
    "rostralmiddlefrontal": "Rostral middle frontal gyrus",
    "superiorfrontal": "Superior frontal gyrus",
    "superiorparietal": "Superior parietal cortex",
    "superiortemporal": "Superior temporal gyrus",
    "supramarginal": "Supramarginal gyrus",
    "frontalpole": "Frontal pole",
    "temporalpole": "Temporal pole",
    "transversetemporal": "Transverse temporal cortex",
    "insula": "Insula",
}

# Standard lobar grouping for DK regions
LOBES = {
    "frontal": [
        "caudalmiddlefrontal", "lateralorbitofrontal", "medialorbitofrontal",
        "paracentral", "parsopercularis", "parsorbitalis", "parstriangularis",
        "precentral", "rostralmiddlefrontal", "superiorfrontal", "frontalpole",
    ],
    "parietal": [
        "inferiorparietal", "postcentral", "precuneus", "superiorparietal",
        "supramarginal",
    ],
    "temporal": [
        "bankssts", "entorhinal", "fusiform", "inferiortemporal",
        "middletemporal", "parahippocampal", "superiortemporal",
        "temporalpole", "transversetemporal",
    ],
    "occipital": [
        "cuneus", "lateraloccipital", "lingual", "pericalcarine",
    ],
    "cingulate": [
        "caudalanteriorcingulate", "isthmuscingulate", "posteriorcingulate",
        "rostralanteriorcingulate",
    ],
    "insula": ["insula"],
}

LOBE_OF = {name: lobe for lobe, names in LOBES.items() for name in names}

# Vertices with these annot labels are background, not selectable regions
NON_REGIONS = {"unknown", "corpuscallosum"}
