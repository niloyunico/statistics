/* Generated from server/seed/quality.json for offline/verification fallback. */
window.__UNICO_QUALITY_FALLBACK__ = [
  {
    "key": "Cathlab",
    "name": "Cathlab",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero post-PCI complications and zero needle-stick injuries across all four reported quarters. 100% door-to-balloon time compliance in Q2 (Nov-Dec 2025). Patient volume grew steadily from 11 (Q1) to 22 (Q4). Total patients treated across the year: 63.",
      "majorGaps": "2 puncture-site hematomas reported (1 in Q1 Aug-Oct 2025, 1 in Q4 Apr-May 2026). Door-to-balloon time data captured only in Q2 - tracking gap for other quarters.",
      "overallStatus": "Good",
      "recommendations": "Continue current safety protocols. Ensure door-to-balloon time is recorded for every PCI case across all quarters. Review hematoma root cause for Q4 case and reinforce post-puncture compression protocol."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "id": "ind-puncture-hematoma",
        "name": "Puncture Site Hematoma",
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025: 1 hematoma",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: 1 hematoma"
        },
        "quarters": {
          "Q1": 1,
          "Q2": 0,
          "Q3": 0,
          "Q4": 1
        },
        "remarks": "2 cases for the year (Q1 and Q4)",
        "valueType": "Count",
        "formula": "count",
        "numLabel": "Puncture Site Hematoma",
        "unit": "count",
        "formulaText": "value = Puncture Site Hematoma",
        "numeratorDef": "Post-procedure cath-lab complications (e.g. access-site haematoma).",
        "reference": "Cath-lab procedural safety indicator."
      },
      {
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "id": "ind-post-pci-complication",
        "name": "Post-PCI Complication",
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "remarks": "Zero across all four reported quarters",
        "valueType": "Count",
        "formula": "count",
        "numLabel": "Post-PCI Complication",
        "unit": "count",
        "formulaText": "value = Post-PCI Complication",
        "numeratorDef": "Post-procedure cath-lab complications (e.g. access-site haematoma).",
        "reference": "Cath-lab procedural safety indicator."
      },
      {
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "remarks": "Staff safety indicator - zero injuries maintained across all quarters",
        "valueType": "Count",
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "benchmark": ">=90% of cases within 90 min",
        "benchmarkValue": 90,
        "goalDirection": "higher_is_better",
        "id": "ind-door-to-balloon",
        "name": "Door-to-Balloon Compliance Rate (<=90 min)",
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: 1 case, proper time maintained (100%)",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "quarters": {
          "Q1": null,
          "Q2": 100,
          "Q3": null,
          "Q4": null
        },
        "remarks": "Q2: 1/1 case within proper time (100%). Other quarters: not reported.",
        "valueType": "%",
        "formula": "pct",
        "numLabel": "PCI cases with door-to-balloon ≤90 min",
        "denLabel": "Total primary PCI cases",
        "unit": "%",
        "formulaText": "(PCI cases with door-to-balloon ≤90 min ÷ Total primary PCI cases) × 100",
        "numeratorDef": "Primary-PCI STEMI cases where balloon inflation occurred within 90 minutes of hospital arrival.",
        "denominatorDef": "All primary-PCI STEMI cases in the reporting period.",
        "reference": "ACC/AHA STEMI guideline — door-to-balloon (D2B) ≤90 min for primary PCI."
      },
      {
        "id": "ind-cauti-rate",
        "name": "CAUTI Rate (per 1000 cath-days)",
        "valueType": "Rate (per 1000)",
        "formula": "rate1000",
        "numLabel": "CAUTI cases",
        "denLabel": "Urinary catheter days",
        "unit": "per 1000 cath-days",
        "benchmark": "<= 0",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {},
        "remarks": "",
        "formulaText": "(CAUTI cases ÷ Urinary catheter days) × 1000",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "denominatorDef": "Urinary catheter days in the reporting period.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      }
    ]
  },
  {
    "key": "CCU",
    "name": "CCU",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero bed sores in Q2 (Nov-Dec 2025) and Q4 (Apr-May 2026). Patient volume across reported quarters: 14 (Q2), 50 (Q3), 35 (Q4); total 99 patients.",
      "majorGaps": "Cardiac arrest survival rate at 0% in both Q3 (0/2) and Q4 (0/3) - 5 cardiac arrests with no survivors across the year. 2 bed sores recorded in Q3 (Jan-Mar 2026). Q1 (Aug-Oct 2025) data not reported.",
      "overallStatus": "Needs Improvement",
      "recommendations": "Urgent review of cardiac arrest response: audit code-blue activation time, ACLS team readiness, defibrillator availability, and post-arrest care pathway. Conduct root cause analysis on each arrest case. Reinforce pressure-injury prevention bundle (repositioning schedule, skin assessment, support surfaces) following the Q3 bed sore cluster. Begin reporting Q1 data going forward for full-year trending."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-ccu-bed-sore",
        "name": "Bed Sore (Pressure Injury)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "2 cases for the year, both in Q3 (Jan-Mar 2026).",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 2,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025 (14 patients): nil",
          "Q3": "Jan-Mar 2026 (50 patients): 2 cases",
          "Q4": "Apr-May 2026 (35 patients): nil"
        },
        "formula": "count",
        "numLabel": "Bed Sore (Pressure Injury)",
        "unit": "count",
        "formulaText": "value = Bed Sore (Pressure Injury)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-ccu-cardiac-arrest-events",
        "name": "Cardiac Arrest Events",
        "valueType": "Count",
        "benchmark": "Informational (track + RCA)",
        "benchmarkValue": "",
        "goalDirection": "lower_is_better",
        "remarks": "5 cardiac arrests across the year (2 in Q3, 3 in Q4). Denominator for survival rate.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 2,
          "Q4": 3
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: 2 events",
          "Q4": "Apr-May 2026: 3 events"
        },
        "formula": "count",
        "numLabel": "Cardiac Arrest Events",
        "unit": "count",
        "formulaText": "value = Cardiac Arrest Events",
        "numeratorDef": "In-unit cardiac arrest events (denominator for survival rate).",
        "reference": "Utstein resuscitation reporting."
      },
      {
        "id": "ind-ccu-cardiac-arrest-survival",
        "name": "Cardiac Arrest Survival Rate",
        "valueType": "%",
        "benchmark": ">=25% (ROSC sustained / discharged alive)",
        "benchmarkValue": 25,
        "goalDirection": "higher_is_better",
        "remarks": "0% survival across all reported arrests (0/5). Trigger for root cause analysis and code-blue response audit.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: 0 arrests - N/A",
          "Q3": "Jan-Mar 2026: 0/2 survived (100% not survived)",
          "Q4": "Apr-May 2026: 0/3 survived (100% not survived)"
        },
        "formula": "pct",
        "numLabel": "Cardiac arrests survived (ROSC sustained / discharged alive)",
        "denLabel": "Cardiac arrest events",
        "unit": "%",
        "formulaText": "(Cardiac arrests survived (ROSC sustained / discharged alive) ÷ Cardiac arrest events) × 100",
        "numeratorDef": "In-unit cardiac arrests with sustained return of spontaneous circulation (ROSC ≥20 min) / survived to discharge.",
        "denominatorDef": "Total cardiac arrest events in the unit during the period.",
        "reference": "Utstein resuscitation reporting — ROSC / survival to discharge."
      }
    ]
  },
  {
    "key": "CTICU",
    "name": "CT ICU",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across all nine quality indicators (CAUTI, CLABSI, VAE, SSI, NSI, HAPU, DVT, Patient Fall, Return to ICU) for Q2 2026 (Apr-May 2026). Patient volume: 7 patients in the reporting period.",
      "majorGaps": "Q1 2026 (Jan-Mar) data not yet reported. Full-year 2025 reporting also pending across Q1-Q4 2025.",
      "overallStatus": "Excellent",
      "recommendations": "Sustain current infection-prevention bundles (VAE, CAUTI, CLABSI), DVT prophylaxis, pressure-injury prevention, and fall-risk assessment. Begin reporting earlier quarters going forward for full-year trending."
    },
    "meta": {
      "preparedBy": {
        "name": "",
        "designation": ""
      },
      "reviewedBy": {
        "name": "",
        "designation": ""
      },
      "approvedBy": {
        "name": "",
        "designation": ""
      }
    },
    "indicators": [
      {
        "id": "ind-ctvs-2026-volume",
        "name": "Patient Volume",
        "valueType": "Count",
        "benchmark": "Informational",
        "benchmarkValue": "",
        "goalDirection": "higher_is_better",
        "category": "Volume",
        "year": "2026",
        "remarks": "Total patients admitted to CT ICU during the reporting quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 7,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026: 7 patients",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Patient Volume",
        "unit": "count",
        "formulaText": "value = Patient Volume",
        "numeratorDef": "Patients admitted/treated in the unit during the period.",
        "reference": "Informational census (denominator for rate indicators)."
      },
      {
        "id": "ind-ctvs-2026-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-ctvs-2026-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-ctvs-2026-vae",
        "name": "Ventilator-Associated Event (VAE)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Ventilator-Associated Event (VAE)",
        "unit": "count",
        "formulaText": "value = Ventilator-Associated Event (VAE)",
        "numeratorDef": "Ventilator-associated pneumonia / events.",
        "reference": "CDC NHSN — VAP / VAE surveillance definition."
      },
      {
        "id": "ind-ctvs-2026-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Staff safety indicator - zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026: nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-ctvs-2026-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-ctvs-2026-dvt",
        "name": "Deep Vein Thrombosis (DVT)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Deep Vein Thrombosis (DVT)",
        "unit": "count",
        "formulaText": "value = Deep Vein Thrombosis (DVT)",
        "numeratorDef": "Hospital-acquired deep-vein thrombosis events.",
        "reference": "NABH VTE prophylaxis & surveillance."
      },
      {
        "id": "ind-ctvs-2026-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-ctvs-2026-return-to-icu",
        "name": "Return to ICU",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "year": "2026",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Apr-May 2026 (7 patients): nil",
          "Q3": "",
          "Q4": ""
        },
        "formula": "count",
        "numLabel": "Return to ICU",
        "unit": "count",
        "formulaText": "value = Return to ICU",
        "numeratorDef": "Patients returning to ICU during the same admission.",
        "reference": "Critical-care outcome — return to ICU."
      }
    ]
  },
  {
    "key": "Dialysis",
    "name": "Dialysis",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across six safety indicators (Patient Fall, Medication Administration Error, Catheter De-lining, NSI, Infection Rate, Vascular Access Complications) in October 2025.",
      "majorGaps": "1 hypotension event in October 2025. Dialysis Adequacy and Water Quality data not yet reported - establish per-session and per-sample tracking.",
      "overallStatus": "Good",
      "recommendations": "Review hypotension case for fluid removal protocol adherence (UF rate, dry weight assessment). Begin routine reporting of Kt/V or URR per session and AAMI water quality samples. Sustain current infection-prevention and access-care bundles."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-dial-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-dial-med-error",
        "name": "Medication Administration Error",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Medication Administration Error",
        "unit": "count",
        "formulaText": "value = Medication Administration Error",
        "numeratorDef": "Medication errors reported (prescribing/dispensing/administration).",
        "reference": "NABH MOM · NCC-MERP medication-error taxonomy."
      },
      {
        "id": "ind-dial-cath-dislodge",
        "name": "Accidental De-lining of Catheter",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Accidental De-lining of Catheter",
        "unit": "count",
        "formulaText": "value = Accidental De-lining of Catheter",
        "numeratorDef": "Accidental / unplanned catheter or line dislodgements.",
        "reference": "NABH device-management safety indicator."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Staff safety - zero in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Oct 2025: nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-dial-infection-rate",
        "name": "Infection Rate",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero infections in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Infection Rate",
        "unit": "count",
        "formulaText": "value = Infection Rate",
        "numeratorDef": "Healthcare-associated infection events in the unit.",
        "reference": "NABH HAI surveillance (event count)."
      },
      {
        "id": "ind-dial-adequacy",
        "name": "Dialysis Adequacy (URR)",
        "valueType": "%",
        "benchmark": ">=65% URR",
        "benchmarkValue": 65,
        "goalDirection": "higher_is_better",
        "remarks": "Pending - awaiting per-session adequacy data.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "pct",
        "numLabel": "Sessions achieving URR ≥65% (or Kt/V ≥1.2)",
        "denLabel": "Dialysis sessions sampled",
        "unit": "%",
        "formulaText": "(Sessions achieving URR ≥65% (or Kt/V ≥1.2) ÷ Dialysis sessions sampled) × 100",
        "numeratorDef": "Haemodialysis sessions meeting the adequacy target (URR ≥65% or single-pool Kt/V ≥1.2).",
        "denominatorDef": "Dialysis sessions in which adequacy (URR / Kt/V) was measured.",
        "reference": "KDOQI Haemodialysis Adequacy — URR ≥65% / spKt/V ≥1.2."
      },
      {
        "id": "ind-dial-hypotension",
        "name": "Hypotension Rate",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "1 hypotension event in October 2025.",
        "quarters": {
          "Q1": 1,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): 1 hypotension event in October",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Hypotension Rate",
        "unit": "count",
        "formulaText": "value = Hypotension Rate",
        "numeratorDef": "Intradialytic hypotension events.",
        "reference": "Dialysis safety — intradialytic hypotension."
      },
      {
        "id": "ind-dial-vascular-complic",
        "name": "Vascular Access Complication Rate",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero in reported quarter.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q4): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "count",
        "numLabel": "Vascular Access Complication Rate",
        "unit": "count",
        "formulaText": "value = Vascular Access Complication Rate",
        "numeratorDef": "Vascular-access complications (infection, thrombosis, bleeding).",
        "reference": "Dialysis vascular-access safety."
      },
      {
        "id": "ind-dial-water-quality",
        "name": "Water Quality Compliance",
        "valueType": "%",
        "benchmark": "100% AAMI/ISO compliance",
        "benchmarkValue": 100,
        "goalDirection": "higher_is_better",
        "remarks": "Pending - awaiting water quality test results.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "pct",
        "numLabel": "Water/dialysate samples within AAMI/ISO limits",
        "denLabel": "Water/dialysate samples tested",
        "unit": "%",
        "formulaText": "(Water/dialysate samples within AAMI/ISO limits ÷ Water/dialysate samples tested) × 100",
        "numeratorDef": "Samples meeting AAMI/ISO chemical & microbiological purity limits.",
        "denominatorDef": "Total water / dialysate samples tested in the period.",
        "reference": "AAMI / ISO 23500 — water & dialysate quality for haemodialysis."
      }
    ]
  },
  {
    "key": "Gastroenterology",
    "name": "Gastroenterology",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across all four quality indicators (Phlebitis, Medication Administration Error, Patient Fall, Post-Procedure Complication) for every reported quarter. Full-year coverage with 110 total patients (24 Sep-Nov 2025, 6 Dec 2025, 34 Jan-Mar 2026, 46 Apr-May 2026).",
      "majorGaps": "None identified - zero defect maintained across all indicators.",
      "overallStatus": "Excellent",
      "recommendations": "Sustain pre/post-procedure assessment, sedation safety protocol, fall-risk screening for sedated patients, and IV-site care to maintain zero adverse events."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-gastro-phlebitis",
        "name": "Phlebitis",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Nov 2025 (calendar 2025 Q3, 24 patients): nil",
          "Q2": "Dec 2025 (calendar 2025 Q4, 6 patients): nil",
          "Q3": "Jan-Mar 2026 (calendar 2026 Q1, 34 patients): nil",
          "Q4": "Apr-May 2026 (calendar 2026 Q2, 46 patients): nil"
        },
        "formula": "count",
        "numLabel": "Phlebitis",
        "unit": "count",
        "formulaText": "value = Phlebitis",
        "numeratorDef": "Peripheral IV phlebitis events (grade ≥2).",
        "reference": "INS Infusion Therapy Standards — phlebitis scale."
      },
      {
        "id": "ind-gastro-med-error",
        "name": "Medication Administration Error",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Nov 2025: nil",
          "Q2": "Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Medication Administration Error",
        "unit": "count",
        "formulaText": "value = Medication Administration Error",
        "numeratorDef": "Medication errors reported (prescribing/dispensing/administration).",
        "reference": "NABH MOM · NCC-MERP medication-error taxonomy."
      },
      {
        "id": "ind-gastro-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Nov 2025: nil",
          "Q2": "Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-gastro-post-proc-comp",
        "name": "Post-Procedure Complication",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Nov 2025: nil",
          "Q2": "Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Post-Procedure Complication",
        "unit": "count",
        "formulaText": "value = Post-Procedure Complication",
        "numeratorDef": "Complications following an endoscopic/diagnostic procedure.",
        "reference": "Procedural safety indicator."
      }
    ]
  },
  {
    "key": "InfectionControl",
    "name": "Infection Control",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Overall hand hygiene compliance trending upward: 62.2% (Sep 2025) -> 79% (Apr 2026), a 17 percentage point improvement. Nurses peaked at 87.6% in Feb 2026 - above the WHO 80% benchmark.",
      "majorGaps": "All four indicators remain below the WHO 80% benchmark on average. Doctors consistently lowest (61-71%). Others (paramedics/support) lowest overall (53-63%) with a drop to 53% in April 2026. April 2026 saw a regression for Doctors, Nurses, and Others despite Overall hitting 79%.",
      "overallStatus": "Needs Improvement",
      "recommendations": "Targeted hand hygiene training for Doctors and Others - both groups well below benchmark. Investigate April 2026 regression across groups. Maintain Nurse-focused initiatives that drove the Feb 2026 spike. Hold monthly compliance huddles per department."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-ic-hh-overall",
        "name": "Hand Hygiene Compliance - Overall",
        "valueType": "%",
        "benchmark": ">=80%",
        "benchmarkValue": 80,
        "goalDirection": "higher_is_better",
        "remarks": "Below 80% WHO benchmark across all quarters. Improving trend.",
        "quarters": {
          "Q1": null,
          "Q2": 63.97,
          "Q3": 74.07,
          "Q4": 79
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Oct-Dec 2025 avg (Oct 61.5%, Nov 68.4%, Dec 62%) - calendar 2025 Q4",
          "Q3": "Jan-Mar 2026 avg (Jan 68%, Feb 76%, Mar 78.2%) - calendar 2026 Q1",
          "Q4": "Apr 2026 (calendar 2026 Q2): 79% (248/195)"
        },
        "formula": "pct",
        "numLabel": "Compliant hand-hygiene moments",
        "denLabel": "Observed hand-hygiene opportunities",
        "unit": "%",
        "formulaText": "(Compliant hand-hygiene moments ÷ Observed hand-hygiene opportunities) × 100",
        "numeratorDef": "Observed moments where hand hygiene was correctly performed (all staff groups).",
        "denominatorDef": "Total hand-hygiene opportunities observed (WHO 5 Moments).",
        "reference": "WHO \"My 5 Moments for Hand Hygiene\" — compliance = actions ÷ opportunities × 100."
      },
      {
        "id": "ind-ic-hh-doctors",
        "name": "Hand Hygiene Compliance - Doctors",
        "valueType": "%",
        "benchmark": ">=80%",
        "benchmarkValue": 80,
        "goalDirection": "higher_is_better",
        "remarks": "Doctor compliance lowest among groups. Below 80% across all quarters.",
        "quarters": {
          "Q1": null,
          "Q2": 61.77,
          "Q3": 70,
          "Q4": 66
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Oct-Dec 2025 avg (Oct 63, Nov 62.3, Dec 60%)",
          "Q3": "Jan-Mar 2026 avg (Jan 69, Feb 70, Mar 71%)",
          "Q4": "Apr 2026: 66% (regression)"
        },
        "formula": "pct",
        "numLabel": "Compliant moments — Doctors",
        "denLabel": "Observed opportunities — Doctors",
        "unit": "%",
        "formulaText": "(Compliant moments — Doctors ÷ Observed opportunities — Doctors) × 100",
        "numeratorDef": "Hand-hygiene moments correctly performed by doctors.",
        "denominatorDef": "Hand-hygiene opportunities observed for doctors.",
        "reference": "WHO \"My 5 Moments for Hand Hygiene\" (doctor cohort)."
      },
      {
        "id": "ind-ic-hh-nurses",
        "name": "Hand Hygiene Compliance - Nurses",
        "valueType": "%",
        "benchmark": ">=80%",
        "benchmarkValue": 80,
        "goalDirection": "higher_is_better",
        "remarks": "Best-performing group. Feb 2026 peaked at 87.6% (above benchmark). Drop in April to 69%.",
        "quarters": {
          "Q1": null,
          "Q2": 69,
          "Q3": 77.2,
          "Q4": 69
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Oct-Dec 2025 avg (Oct 67, Nov 74, Dec 66)",
          "Q3": "Jan-Mar 2026 avg (Jan 70, Feb 87.6, Mar 74)",
          "Q4": "Apr 2026: 69% (drop from Feb peak)"
        },
        "formula": "pct",
        "numLabel": "Compliant moments — Nurses",
        "denLabel": "Observed opportunities — Nurses",
        "unit": "%",
        "formulaText": "(Compliant moments — Nurses ÷ Observed opportunities — Nurses) × 100",
        "numeratorDef": "Hand-hygiene moments correctly performed by nurses.",
        "denominatorDef": "Hand-hygiene opportunities observed for nurses.",
        "reference": "WHO \"My 5 Moments for Hand Hygiene\" (nurse cohort)."
      },
      {
        "id": "ind-ic-hh-others",
        "name": "Hand Hygiene Compliance - Others",
        "valueType": "%",
        "benchmark": ">=80%",
        "benchmarkValue": 80,
        "goalDirection": "higher_is_better",
        "remarks": "Others (paramedics/support) consistently below 65%. Targeted training needed.",
        "quarters": {
          "Q1": null,
          "Q2": 58.53,
          "Q3": 60.67,
          "Q4": 53
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Oct-Dec 2025 avg (Oct 53.2, Nov 63, Dec 59.4%)",
          "Q3": "Jan-Mar 2026 avg (Jan 62, Feb 60, Mar 60%)",
          "Q4": "Apr 2026: 53% (lowest point)"
        },
        "formula": "pct",
        "numLabel": "Compliant moments — Others",
        "denLabel": "Observed opportunities — Others",
        "unit": "%",
        "formulaText": "(Compliant moments — Others ÷ Observed opportunities — Others) × 100",
        "numeratorDef": "Hand-hygiene moments correctly performed by paramedics / support staff.",
        "denominatorDef": "Hand-hygiene opportunities observed for other staff.",
        "reference": "WHO \"My 5 Moments for Hand Hygiene\" (other-staff cohort)."
      }
    ]
  },
  {
    "key": "LDR",
    "name": "LDR",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across seven safety indicators (CAUTI, CLABSI, VAP, SSI, HAPU, DVT, Patient Fall) for all four reported quarters. 100% Partograph and Fetal HR monitoring compliance maintained. Patient volume: 10 (Q3 2025), 19 (Q4 2025), 33 (Q1 2026), 21 (Q2 2026) = 83 total.",
      "majorGaps": "1 Needle Stick Injury in Sep-Oct 2025 - any injury is above the zero-defect benchmark.",
      "overallStatus": "Good",
      "recommendations": "Conduct root cause analysis on the Q3 2025 NSI case. Reinforce safe sharps disposal, safety-engineered devices, and double-glove protocol during deliveries. Sustain current partograph, fetal monitoring, and infection-prevention bundles."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-ldr-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025 (calendar 2025 Q3, 10 patients): nil",
          "Q2": "Nov-Dec 2025 (calendar 2025 Q4, 19 patients): nil",
          "Q3": "Jan-Mar 2026 (calendar 2026 Q1, 33 patients): nil",
          "Q4": "Apr-May 2026 (calendar 2026 Q2, 21 patients): nil"
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-ldr-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-ldr-vap",
        "name": "Ventilator-Associated Pneumonia (VAP)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Ventilator-Associated Pneumonia (VAP)",
        "unit": "count",
        "formulaText": "value = Ventilator-Associated Pneumonia (VAP)",
        "numeratorDef": "Ventilator-associated pneumonia / events.",
        "reference": "CDC NHSN — VAP / VAE surveillance definition."
      },
      {
        "id": "ind-ldr-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-ldr-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-ldr-dvt",
        "name": "Deep Vein Thrombosis (DVT)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Deep Vein Thrombosis (DVT)",
        "unit": "count",
        "formulaText": "value = Deep Vein Thrombosis (DVT)",
        "numeratorDef": "Hospital-acquired deep-vein thrombosis events.",
        "reference": "NABH VTE prophylaxis & surveillance."
      },
      {
        "id": "ind-ldr-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "1 NSI in Sep-Oct 2025. Zero in subsequent quarters.",
        "quarters": {
          "Q1": 1,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Sep-Oct 2025 (calendar 2025 Q3, 10 patients): 1 case",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-ldr-partograph",
        "name": "Partograph Compliance",
        "valueType": "%",
        "benchmark": "100%",
        "benchmarkValue": 100,
        "goalDirection": "higher_is_better",
        "remarks": "100% compliance maintained in 2026 Q1 and Q2.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 100,
          "Q4": 100
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (calendar 2026 Q1): 100%",
          "Q4": "Apr-May 2026 (calendar 2026 Q2): 100%"
        },
        "formula": "pct",
        "numLabel": "Deliveries with a correctly completed partograph",
        "denLabel": "Eligible labouring women",
        "unit": "%",
        "formulaText": "(Deliveries with a correctly completed partograph ÷ Eligible labouring women) × 100",
        "numeratorDef": "Labours in which the partograph was completed per protocol.",
        "denominatorDef": "All eligible labouring women in the period.",
        "reference": "WHO Labour Care Guide / partograph use in labour monitoring."
      },
      {
        "id": "ind-ldr-fetal-hr",
        "name": "Fetal Heart Rate Monitoring Compliance",
        "valueType": "%",
        "benchmark": "100%",
        "benchmarkValue": 100,
        "goalDirection": "higher_is_better",
        "remarks": "100% compliance sustained from Q4 2025 through Q2 2026.",
        "quarters": {
          "Q1": null,
          "Q2": 100,
          "Q3": 100,
          "Q4": 100
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025 (calendar 2025 Q4): 100%",
          "Q3": "Jan-Mar 2026 (calendar 2026 Q1): 100%",
          "Q4": "Apr-May 2026 (calendar 2026 Q2): 100%"
        },
        "formula": "pct",
        "numLabel": "Deliveries with FHR monitored per protocol",
        "denLabel": "Deliveries requiring FHR monitoring",
        "unit": "%",
        "formulaText": "(Deliveries with FHR monitored per protocol ÷ Deliveries requiring FHR monitoring) × 100",
        "numeratorDef": "Labours with fetal heart-rate monitored at the protocol-defined frequency.",
        "denominatorDef": "All labours requiring fetal heart-rate monitoring.",
        "reference": "Intrapartum fetal surveillance — FHR monitoring compliance."
      }
    ]
  },
  {
    "key": "Level10",
    "name": "Level 10",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across seven IPD quality indicators (Medication Administration Error, HAPU, Phlebitis, CLABSI, CAUTI, NSI, SSI) in both reporting periods.",
      "majorGaps": "2 patient falls reported during the year: 1 in 2025 Q3 (Jul-Sep) and 1 in 2026 Q2 (Apr-Jun). Other quarters not reported.",
      "overallStatus": "Good",
      "recommendations": "Conduct root cause analysis on both fall incidents. Reinforce fall-risk assessment protocol (Morse scale on admission and shift change), bed-alarm use for high-risk patients, and patient/family education on call-bell use. Sustain current infection-prevention and medication-safety practices."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-l10-medication-error",
        "name": "Medication Administration Error",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Medication Administration Error",
        "unit": "count",
        "formulaText": "value = Medication Administration Error",
        "numeratorDef": "Medication errors reported (prescribing/dispensing/administration).",
        "reference": "NABH MOM · NCC-MERP medication-error taxonomy."
      },
      {
        "id": "ind-l10-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-l10-phlebitis",
        "name": "Phlebitis",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Phlebitis",
        "unit": "count",
        "formulaText": "value = Phlebitis",
        "numeratorDef": "Peripheral IV phlebitis events (grade ≥2).",
        "reference": "INS Infusion Therapy Standards — phlebitis scale."
      },
      {
        "id": "ind-l10-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-l10-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Staff safety indicator - zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-l10-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": null,
          "Q3": null,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): nil",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): nil"
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-l10-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "2 falls for the year: 1 in 2025 Q3 (Jul-Sep), 1 in 2026 Q2 (Apr-Jun). Trigger for fall-risk RCA.",
        "quarters": {
          "Q1": 1,
          "Q2": null,
          "Q3": null,
          "Q4": 1
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (reported as 2025 Q3): 1 fall",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Apr-May 2026 (reported as 2026 Q2): 1 fall"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      }
    ]
  },
  {
    "key": "Level9",
    "name": "Level 9",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across all nine IPD quality indicators (HAPU, Patient Fall, Phlebitis, Medication Administration Error, NSI, CAUTI, CLABSI, SSI, Accidental Catheter Removal) for both reported quarters. Patient volume: 20 (Q3 Jan-Mar 2026), 61 (Q4 Apr-May 2026); total 81 patients.",
      "majorGaps": "Q1 (Aug-Oct 2025) and Q2 (Nov-Dec 2025) data not reported.",
      "overallStatus": "Excellent",
      "recommendations": "Sustain current infection-prevention and patient-safety protocols. Begin reporting Q1 and Q2 data going forward to enable full-year trending."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-l9-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-l9-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-l9-phlebitis",
        "name": "Phlebitis",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Phlebitis",
        "unit": "count",
        "formulaText": "value = Phlebitis",
        "numeratorDef": "Peripheral IV phlebitis events (grade ≥2).",
        "reference": "INS Infusion Therapy Standards — phlebitis scale."
      },
      {
        "id": "ind-l9-medication-error",
        "name": "Medication Administration Error",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Medication Administration Error",
        "unit": "count",
        "formulaText": "value = Medication Administration Error",
        "numeratorDef": "Medication errors reported (prescribing/dispensing/administration).",
        "reference": "NABH MOM · NCC-MERP medication-error taxonomy."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Staff safety indicator - zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-l9-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-l9-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-l9-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-l9-accidental-catheter",
        "name": "Accidental Removal of Catheter",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across both reported quarters.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Jan-Mar 2026 (20 patients): nil",
          "Q4": "Apr-May 2026 (61 patients): nil"
        },
        "formula": "count",
        "numLabel": "Accidental Removal of Catheter",
        "unit": "count",
        "formulaText": "value = Accidental Removal of Catheter",
        "numeratorDef": "Accidental / unplanned catheter or line dislodgements.",
        "reference": "NABH device-management safety indicator."
      }
    ]
  },
  {
    "key": "MICU",
    "name": "MICU",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across all twelve MICU quality indicators (Re-intubation within 48hr, ICU Re-admission within 48hr, HAPU, CAUTI, CLABSI, VAP, SSI, Phlebitis, Patient Fall, Accidental Catheter Dislodgement, Medication Administration Error, Needle Stick Injury) for Q2, Q3, and Q4.",
      "majorGaps": "Q1 (Aug-Oct 2025) data not reported.",
      "overallStatus": "Excellent",
      "recommendations": "Sustain current infection-prevention bundles (VAP, CAUTI, CLABSI), ventilator weaning protocol, pressure-injury prevention, fall-risk assessment, and medication-safety practices. Begin reporting Q1 data going forward for full-year trending."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-micu-reintubation-48hr",
        "name": "Re-intubation within 48 hours",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Re-intubation within 48 hours",
        "unit": "count",
        "formulaText": "value = Re-intubation within 48 hours",
        "numeratorDef": "Re-intubations within 48 hours of planned extubation.",
        "reference": "Critical-care outcome — unplanned re-intubation <48h."
      },
      {
        "id": "ind-micu-readmission-48hr",
        "name": "ICU Re-admission within 48 hours",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "ICU Re-admission within 48 hours",
        "unit": "count",
        "formulaText": "value = ICU Re-admission within 48 hours",
        "numeratorDef": "ICU re-admissions within 48 hours of discharge from the unit.",
        "reference": "Critical-care outcome — ICU re-admission <48h."
      },
      {
        "id": "ind-micu-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-micu-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-micu-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-micu-vap",
        "name": "Ventilator-Associated Pneumonia (VAP)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Ventilator-Associated Pneumonia (VAP)",
        "unit": "count",
        "formulaText": "value = Ventilator-Associated Pneumonia (VAP)",
        "numeratorDef": "Ventilator-associated pneumonia / events.",
        "reference": "CDC NHSN — VAP / VAE surveillance definition."
      },
      {
        "id": "ind-micu-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-micu-phlebitis",
        "name": "Phlebitis",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Phlebitis",
        "unit": "count",
        "formulaText": "value = Phlebitis",
        "numeratorDef": "Peripheral IV phlebitis events (grade ≥2).",
        "reference": "INS Infusion Therapy Standards — phlebitis scale."
      },
      {
        "id": "ind-micu-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-micu-accidental-catheter",
        "name": "Accidental Catheter Dislodgement",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Accidental Catheter Dislodgement",
        "unit": "count",
        "formulaText": "value = Accidental Catheter Dislodgement",
        "numeratorDef": "Accidental / unplanned catheter or line dislodgements.",
        "reference": "NABH device-management safety indicator."
      },
      {
        "id": "ind-micu-medication-error",
        "name": "Medication Administration Error",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Medication Administration Error",
        "unit": "count",
        "formulaText": "value = Medication Administration Error",
        "numeratorDef": "Medication errors reported (prescribing/dispensing/administration).",
        "reference": "NABH MOM · NCC-MERP medication-error taxonomy."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Staff safety indicator - zero across Q2, Q3, Q4.",
        "quarters": {
          "Q1": null,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      }
    ]
  },
  {
    "key": "NICU",
    "name": "NICU",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "",
      "majorGaps": "1 accidental ETT removal in December 2025 — rate 8.3 per 100 ventilator days, well above the <1.0 benchmark. Triggers safety review.",
      "overallStatus": "Needs Improvement",
      "recommendations": "Conduct root cause analysis on the December 2025 ETT removal. Reinforce ETT securement protocol (tape technique, tube position checks each shift), agitation/sedation review, and bedside monitoring for high-risk neonates. Audit ventilator-day denominator tracking."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-nicu-ett-removal",
        "name": "Accidental Removal of ETT Tube",
        "valueType": "%",
        "benchmark": "<1.0 per 100 ventilator days",
        "benchmarkValue": 1,
        "goalDirection": "lower_is_better",
        "remarks": "1 event in December 2025; rate = 8.3 per 100 ventilator days (implies ~12 ventilator days in the period).",
        "quarters": {
          "Q1": null,
          "Q2": 8.3,
          "Q3": null,
          "Q4": null
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Nov-Dec 2025: 1 accidental removal, rate 8.3 per 100 ventilator days",
          "Q3": "Not reported",
          "Q4": "Not reported"
        },
        "formula": "pct",
        "numLabel": "Accidental / unplanned ETT removals",
        "denLabel": "Ventilator days",
        "unit": "%",
        "formulaText": "(Accidental / unplanned ETT removals ÷ Ventilator days) × 100",
        "numeratorDef": "Unplanned (accidental or self-) extubation events in ventilated neonates.",
        "denominatorDef": "Total ventilator days in the period (value is expressed per 100 ventilator-days).",
        "reference": "Neonatal ventilation safety — unplanned extubation rate per 100 ventilator-days."
      }
    ]
  },
  {
    "key": "NursingTraining",
    "name": "Nursing Training",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Progressive improvement in mandatory training compliance through reminder systems and collaborative roster management with nurse managers and charge nurses. BLS certification activities ongoing to strengthen emergency response competency (20 nurses certified in the reporting period). Induction program reached 94% completion (114 of 122 nurses).",
      "majorGaps": "Mandatory training compliance at 80%, still below the >=90% benchmark. 8 nurses pending induction completion at end of reporting period (Jan-May 2026).",
      "overallStatus": "Good",
      "recommendations": "Continue advance scheduling and reminder systems for mandatory training. Arrange regular BLS certification and renewal sessions. Maintain close monitoring of ongoing induction completion. Strengthen coordination with nurse managers for staff participation in training activities."
    },
    "meta": {
      "preparedBy": "Chelcia Bani Baroi (Instructor, Quality & Training)",
      "reviewedBy": "Mohd. Balayet Hossen (Senior Nurse Manager, Quality & Training)",
      "approvedBy": "Elizabeth Jothi (Chief of Nursing, Unico Hospitals)"
    },
    "indicators": [
      {
        "id": "ind-mandatory-training",
        "name": "Mandatory Training Compliance",
        "valueType": "%",
        "benchmark": ">=90%",
        "benchmarkValue": 90,
        "goalDirection": "higher_is_better",
        "remarks": "Improving trend after reminder system and roster adjustment with nurse managers / charge nurses.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": 80
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Jan-May 2026 aggregate: 80%. Improving trend after reminder system and roster adjustment."
        },
        "formula": "pct",
        "numLabel": "Staff who completed mandatory training",
        "denLabel": "Staff due for mandatory training",
        "unit": "%",
        "formulaText": "(Staff who completed mandatory training ÷ Staff due for mandatory training) × 100",
        "numeratorDef": "Staff who completed their mandatory training within the cycle.",
        "denominatorDef": "Staff scheduled/due for mandatory training in the period.",
        "reference": "NABH HRM — mandatory staff training & education compliance."
      },
      {
        "id": "ind-bls-certification",
        "name": "BLS Certification Rate",
        "valueType": "Count",
        "benchmark": "Ongoing",
        "benchmarkValue": "",
        "goalDirection": "higher_is_better",
        "remarks": "Regular certification sessions continuing.",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": 20
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Jan-May 2026: 20 nurses certified. Regular sessions continuing."
        },
        "formula": "pct",
        "numLabel": "Clinical staff with valid BLS certification",
        "denLabel": "Clinical staff requiring BLS",
        "unit": "%",
        "formulaText": "(Clinical staff with valid BLS certification ÷ Clinical staff requiring BLS) × 100",
        "numeratorDef": "Clinical staff holding a current/valid Basic Life Support certification.",
        "denominatorDef": "Clinical staff required to hold BLS certification.",
        "reference": "AHA BLS — proportion of clinical staff with current certification."
      },
      {
        "id": "ind-induction-completion",
        "name": "Induction Completion within 30 Days",
        "valueType": "%",
        "benchmark": "100%",
        "benchmarkValue": 100,
        "goalDirection": "higher_is_better",
        "remarks": "114 completed, 8 ongoing (Jan-May 2026).",
        "quarters": {
          "Q1": null,
          "Q2": null,
          "Q3": null,
          "Q4": 94
        },
        "quarterRemarks": {
          "Q1": "Not reported",
          "Q2": "Not reported",
          "Q3": "Not reported",
          "Q4": "Jan-May 2026 aggregate: 94% (114 completed, 8 ongoing). Partially achieved."
        },
        "formula": "pct",
        "numLabel": "New staff completing induction within 30 days",
        "denLabel": "New staff who joined",
        "unit": "%",
        "formulaText": "(New staff completing induction within 30 days ÷ New staff who joined) × 100",
        "numeratorDef": "New joiners who completed induction/orientation within 30 days of joining.",
        "denominatorDef": "Total new staff who joined in the period.",
        "reference": "NABH HRM — induction/orientation of new staff."
      }
    ]
  },
  {
    "key": "OPD",
    "name": "OPD",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "",
      "majorGaps": "",
      "overallStatus": "Good",
      "recommendations": ""
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": []
  },
  {
    "key": "SurgicalICU",
    "name": "Surgical ICU",
    "year": "2025-2026",
    "executive": {
      "keyAchievements": "Zero events across all nine quality indicators (CAUTI, CLABSI, VAP, SSI, NSI, HAPU, DVT, Patient Fall, Return to ICU) for every reported quarter of the year. Full-year reporting completed (Q1-Q4). Patient volume: 14 (Q1 Aug-Oct 2025), 5 (Q2 Nov-Dec 2025), 4 (Q3 Jan-Mar 2026), 1 (Q4 Apr-May 2026); total 24 patients.",
      "majorGaps": "None identified - zero defect maintained across all indicators.",
      "overallStatus": "Excellent",
      "recommendations": "Sustain current infection-prevention bundles (VAP, CAUTI, CLABSI), DVT prophylaxis protocol, pressure-injury prevention, and fall-risk assessment. Continue post-discharge tracking to maintain zero Return-to-ICU rate."
    },
    "meta": {
      "preparedBy": "",
      "reviewedBy": "",
      "approvedBy": ""
    },
    "indicators": [
      {
        "id": "ind-sicu-cauti",
        "name": "Catheter-Associated UTI (CAUTI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Catheter-Associated UTI (CAUTI)",
        "unit": "count",
        "formulaText": "value = Catheter-Associated UTI (CAUTI)",
        "numeratorDef": "Lab-confirmed catheter-associated urinary tract infections.",
        "reference": "CDC NHSN — CAUTI surveillance definition."
      },
      {
        "id": "ind-sicu-clabsi",
        "name": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Central Line-Associated Bloodstream Infection (CLABSI)",
        "unit": "count",
        "formulaText": "value = Central Line-Associated Bloodstream Infection (CLABSI)",
        "numeratorDef": "Lab-confirmed central-line associated bloodstream infections.",
        "reference": "CDC NHSN — CLABSI surveillance definition."
      },
      {
        "id": "ind-sicu-vap",
        "name": "Ventilator-Associated Pneumonia (VAP)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Ventilator-Associated Pneumonia (VAP)",
        "unit": "count",
        "formulaText": "value = Ventilator-Associated Pneumonia (VAP)",
        "numeratorDef": "Ventilator-associated pneumonia / events.",
        "reference": "CDC NHSN — VAP / VAE surveillance definition."
      },
      {
        "id": "ind-sicu-ssi",
        "name": "Surgical Site Infection (SSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Surgical Site Infection (SSI)",
        "unit": "count",
        "formulaText": "value = Surgical Site Infection (SSI)",
        "numeratorDef": "Surgical site infections following an operative procedure.",
        "reference": "CDC NHSN — SSI surveillance definition."
      },
      {
        "id": "ind-needle-stick-injury",
        "name": "Needle Stick Injury (NSI)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Staff safety indicator - zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025: nil",
          "Q2": "Nov-Dec 2025: nil",
          "Q3": "Jan-Mar 2026: nil",
          "Q4": "Apr-May 2026: nil"
        },
        "formula": "count",
        "numLabel": "Needle Stick Injury (NSI)",
        "unit": "count",
        "formulaText": "value = Needle Stick Injury (NSI)",
        "numeratorDef": "Needle-stick / sharps injuries to staff.",
        "reference": "CDC sharps-safety · NABH staff-safety indicator."
      },
      {
        "id": "ind-sicu-hapu",
        "name": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Hospital-Acquired Pressure Ulcer (HAPU)",
        "unit": "count",
        "formulaText": "value = Hospital-Acquired Pressure Ulcer (HAPU)",
        "numeratorDef": "Hospital-acquired pressure ulcers (stage II+).",
        "reference": "NPUAP/EPUAP staging · NABH patient-safety indicator."
      },
      {
        "id": "ind-sicu-dvt",
        "name": "Deep Vein Thrombosis (DVT)",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Deep Vein Thrombosis (DVT)",
        "unit": "count",
        "formulaText": "value = Deep Vein Thrombosis (DVT)",
        "numeratorDef": "Hospital-acquired deep-vein thrombosis events.",
        "reference": "NABH VTE prophylaxis & surveillance."
      },
      {
        "id": "ind-sicu-patient-fall",
        "name": "Patient Fall",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Patient Fall",
        "unit": "count",
        "formulaText": "value = Patient Fall",
        "numeratorDef": "Patient fall events during the in-patient stay.",
        "reference": "NABH / NDNQI — patient fall events."
      },
      {
        "id": "ind-sicu-return-to-icu",
        "name": "Return to ICU",
        "valueType": "Count",
        "benchmark": "0 (zero defect)",
        "benchmarkValue": 0,
        "goalDirection": "lower_is_better",
        "remarks": "Zero across all four reported quarters.",
        "quarters": {
          "Q1": 0,
          "Q2": 0,
          "Q3": 0,
          "Q4": 0
        },
        "quarterRemarks": {
          "Q1": "Aug-Oct 2025 (14 patients): nil",
          "Q2": "Nov-Dec 2025 (5 patients): nil",
          "Q3": "Jan-Mar 2026 (4 patients): nil",
          "Q4": "Apr-May 2026 (1 patient): nil"
        },
        "formula": "count",
        "numLabel": "Return to ICU",
        "unit": "count",
        "formulaText": "value = Return to ICU",
        "numeratorDef": "Patients returning to ICU during the same admission.",
        "reference": "Critical-care outcome — return to ICU."
      }
    ]
  }
];
