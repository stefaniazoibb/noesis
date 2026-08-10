"""Curated evidence table for the MVP corpus.

Each entry references a PubMed record cached in cache/pmid_<id>.json (fetched
2026-08-10). Bibliographic metadata (title/authors/year/journal/DOI) is taken
from the cache at build time by build_evidence.py — never typed by hand here.
This file encodes only curation judgments made from the cached abstracts:
disorder/modality tags, atlas region mappings, finding directions, and
faithful one-sentence summaries. Statements note every non-obvious mapping
(e.g. DLPFC -> middle frontal gyrus, substantia nigra -> brainstem mesh).

Region helpers: C(name) = bilateral cortical pair, S(name) = bilateral
subcortical pair; explicit ids for lateralized findings.
"""


def C(name, hemis=("lh", "rh")):
    return [f"dk_{h}_{name}" for h in hemis]


def S(name, hemis=("lh", "rh")):
    return [f"sub_{h}_{name}" for h in hemis]


MDD = "major_depressive_disorder"
PTSD = "post_traumatic_stress_disorder"
SCZ = "schizophrenia"
AD = "alzheimers_disease"
PD = "parkinsons_disease"

# groups: (regions, direction, findingType, statement)
STUDIES = [
    # ------------------------------------------------------- MDD
    dict(
        id="study_schmaal_2016", pmid="26122586", disorders=[MDD],
        modalities=["smri"], findingType="volumetric", direction="decreased",
        sampleSize=8927, causal="correlational",
        population="1728 MDD patients vs 7199 controls, 15 worldwide samples (ENIGMA-MDD)",
        finding="Robust smaller hippocampal volumes in MDD versus controls; moderated by age of onset and first-episode vs recurrent status.",
        groups=[(S("hippocampus"), "decreased", "volumetric",
                 "Smaller hippocampal volume in MDD versus controls in the ENIGMA-MDD worldwide mega-analysis, moderated by early onset and recurrence.")],
    ),
    dict(
        id="study_schmaal_2017", pmid="27137745", disorders=[MDD],
        modalities=["smri"], findingType="structural_difference", direction="decreased",
        sampleSize=None, causal="correlational",
        population="adults and adolescents with MDD vs controls, 20 cohorts (ENIGMA-MDD)",
        finding="Adults with MDD showed thinner cortical gray matter than controls in orbitofrontal cortex, anterior and posterior cingulate, insula and temporal lobes (d -0.10 to -0.14).",
        groups=[
            (C("lateralorbitofrontal") + C("medialorbitofrontal"), "decreased", "structural_difference",
             "Thinner orbitofrontal cortex in adults with MDD versus controls (ENIGMA-MDD)."),
            (C("rostralanteriorcingulate") + C("caudalanteriorcingulate"), "decreased", "structural_difference",
             "Thinner anterior cingulate cortex in adults with MDD versus controls (ENIGMA-MDD)."),
            (C("posteriorcingulate"), "decreased", "structural_difference",
             "Thinner posterior cingulate cortex in adults with MDD versus controls (ENIGMA-MDD)."),
            (C("insula"), "decreased", "structural_difference",
             "Thinner insular cortex in adults with MDD versus controls (ENIGMA-MDD)."),
        ],
    ),
    dict(
        id="study_videbech_2004", pmid="15514393", disorders=[MDD],
        modalities=["smri"], findingType="volumetric", direction="decreased",
        sampleSize=630, causal="correlational",
        population="351 patients with unipolar depression vs 279 healthy subjects (12 studies)",
        finding="Hippocampal volume reduced in unipolar depression (left -8%, right -10%); number of depressive episodes correlated with right-sided reduction.",
        groups=[(S("hippocampus"), "decreased", "volumetric",
                 "Bilateral hippocampal volume reduction in unipolar depression (left -8%, right -10%), correlated with number of episodes on the right.")],
    ),
    dict(
        id="study_zhou_2024", pmid="38365137", disorders=[MDD],
        modalities=["fmri"], findingType="functional_connectivity", direction="mixed",
        sampleSize=None, causal="correlational",
        population="44 ACC-based resting-state fMRI studies of MDD",
        finding="Subregion-specific altered resting-state functional connectivity of the ACC in MDD: subgenual ACC with emotion-related regions, pregenual with sensorimotor, dorsal with cognition-related regions.",
        groups=[
            (C("rostralanteriorcingulate"), "mixed", "functional_connectivity",
             "Altered resting-state connectivity of subgenual/pregenual ACC (within DK rostral anterior cingulate) with emotion- and sensorimotor-related regions in MDD."),
            (C("caudalanteriorcingulate"), "mixed", "functional_connectivity",
             "Altered resting-state connectivity of dorsal ACC (within DK caudal anterior cingulate) with cognition-related regions in MDD."),
        ],
    ),
    dict(
        id="study_fan_2025", pmid="39566882", disorders=[MDD],
        modalities=["fmri"], findingType="functional_connectivity", direction="decreased",
        sampleSize=None, causal="correlational",
        population="adolescents and adults with MDD vs healthy controls",
        finding="Reduced sgACC-amygdala resting-state connectivity in adults with recurrent MDD; adolescent patients comparable to controls; small samples inflate effects.",
        groups=[
            (C("rostralanteriorcingulate") + S("amygdala"), "decreased", "functional_connectivity",
             "Reduced subgenual-ACC-amygdala resting-state connectivity in adults with recurrent MDD (not in adolescents); small-sample studies inflate this effect."),
        ],
    ),
    dict(
        id="study_vandervinne_2017", pmid="28761811", disorders=[MDD],
        modalities=["eeg"], findingType="electrophysiological", direction=None,
        sampleSize=4044, causal="correlational",
        population="1883 MDD vs 2161 controls (16 studies)",
        finding="Frontal alpha asymmetry showed a non-significant, negligible overall effect size, indicating limited diagnostic value in MDD (scalp-level EEG; no atlas region mapped).",
        groups=[],
    ),
    dict(
        id="study_luo_2025", pmid="39820155", disorders=[MDD],
        modalities=["eeg"], findingType="electrophysiological", direction=None,
        sampleSize=4532, causal="correlational",
        population="1928 MDD vs 2604 controls (23 studies)",
        finding="Small but significant frontal alpha asymmetry effect (F4-F3) with high heterogeneity; limited standalone diagnostic utility (scalp-level EEG; no atlas region mapped).",
        groups=[],
    ),
    dict(
        id="study_kan_2023", pmid="36898403", disorders=[MDD],
        modalities=["tms"], findingType="stimulation_response", direction="decreased",
        sampleSize=7905, causal="interventional",
        population="7905 patients across neuropsychiatric disorders (174 studies)",
        finding="rTMS of the left DLPFC produced a medium reduction of depressive symptoms (Hedges g -0.73) in a cross-diagnostic meta-analysis.",
        groups=[
            (C("rostralmiddlefrontal", ["lh"]) + C("caudalmiddlefrontal", ["lh"]), "decreased", "stimulation_response",
             "rTMS of the left DLPFC (spans DK rostral/caudal middle frontal gyrus) reduced depressive symptoms with medium effect size (Hedges g -0.73)."),
        ],
    ),
    dict(
        id="study_bromis_2018", pmid="30021460", disorders=[PTSD, MDD],
        modalities=["smri"], findingType="volumetric", direction="decreased",
        sampleSize=None, causal="correlational",
        population="89 structural MRI studies; PTSD patients, trauma-exposed and non-exposed controls; MDD comparison",
        finding="PTSD associated with reduced hippocampus, insula and anterior cingulate volumes and reduced total brain volume; hippocampal reduction shared with MDD.",
        groups=[
            (S("hippocampus"), "decreased", "volumetric",
             "Reduced hippocampal volume in PTSD versus controls; reduction shared with major depressive disorder.", [PTSD, MDD]),
            (C("insula"), "decreased", "volumetric",
             "Reduced insula volume in PTSD versus controls.", [PTSD]),
            (C("rostralanteriorcingulate"), "decreased", "volumetric",
             "Reduced anterior cingulate volume in PTSD versus controls.", [PTSD]),
        ],
    ),
    # ------------------------------------------------------- PTSD
    dict(
        id="study_etkin_2007", pmid="17898336", disorders=[PTSD],
        modalities=["fmri"], findingType="activation", direction="mixed",
        sampleSize=None, causal="correlational",
        population="patients with PTSD, social anxiety disorder or specific phobia vs matched controls",
        finding="Amygdala and insula hyperactivation during emotional processing across anxiety disorders including PTSD; PTSD-specific hypoactivation of dorsal/rostral ACC and ventromedial PFC.",
        groups=[
            (S("amygdala"), "increased", "activation",
             "Greater amygdala activity during emotional processing in PTSD (shared with other anxiety disorders)."),
            (C("insula"), "increased", "activation",
             "Greater insula activity during emotional processing in PTSD (shared with other anxiety disorders)."),
            (C("rostralanteriorcingulate") + C("caudalanteriorcingulate"), "decreased", "activation",
             "PTSD-specific hypoactivation of dorsal and rostral anterior cingulate cortices during emotional processing."),
            (C("medialorbitofrontal"), "decreased", "activation",
             "PTSD-specific hypoactivation of ventromedial prefrontal cortex (mapped to DK medial orbitofrontal cortex)."),
        ],
    ),
    dict(
        id="study_smith_2005", pmid="15988763", disorders=[PTSD],
        modalities=["smri"], findingType="volumetric", direction="decreased",
        sampleSize=None, causal="correlational",
        population="adults with PTSD vs controls (13 studies)",
        finding="Bilateral hippocampal volume reduction in adult PTSD (left -6.9%, right -6.6%); differences smaller versus trauma-exposed controls.",
        groups=[(S("hippocampus"), "decreased", "volumetric",
                 "Bilateral hippocampal volume reduction in adults with PTSD (left -6.9%, right -6.6%); smaller when compared with trauma-exposed controls.")],
    ),
    dict(
        id="study_karl_2006", pmid="16730374", disorders=[PTSD],
        modalities=["smri"], findingType="volumetric", direction="decreased",
        sampleSize=None, causal="correlational",
        population="adults and children with PTSD, trauma-exposed and healthy controls",
        finding="Smaller bilateral hippocampus, left amygdala and anterior cingulate in adult PTSD; pediatric samples showed no hippocampal difference.",
        groups=[
            (S("hippocampus"), "decreased", "volumetric",
             "Smaller bilateral hippocampal volume in adults with PTSD; absent in pediatric samples."),
            (S("amygdala", ["lh"]), "decreased", "volumetric",
             "Smaller left amygdala volume in adults with PTSD versus healthy and trauma-exposed controls."),
            (C("rostralanteriorcingulate"), "decreased", "volumetric",
             "Smaller anterior cingulate cortex in PTSD versus trauma-exposed controls."),
        ],
    ),
    dict(
        id="study_logue_2018", pmid="29217296", disorders=[PTSD],
        modalities=["smri"], findingType="volumetric", direction="decreased",
        sampleSize=None, causal="correlational",
        population="multisite ENIGMA-PGC PTSD consortium sample",
        finding="Significantly smaller hippocampi in current PTSD versus trauma-exposed controls (d = -0.17); smaller amygdalae did not survive multiple-comparison correction.",
        groups=[(S("hippocampus"), "decreased", "volumetric",
                 "Smaller hippocampal volume in current PTSD versus trauma-exposed controls (Cohen's d = -0.17, ENIGMA-PGC multisite study).")],
    ),
    dict(
        id="study_wang_2016", pmid="27251865", disorders=[PTSD],
        modalities=["fmri"], findingType="activation", direction="mixed",
        sampleSize=644, causal="correlational",
        population="286 PTSD patients, 203 trauma-exposed and 155 non-trauma controls (15 studies)",
        finding="Resting-state hyperactivity in right anterior insula, hypoactivity in dorsomedial PFC vs non-trauma controls; pooled hypoactivity in posterior insula, superior temporal and Heschl's gyrus.",
        groups=[
            (C("insula", ["rh"]), "increased", "activation",
             "Right anterior insula resting-state hyperactivity in PTSD versus non-trauma controls."),
            (C("superiortemporal") + C("transversetemporal"), "decreased", "activation",
             "Pooled resting-state hypoactivity in superior temporal and Heschl's gyri in PTSD."),
            (C("superiorfrontal"), "decreased", "activation",
             "Dorsomedial prefrontal hypoactivity at rest in PTSD (mapped to DK superior frontal gyrus)."),
        ],
    ),
    dict(
        id="study_harris_2021", pmid="33940319", disorders=[PTSD],
        modalities=["tms"], findingType="stimulation_response", direction="decreased",
        sampleSize=None, causal="interventional",
        population="patients with PTSD in TMS treatment studies",
        finding="TMS reduced PTSD symptoms with a large overall effect (d = 1.17); high-frequency stimulation outperformed low-frequency; left vs right DLPFC targets did not differ.",
        groups=[
            (C("rostralmiddlefrontal") + C("caudalmiddlefrontal"), "decreased", "stimulation_response",
             "TMS to left or right DLPFC (spans DK rostral/caudal middle frontal gyrus) reduced PTSD symptoms (overall d = 1.17; no left/right target difference)."),
        ],
    ),
    dict(
        id="study_popescu_2019", pmid="31408789", disorders=[PTSD],
        modalities=["eeg"], findingType="electrophysiological", direction="decreased",
        sampleSize=None, causal="correlational",
        population="service members with PTSD symptoms performing a working-memory task",
        finding="Higher PTSD scores associated with reduced task-related modulation of alpha-band power in left middle frontal gyrus during working memory.",
        groups=[
            (C("rostralmiddlefrontal", ["lh"]) + C("caudalmiddlefrontal", ["lh"]), "decreased", "electrophysiological",
             "Reduced task-specific alpha-band modulation in left middle frontal gyrus (spans DK rostral/caudal middle frontal) associated with PTSD symptom severity."),
        ],
    ),
    # ------------------------------------------------------- Schizophrenia
    dict(
        id="study_vanerp_2016", pmid="26033243", disorders=[SCZ],
        modalities=["smri"], findingType="volumetric", direction="mixed",
        sampleSize=4568, causal="correlational",
        population="2028 individuals with schizophrenia vs 2540 healthy controls (ENIGMA)",
        finding="Smaller hippocampus (d=-0.46), amygdala (-0.31), thalamus (-0.31) and accumbens (-0.25), and larger pallidum (+0.21) and lateral ventricles in schizophrenia.",
        groups=[
            (S("hippocampus"), "decreased", "volumetric",
             "Smaller hippocampal volume in schizophrenia versus controls (Cohen's d = -0.46, ENIGMA)."),
            (S("amygdala"), "decreased", "volumetric",
             "Smaller amygdala volume in schizophrenia versus controls (Cohen's d = -0.31, ENIGMA)."),
            (S("thalamus"), "decreased", "volumetric",
             "Smaller thalamus volume in schizophrenia versus controls (Cohen's d = -0.31, ENIGMA)."),
            (S("accumbens"), "decreased", "volumetric",
             "Smaller nucleus accumbens volume in schizophrenia versus controls (Cohen's d = -0.25, ENIGMA)."),
            (S("pallidum"), "increased", "volumetric",
             "Larger globus pallidus volume in schizophrenia versus controls (Cohen's d = +0.21), associated with illness duration (ENIGMA)."),
        ],
    ),
    dict(
        id="study_vanerp_2018", pmid="29960671", disorders=[SCZ],
        modalities=["smri"], findingType="structural_difference", direction="decreased",
        sampleSize=9572, causal="correlational",
        population="4474 individuals with schizophrenia vs 5098 controls (ENIGMA)",
        finding="Widespread thinner cortex and smaller surface area in schizophrenia, largest effects in frontal and temporal lobe regions (no single-region mapping asserted).",
        groups=[],
    ),
    dict(
        id="study_honea_2005", pmid="16330585", disorders=[SCZ],
        modalities=["smri"], findingType="structural_difference", direction="decreased",
        sampleSize=None, causal="correlational",
        population="voxel-based morphometry studies of schizophrenia vs healthy comparison subjects",
        finding="Most consistent gray-matter deficits in left superior temporal gyrus and left medial temporal lobe across VBM studies.",
        groups=[
            (C("superiortemporal", ["lh"]), "decreased", "structural_difference",
             "Left superior temporal gyrus gray-matter deficit — one of the two most consistently reported regions across VBM studies of schizophrenia."),
            (S("hippocampus", ["lh"]) + C("parahippocampal", ["lh"]), "decreased", "structural_difference",
             "Left medial temporal lobe gray-matter deficit (mapped to hippocampus and parahippocampal gyrus) consistently reported across VBM studies of schizophrenia."),
        ],
    ),
    dict(
        id="study_jardri_2011", pmid="20952459", disorders=[SCZ],
        modalities=["fmri"], findingType="activation", direction="increased",
        sampleSize=None, causal="correlational",
        population="patients with schizophrenia experiencing auditory verbal hallucinations (capture studies)",
        finding="AVH episodes associated with increased activation in a bilateral fronto-temporal network: Broca's area, anterior insula, precentral gyrus, middle/superior temporal gyri, inferior parietal lobule and hippocampus/parahippocampal region.",
        groups=[
            (C("parsopercularis", ["lh"]) + C("parstriangularis", ["lh"]), "increased", "activation",
             "Increased activation of Broca's area (DK pars opercularis/triangularis) during auditory verbal hallucinations."),
            (C("insula"), "increased", "activation",
             "Increased anterior insula activation during auditory verbal hallucinations."),
            (C("precentral"), "increased", "activation",
             "Increased precentral gyrus activation during auditory verbal hallucinations."),
            (C("middletemporal") + C("superiortemporal"), "increased", "activation",
             "Increased middle and superior temporal gyri activation during auditory verbal hallucinations."),
            (C("inferiorparietal"), "increased", "activation",
             "Increased inferior parietal lobule activation during auditory verbal hallucinations."),
            (S("hippocampus") + C("parahippocampal"), "increased", "activation",
             "Increased hippocampus/parahippocampal activation during auditory verbal hallucinations."),
        ],
    ),
    dict(
        id="study_modinos_2013", pmid="22370252", disorders=[SCZ],
        modalities=["smri"], findingType="structural_difference", direction="decreased",
        sampleSize=None, causal="correlational",
        population="patients with schizophrenia; AVH-severity correlation studies (n=8 studies)",
        finding="AVH severity associated with gray-matter volume reduction in left (significant) and right (marginal) superior temporal gyri including Heschl's gyrus.",
        groups=[
            (C("superiortemporal") + C("transversetemporal"), "decreased", "structural_difference",
             "Auditory-hallucination severity correlated with gray-matter reduction in superior temporal gyri including Heschl's gyrus (left significant, right marginal)."),
        ],
    ),
    dict(
        id="study_adriano_2012", pmid="21531988", disorders=[SCZ],
        modalities=["smri"], findingType="volumetric", direction="decreased",
        sampleSize=None, causal="correlational",
        population="first-episode and chronic schizophrenia patients vs healthy controls (44 studies)",
        finding="Significant bilateral hippocampal volume reduction in schizophrenia, of equal size in first-episode and chronic patients.",
        groups=[(S("hippocampus"), "decreased", "volumetric",
                 "Bilateral hippocampal volume reduction of equal magnitude in first-episode and chronic schizophrenia.")],
    ),
    dict(
        id="study_umbricht_2005", pmid="15927795", disorders=[SCZ],
        modalities=["eeg"], findingType="electrophysiological", direction="decreased",
        sampleSize=None, causal="correlational",
        population="patients with schizophrenia vs controls (32 studies)",
        finding="Robust mismatch negativity amplitude reduction in chronic schizophrenia (mean d = 0.99), interpreted by the authors as indexing auditory-cortex information-processing abnormalities.",
        groups=[
            (C("transversetemporal"), "decreased", "electrophysiological",
             "Mismatch negativity amplitude reduction (d = 0.99), attributed by the authors to auditory cortex abnormalities (mapped to DK transverse temporal / Heschl's gyrus)."),
        ],
    ),
    dict(
        id="study_slotema_2012", pmid="23031191", disorders=[SCZ],
        modalities=["tms"], findingType="stimulation_response", direction="decreased",
        sampleSize=None, causal="interventional",
        population="patients with medication-resistant auditory verbal hallucinations",
        finding="rTMS to the left temporoparietal area reduced auditory verbal hallucinations; effect size decreased as larger trials were added and may not persist beyond one month.",
        groups=[
            (C("superiortemporal", ["lh"]) + C("supramarginal", ["lh"]), "decreased", "stimulation_response",
             "Left temporoparietal rTMS (mapped to DK superior temporal / supramarginal gyri) reduced auditory verbal hallucination severity; effect shrank as larger trials accrued."),
        ],
    ),
    # ------------------------------------------------------- Alzheimer's disease
    dict(
        id="study_lombardi_2020", pmid="32119112", disorders=[AD],
        modalities=["smri"], findingType="volumetric", direction=None,
        sampleSize=3935, causal="correlational",
        population="3935 people with mild cognitive impairment followed for progression to AD dementia (33 studies)",
        finding="Total hippocampal volume predicted progression from MCI to Alzheimer's dementia with pooled sensitivity 0.73 and specificity 0.71 (low-certainty evidence).",
        groups=[
            (S("hippocampus"), None, "volumetric",
             "Hippocampal volume discriminated MCI progressors to AD dementia from non-progressors (sensitivity 0.73, specificity 0.71; low-certainty Cochrane evidence)."),
        ],
    ),
    dict(
        id="study_zhang_2023", pmid="37768441", disorders=[AD],
        modalities=["smri"], findingType="volumetric", direction="decreased",
        sampleSize=None, causal="correlational",
        population="MCI and AD patients vs controls (20 FreeSurfer studies)",
        finding="Hippocampal subfield volume reductions in MCI and AD were widespread (largest in subiculum/presubiculum); no subfield outperformed whole-hippocampus volume for discrimination.",
        groups=[(S("hippocampus"), "decreased", "volumetric",
                 "Widespread hippocampal subfield volume reductions in MCI and AD; no subfield discriminated better than whole hippocampus.")],
    ),
    dict(
        id="study_park_2021", pmid="34510246", disorders=[AD],
        modalities=["smri"], findingType="structural_difference", direction="decreased",
        sampleSize=None, causal="correlational",
        population="AD patients vs healthy controls (21 studies)",
        finding="Visual medial temporal lobe atrophy scale differentiated AD from controls with pooled sensitivity 74% and specificity 88%, comparable to hippocampal volumetry.",
        groups=[
            (S("hippocampus") + C("parahippocampal"), "decreased", "structural_difference",
             "Medial temporal lobe atrophy (visual MTA scale over hippocampus and parahippocampal region) differentiated AD from controls (sensitivity 74%, specificity 88%)."),
        ],
    ),
    dict(
        id="study_boccia_2015", pmid="25869784", disorders=[AD],
        modalities=["smri"], findingType="structural_difference", direction="decreased",
        sampleSize=None, causal="correlational",
        population="AD and late-life depression patients; coordinate-based meta-analysis of MRI studies",
        finding="AD linked to bilateral hippocampal volume reduction with pronounced atrophy in left anterior hippocampus and bilateral posterior cingulate cortex, partially distinct from late-life depression.",
        groups=[
            (S("hippocampus"), "decreased", "structural_difference",
             "Bilateral hippocampal atrophy in AD, greatest in the left anterior hippocampus."),
            (C("posteriorcingulate"), "decreased", "structural_difference",
             "Bilateral posterior cingulate atrophy in AD, distinguishing it from late-life depression."),
        ],
    ),
    dict(
        id="study_jacobs_2013", pmid="23523750", disorders=[AD],
        modalities=["fmri"], findingType="functional_connectivity", direction="mixed",
        sampleSize=2451, causal="correlational",
        population="1196 patients and 1255 controls; default-mode connectivity and task activation studies",
        finding="Stage-dependent alterations of large-scale network components in AD, differentially affecting medial parietal regions and subcortical areas; early compensatory changes.",
        groups=[
            (C("precuneus") + C("posteriorcingulate"), "mixed", "functional_connectivity",
             "Medial parietal (precuneus/posterior cingulate) network components altered in a stage-dependent manner in AD."),
        ],
    ),
    dict(
        id="study_eyler_2019", pmid="31177210", disorders=[AD],
        modalities=["fmri"], findingType="functional_connectivity", direction="decreased",
        sampleSize=None, causal="correlational",
        population="people with mild cognitive impairment (a risk state for AD) vs healthy controls (31 studies)",
        finding="Meta-analytic hypoconnectivity of the default mode network in posterior cingulate/precuneus in MCI, but with substantial inconsistency across studies; no usable biomarker yet.",
        groups=[
            (C("posteriorcingulate") + C("precuneus"), "decreased", "functional_connectivity",
             "DMN hypoconnectivity in posterior cingulate/precuneus in MCI (risk state for AD); individual studies highly inconsistent."),
        ],
    ),
    dict(
        id="study_wang_2024", pmid="38521993", disorders=[AD],
        modalities=["fmri"], findingType="functional_connectivity", direction="mixed",
        sampleSize=None, causal="correlational",
        population="MCI and AD patients vs controls; seed-based DMN resting-state fMRI studies",
        finding="AD showed decreased within-DMN connectivity in mPFC/ACC and precuneus/PCC (shared with MCI) and increased connectivity between DMN and right dorsolateral prefrontal cortex.",
        groups=[
            (C("rostralanteriorcingulate"), "decreased", "functional_connectivity",
             "Decreased within-DMN resting-state connectivity in medial prefrontal/anterior cingulate cortex in AD (mapped to DK rostral anterior cingulate)."),
            (C("precuneus") + C("posteriorcingulate"), "decreased", "functional_connectivity",
             "Decreased within-DMN resting-state connectivity in precuneus/posterior cingulate in AD, shared with MCI."),
            (C("rostralmiddlefrontal", ["rh"]), "increased", "functional_connectivity",
             "Increased connectivity between the DMN and right dorsolateral prefrontal cortex in AD (mapped to DK rostral middle frontal gyrus)."),
        ],
    ),
    dict(
        id="study_smailovic_2018", pmid="29245058", disorders=[AD],
        modalities=["eeg"], findingType="electrophysiological", direction="mixed",
        sampleSize=637, causal="correlational",
        population="637 memory-clinic patients (subjective cognitive decline, MCI, AD)",
        finding="AD-like CSF biomarker profiles correlated with increased global theta/delta EEG power and decreased alpha/beta power and synchronization (global measures; no atlas region mapped).",
        groups=[],
    ),
    dict(
        id="study_chou_2020_ad", pmid="31783330", disorders=[AD],
        modalities=["tms"], findingType="stimulation_response", direction="increased",
        sampleSize=293, causal="interventional",
        population="293 patients with MCI or AD (13 studies)",
        finding="Active rTMS improved cognitive function over sham (effect size 0.77); high-frequency left DLPFC and low-frequency right DLPFC improved memory; effects lasted 4-12 weeks.",
        groups=[
            (C("rostralmiddlefrontal") + C("caudalmiddlefrontal"), "increased", "stimulation_response",
             "rTMS over DLPFC (high-frequency left, low-frequency right; DK rostral/caudal middle frontal) improved memory in MCI/AD (overall effect size 0.77)."),
        ],
    ),
    # ------------------------------------------------------- Parkinson's disease
    dict(
        id="study_he_2020", pmid="32330518", disorders=[PD],
        modalities=["smri"], findingType="volumetric", direction="decreased",
        sampleSize=None, causal="correlational",
        population="longitudinal structural MRI studies of Parkinson's disease vs controls",
        finding="Progressive volume reductions in caudate (-0.62%/yr), putamen (-0.97%/yr), accumbens (-5.40%/yr) and amygdala (-3.55%/yr) in PD; heterogeneity warrants caution.",
        groups=[
            (S("caudate"), "decreased", "volumetric",
             "Progressive caudate volume reduction in PD (-0.62% per year vs controls)."),
            (S("putamen"), "decreased", "volumetric",
             "Progressive putamen volume reduction in PD (-0.97% per year vs controls)."),
            (S("accumbens"), "decreased", "volumetric",
             "Progressive nucleus accumbens volume reduction in PD (-5.40% per year vs controls)."),
            (S("amygdala"), "decreased", "volumetric",
             "Progressive amygdala volume reduction in PD (-3.55% per year vs controls)."),
        ],
    ),
    dict(
        id="study_xing_2020", pmid="30809759", disorders=[PD],
        modalities=["fmri"], findingType="activation", direction="decreased",
        sampleSize=None, causal="correlational",
        population="people with Parkinson's disease vs healthy controls; upper-extremity motor task fMRI",
        finding="Reduced motor-task activation in bilateral putamen, left SMA, right thalamus and right medial globus pallidus in unmedicated PD; normalized under dopaminergic medication.",
        groups=[
            (S("putamen"), "decreased", "activation",
             "Reduced motor-task activation in bilateral putamen in unmedicated PD, restored by dopaminergic medication."),
            (S("thalamus", ["rh"]), "decreased", "activation",
             "Reduced motor-task activation in right thalamus in unmedicated PD."),
            (S("pallidum", ["rh"]), "decreased", "activation",
             "Reduced motor-task activation in right medial globus pallidus in unmedicated PD."),
            (C("superiorfrontal", ["lh"]), "decreased", "activation",
             "Reduced left SMA activation in unmedicated PD (SMA mapped to DK superior frontal gyrus); hyperactivation under medication."),
        ],
    ),
    dict(
        id="study_chou_2015_pd", pmid="25686212", disorders=[PD],
        modalities=["tms"], findingType="stimulation_response", direction="decreased",
        sampleSize=470, causal="interventional",
        population="470 patients with Parkinson's disease (20 studies)",
        finding="rTMS improved motor symptoms (pooled SMD 0.46); high-frequency stimulation of primary motor cortex had the largest significant effect (SMD 0.77).",
        groups=[
            (C("precentral"), "decreased", "stimulation_response",
             "High-frequency rTMS of primary motor cortex (DK precentral gyrus) reduced PD motor symptoms (SMD 0.77)."),
        ],
    ),
    dict(
        id="study_li_2022", pmid="35616427", disorders=[PD],
        modalities=["tms"], findingType="stimulation_response", direction="decreased",
        sampleSize=None, causal="interventional",
        population="patients with Parkinson's disease (32 studies)",
        finding="rTMS relieved PD motor symptoms (SMD 0.64); high-frequency M1 stimulation most effective (SMD 0.79), improving akinesia, rigidity and tremor.",
        groups=[
            (C("precentral"), "decreased", "stimulation_response",
             "High-frequency rTMS over M1 (DK precentral gyrus) relieved motor symptoms including akinesia, rigidity and tremor (SMD 0.79)."),
        ],
    ),
    dict(
        id="study_wang_2019_pd", pmid="31392640", disorders=[PD],
        modalities=["smri"], findingType="structural_difference", direction="decreased",
        sampleSize=None, causal="correlational",
        population="patients with Parkinson's disease vs controls; neuromelanin-sensitive MRI studies",
        finding="Reduced substantia nigra pars compacta neuromelanin signal/volume discriminated PD from controls (sensitivity 0.82, specificity 0.82).",
        groups=[
            (["sub_mid_brainstem"], "decreased", "structural_difference",
             "Reduced substantia nigra pars compacta neuromelanin-MRI signal in PD (sensitivity/specificity 0.82); SN lies in the midbrain, mapped to the brainstem mesh in this atlas."),
        ],
    ),
    dict(
        id="study_cho_2021", pmid="32886201", disorders=[PD],
        modalities=["smri"], findingType="structural_difference", direction="decreased",
        sampleSize=701, causal="correlational",
        population="403 PD patients vs 298 controls (12 studies)",
        finding="Neuromelanin-sensitive MRI of substantia nigra discriminated PD from controls with pooled sensitivity 89% and specificity 83%.",
        groups=[
            (["sub_mid_brainstem"], "decreased", "structural_difference",
             "Reduced substantia nigra neuromelanin-MRI signal discriminated PD from controls (sensitivity 89%, specificity 83%); SN mapped to the brainstem mesh in this atlas."),
        ],
    ),
]
