/* UNICO — Quality Admin Console (unified). One self-contained module: dark-sidebar shell + 8 views
   (Dashboard, Scorecard, Trends, Reports, Incident Reports, Quality Data Entry, Action Plans,
   Indicator Administration = Manage / Assign / Catalog). Reads live data via window.useQualityStore().
   Assembled from the Claude Design "Quality Admin Console". Publishes window.QualityConsole. */

/* ===== part: 05-standards.jsx ===== */
/* HQI framework standards (96 indicators, A–M) — extracted verbatim from the design. */
var HQI_STANDARDS = [{"code":"A1","sec":"A","name":"Hand Hygiene Compliance","ft":"pct","dir":"high","unit":"%","bench":">90%","bv":90,"expr":"(Hand-hygiene actions performed ÷ Opportunities observed) × 100","ref":"WHO 2009 — Hand Hygiene Guidelines","num":"Hand-hygiene actions performed","den":"Opportunities observed"},{"code":"A2","sec":"A","name":"CAUTI Rate","ft":"rate1000","dir":"low","unit":"per 1000 cath-days","bench":"<1","bv":1,"expr":"(Catheter-associated UTIs ÷ Urinary catheter-days) × 1,000","ref":"CDC/NHSN 2024 — UTI Event","num":"CAUTI cases","den":"Urinary catheter-days"},{"code":"A3","sec":"A","name":"CLABSI Rate","ft":"rate1000","dir":"low","unit":"per 1000 line-days","bench":"<1","bv":1,"expr":"(Central line-associated BSIs ÷ Central-line days) × 1,000","ref":"CDC/NHSN 2024 — BSI Event","num":"CLABSI cases","den":"Central-line days"},{"code":"A4","sec":"A","name":"VAP / VAE Rate","ft":"rate1000","dir":"low","unit":"per 1000 vent-days","bench":"<1","bv":1,"expr":"(Ventilator-associated events ÷ Ventilator-days) × 1,000","ref":"CDC/NHSN 2024 — VAE Module","num":"VAP / VAE events","den":"Ventilator-days"},{"code":"A5","sec":"A","name":"Surgical Site Infection (SSI) Rate","ft":"pct","dir":"low","unit":"%","bench":"<1–2%","bv":2,"expr":"(SSIs within 30/90 days ÷ Surgical procedures) × 100","ref":"CDC/NHSN 2024; WHO 2018 SSI Guidelines","num":"SSI cases","den":"Surgical procedures"},{"code":"A6","sec":"A","name":"Phlebitis Rate (IV Site)","ft":"pct","dir":"low","unit":"%","bench":"≤5%","bv":5,"expr":"(IV sites with phlebitis VIP ≥2 ÷ Peripheral IV sites in use) × 100","ref":"INS 2021; Jackson VIP Score","num":"IV sites with phlebitis (VIP ≥2)","den":"Peripheral IV sites in use"},{"code":"A7","sec":"A","name":"MRSA / MDRO Infection Rate","ft":"rate1000","dir":"low","unit":"per 1000 pt-days","bench":"Minimize / track","bv":null,"expr":"(HA MRSA/MDRO infections ÷ Patient-days) × 1,000","ref":"CDC/NHSN 2024 MDRO; WHO 2022 AMR","num":"HA MRSA/MDRO infections","den":"Patient-days"},{"code":"A8","sec":"A","name":"Overall HAI Rate","ft":"pct","dir":"low","unit":"%","bench":"<5%","bv":5,"expr":"(All healthcare-associated infections ÷ Patient-days) × 100","ref":"WHO 2022 IPC Report; Allegranzi 2011","num":"All HAIs","den":"Patient-days"},{"code":"A9","sec":"A","name":"Blood Culture Contamination Rate","ft":"pct","dir":"low","unit":"%","bench":"<3%","bv":3,"expr":"(Culture sets with skin-flora contaminants ÷ Total culture sets) × 100","ref":"CLSI 2022 M47-A2","num":"Contaminated culture sets","den":"Blood culture sets collected"},{"code":"A10","sec":"A","name":"Surgical Antibiotic Prophylaxis Timing","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Prophylaxis ≤60 min before incision ÷ Eligible surgical patients) × 100","ref":"SCIP Inf-1; Bratzler 2013","num":"Patients with timely prophylaxis","den":"Eligible surgical patients"},{"code":"A11","sec":"A","name":"CSSD Sterilization (BI) Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Cycles with passing biological indicator ÷ Total sterilization cycles) × 100","ref":"AAMI/ANSI ST79:2017; ISO 11138-3","num":"Cycles passing BI","den":"Sterilization cycles run"},{"code":"A12","sec":"A","name":"Biomedical Waste Segregation Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Compliant waste-audit observations ÷ Total audit observations) × 100","ref":"WHO 2014 Safe Waste Mgmt","num":"Compliant audit observations","den":"Waste audit observations"},{"code":"A13","sec":"A","name":"Needle Stick / Sharps Injury","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of reported needlestick & sharps injuries","ref":"OSHA 29 CFR 1910.1030; WHO 2018","num":"Needlestick / sharps injuries","den":""},{"code":"A14","sec":"A","name":"Isolation / Transmission-Precaution Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Patients in correct isolation ÷ Patients requiring isolation) × 100","ref":"CDC/HICPAC 2007 (rev 2023)","num":"Correct isolations","den":"Patients requiring isolation"},{"code":"B1","sec":"B","name":"Medication Error","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of medication errors (all categories)","ref":"ISMP 2023; NQF 2011","num":"Medication errors","den":""},{"code":"B2","sec":"B","name":"Adverse Drug Reaction (ADR) Rate","ft":"count","dir":"","unit":"count","bench":"Track","bv":null,"expr":"Total count of confirmed ADRs (by severity)","ref":"WHO 2002 Pharmacovigilance; ICH E2A","num":"Confirmed ADRs","den":""},{"code":"B3","sec":"B","name":"Medication Reconciliation Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Reconciliation at admit AND discharge ÷ Admissions & discharges) × 100","ref":"JCI 2021 IPSG.3; ISMP 2011","num":"Completed reconciliations","den":"Admissions & discharges"},{"code":"B4","sec":"B","name":"High-Alert Medication Double-Check","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(High-alert doses with independent double-check ÷ High-alert doses) × 100","ref":"ISMP 2023; JCI 2021 MMU.5","num":"Doses double-checked","den":"High-alert doses administered"},{"code":"B5","sec":"B","name":"Verbal / Telephone Order Read-Back","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Orders with documented read-back ÷ Verbal/telephone orders) × 100","ref":"JCI 2021 IPSG.2; TJC NPSG 02.01.01","num":"Orders with read-back","den":"Verbal/telephone orders"},{"code":"B6","sec":"B","name":"LASA Drug Storage / Labeling Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(LASA drugs stored & labelled correctly ÷ LASA drugs audited) × 100","ref":"ISMP 2023; WHO 2019","num":"LASA drugs compliant","den":"LASA drugs audited"},{"code":"B7","sec":"B","name":"Controlled Drug Count Accuracy","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Shift counts with zero discrepancy ÷ Controlled-drug counts) × 100","ref":"DEA 21 CFR 1304; Pharmacy Policy","num":"Counts with zero discrepancy","den":"Controlled-drug shift counts"},{"code":"B8","sec":"B","name":"STAT Medication Administration Timeliness","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(STAT orders within TAT ÷ Total STAT orders) × 100","ref":"ISMP 2011; TJC MM.04.01.01","num":"STAT orders within TAT","den":"STAT medication orders"},{"code":"C1","sec":"C","name":"Patient Identification (2-Identifier)","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Interactions with verified 2-identifier check ÷ Interactions audited) × 100","ref":"JCI 2021 IPSG.1; TJC NPSG 01.01.01","num":"Verified 2-identifier checks","den":"Care interactions audited"},{"code":"C2","sec":"C","name":"Patient Fall Rate","ft":"rate1000","dir":"low","unit":"per 1000 pt-days","bench":"≤3.3","bv":3.3,"expr":"(Patient falls assisted + unassisted ÷ Patient-days) × 1,000","ref":"NDNQI 2023; Morse 2009","num":"Patient falls","den":"Patient-days"},{"code":"C3","sec":"C","name":"Falls with Injury","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of falls resulting in any injury","ref":"NDNQI 2023; AHRQ 2013","num":"Falls with injury","den":""},{"code":"C4","sec":"C","name":"Hospital-Acquired Pressure Ulcer (HAPU) Rate","ft":"rate1000","dir":"low","unit":"per 1000 pt-days","bench":"<0.75","bv":0.75,"expr":"(New stage 2–4/unstageable pressure injuries >72 h ÷ Patient-days) × 1,000","ref":"NPUAP/EPUAP/PPPIA 2019; NDNQI 2023","num":"New pressure injuries (stage 2–4)","den":"Patient-days"},{"code":"C5","sec":"C","name":"VTE / DVT Prophylaxis Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Eligible inpatients on VTE prophylaxis by day 2 ÷ Eligible inpatients) × 100","ref":"ACCP 2012; JCI 2021 IPSG.6","num":"Patients on prophylaxis","den":"Eligible adult inpatients"},{"code":"C6","sec":"C","name":"Hospital-Acquired DVT","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of new DVT events ≥48 h after admission","ref":"ACCP 2012; Goldhaber 2011","num":"New DVT events ≥48 h","den":""},{"code":"C7","sec":"C","name":"Wrong-Site / -Patient / -Procedure Events","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of wrong-site/-patient/-procedure (sentinel) events","ref":"TJC Universal Protocol; JCI 2021 IPSG.4","num":"Wrong-site/-patient/-procedure events","den":""},{"code":"C8","sec":"C","name":"Surgical Safety Checklist Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Procedures with all 3 checklist phases ÷ Surgical procedures) × 100","ref":"WHO 2009 SSC; Haynes 2009","num":"Procedures with full checklist","den":"Surgical procedures"},{"code":"C9","sec":"C","name":"Restraint Use Appropriateness / Monitoring","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Restraints with order + justification + monitoring ÷ Restrained patients) × 100","ref":"TJC RC.02.01.01; CMS 42 CFR 482.13(e)","num":"Appropriate restraints","den":"Restrained patients"},{"code":"C10","sec":"C","name":"Pain Assessment & Reassessment","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Pain assessed + reassessed ÷ Patients requiring assessment) × 100","ref":"JCI 2021 COP; TJC PC.01.02.07","num":"Pain assessed + reassessed","den":"Patients requiring assessment"},{"code":"C11","sec":"C","name":"Critical Value Reporting Timeliness","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Critical values reported within TAT ÷ Critical values generated) × 100","ref":"TJC NPSG 02.03.01; CLIA","num":"Critical values within TAT","den":"Critical values generated"},{"code":"C12","sec":"C","name":"Patient Handover (SBAR) Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Handovers using SBAR ÷ Handovers audited) × 100","ref":"JCI 2021 IPSG.2.2; WHO 2007","num":"SBAR handovers","den":"Handovers audited"},{"code":"D1","sec":"D","name":"Gross Hospital Mortality Rate","ft":"pct","dir":"","unit":"%","bench":"Track / benchmark","bv":null,"expr":"(Inpatient deaths ÷ Discharges incl. deaths) × 100","ref":"AHRQ 2020 IQI; CMS IQR","num":"Inpatient deaths","den":"Discharges incl. deaths"},{"code":"D2","sec":"D","name":"ICU Mortality Rate","ft":"pct","dir":"","unit":"%","bench":"Track (APACHE/SOFA)","bv":null,"expr":"(ICU deaths ÷ ICU admissions) × 100","ref":"SCCM 2020; Knaus 1985 APACHE II","num":"ICU deaths","den":"ICU admissions"},{"code":"D3","sec":"D","name":"ICU Re-admission within 48 h","ft":"pct","dir":"low","unit":"%","bench":"<5%","bv":5,"expr":"(ICU readmits ≤48 h ÷ Planned ICU step-downs) × 100","ref":"SCCM 2020; Rosenberg 2001","num":"ICU readmits ≤48 h","den":"Planned ICU discharges"},{"code":"D4","sec":"D","name":"Re-admission within 30 Days","ft":"pct","dir":"low","unit":"%","bench":"Track / minimize","bv":null,"expr":"(30-day readmissions ÷ Discharges excl. deaths/planned) × 100","ref":"CMS HRRP; Jencks 2009","num":"30-day readmissions","den":"Eligible discharges"},{"code":"D5","sec":"D","name":"Re-intubation within 48 h","ft":"pct","dir":"low","unit":"%","bench":"<10%","bv":10,"expr":"(Re-intubations ≤48 h ÷ Planned extubations) × 100","ref":"Epstein 1998; SCCM 2020","num":"Re-intubations ≤48 h","den":"Planned extubations"},{"code":"D6","sec":"D","name":"Return to ICU","ft":"count","dir":"low","unit":"count","bench":"0 / minimize","bv":0,"expr":"Count of ward→ICU transfers  (or ÷ ICU discharges to ward × 100)","ref":"SCCM 2020; Rosenberg 2001","num":"Ward patients returned to ICU","den":""},{"code":"D7","sec":"D","name":"Unplanned Return to OT","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(Unplanned OT returns ÷ Surgical procedures) × 100","ref":"ACS NSQIP 2022; Clavien-Dindo","num":"Unplanned OT returns","den":"Surgical procedures"},{"code":"D8","sec":"D","name":"Accidental Removal of ETT (Unplanned Extubation)","ft":"rate100","dir":"low","unit":"per 100 vent-days","bench":"<1","bv":1,"expr":"(Unplanned extubations ÷ Ventilator-days) × 100","ref":"Girard 2008; SCCM 2020","num":"Unplanned extubations","den":"Ventilator-days"},{"code":"D9","sec":"D","name":"LAMA / DAMA Rate","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(AMA/LAMA discharges ÷ Total discharges) × 100","ref":"WHO 2014; Alfandre 2009","num":"AMA / LAMA discharges","den":"Hospital discharges"},{"code":"D10","sec":"D","name":"Cardiac Arrest (Code Blue) Events","ft":"count","dir":"","unit":"count","bench":"Track","bv":null,"expr":"Total count of in-hospital cardiac arrest (Code Blue) events","ref":"AHA 2020 ACLS; Utstein Style","num":"IHCA (Code Blue) events","den":""},{"code":"D11","sec":"D","name":"Cardiac Arrest Survival (ROSC)","ft":"pct","dir":"high","unit":"%","bench":"≥25%","bv":25,"expr":"(IHCA with sustained ROSC ≥20 min ÷ IHCA events) × 100","ref":"AHA 2020 ACLS; ILCOR 2020","num":"IHCA with sustained ROSC","den":"In-hospital cardiac arrest events"},{"code":"E1","sec":"E","name":"Informed Consent Completeness","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Procedures with complete signed consent ÷ Procedures needing consent) × 100","ref":"JCI 2021 PFR.5; TJC RI.01.03.01","num":"Complete signed consents","den":"Procedures requiring consent"},{"code":"E2","sec":"E","name":"Initial Nursing Assessment within 24 h","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Nursing assessment ≤24 h ÷ Inpatient admissions) × 100","ref":"JCI 2021 AOP.1; TJC PC.01.02.01","num":"Assessments ≤24 h","den":"Inpatient admissions"},{"code":"E3","sec":"E","name":"Nursing Care Plan Documentation","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Care plans ≤24–48 h ÷ Admitted patients) × 100","ref":"JCI 2021 AOP.1; NANDA 2021","num":"Documented care plans","den":"Admitted patients"},{"code":"E4","sec":"E","name":"Discharge Summary Timeliness","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Discharge summaries within TAT ÷ Discharges) × 100","ref":"JCI 2021 ACC.3; TJC RC.02.04.01","num":"Summaries within TAT","den":"Patient discharges"},{"code":"E5","sec":"E","name":"Allergy Documentation Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Allergy/NKDA documented ÷ Admissions) × 100","ref":"JCI 2021 IPSG.3; TJC NPSG 03.06.01","num":"Allergy/NKDA documented","den":"Patient admissions"},{"code":"E6","sec":"E","name":"Medication Chart Completeness","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Complete medication charts ÷ Charts audited) × 100","ref":"JCI 2021 MMU; TJC MM.04.01.01","num":"Complete medication charts","den":"Medication charts audited"},{"code":"E7","sec":"E","name":"Patient / Family Education Documentation","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Documented education sessions ÷ Eligible patients) × 100","ref":"JCI 2021 PFE.2; TJC PC.02.03.01","num":"Documented education sessions","den":"Eligible patients"},{"code":"F1","sec":"F","name":"Partograph Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Completed partographs ÷ Labours monitored) × 100","ref":"WHO 2014; FIGO 2018","num":"Completed partographs","den":"Labours monitored"},{"code":"F2","sec":"F","name":"Fetal Heart Rate (FHR) Monitoring","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Appropriate FHR monitoring ÷ Deliveries) × 100","ref":"ACOG #106 2021; FIGO 2015","num":"Appropriate FHR monitoring","den":"Deliveries"},{"code":"F3","sec":"F","name":"Caesarean-Section Rate","ft":"pct","dir":"","unit":"%","bench":"WHO optimal 10–15%","bv":null,"expr":"(Caesarean deliveries ÷ Total deliveries) × 100","ref":"WHO 2015; Robson Classification","num":"Caesarean deliveries","den":"Total deliveries"},{"code":"F4","sec":"F","name":"Postpartum Haemorrhage (PPH) Rate","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(Deliveries with PPH ÷ Total deliveries) × 100","ref":"WHO 2012; ACOG 183 2017","num":"Deliveries with PPH","den":"Total deliveries"},{"code":"F5","sec":"F","name":"Birth Asphyxia Rate","ft":"rate1000","dir":"low","unit":"per 1000 live births","bench":"Minimize","bv":null,"expr":"(5-min APGAR <7 / needing PPV ÷ Live births) × 1,000","ref":"WHO 2012; AAP/AHA NRP 2015","num":"Asphyxiated live births","den":"Live births"},{"code":"F6","sec":"F","name":"Neonatal Mortality Rate","ft":"rate1000","dir":"","unit":"per 1000 live births","bench":"Track (national)","bv":null,"expr":"(Neonatal deaths ≤28 days ÷ Live births) × 1,000","ref":"WHO 2023; UNICEF 2023","num":"Neonatal deaths ≤28 days","den":"Live births"},{"code":"F7","sec":"F","name":"Breastfeeding Initiation within 1 h","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Breastfeeding ≤1 h ÷ Live births) × 100","ref":"WHO/UNICEF 2018 BFHI","num":"Breastfeeding ≤1 h","den":"Live births"},{"code":"F8","sec":"F","name":"NICU CLABSI Rate","ft":"rate1000","dir":"low","unit":"per 1000 line-days","bench":"<1","bv":1,"expr":"(NICU CLABSI events ÷ NICU central-line days) × 1,000","ref":"CDC/NHSN 2024; Polin 2012","num":"NICU CLABSI events","den":"NICU central-line days"},{"code":"F9","sec":"F","name":"Kangaroo Mother Care (KMC) Compliance","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Eligible neonates receiving KMC ÷ Eligible neonates) × 100","ref":"WHO 2022; Conde-Agudelo 2016","num":"Neonates receiving KMC","den":"Eligible preterm/LBW neonates"},{"code":"G1","sec":"G","name":"Door-to-Balloon Time ≤90 min","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(STEMI PCI with D2B ≤90 min ÷ STEMI primary-PCI patients) × 100","ref":"ACC/AHA 2013; TJC AMI-8a","num":"STEMI PCI D2B ≤90 min","den":"STEMI primary-PCI patients"},{"code":"G2","sec":"G","name":"Post-PCI Complication","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of major post-PCI adverse events (24–48 h)","ref":"ACC/AHA 2021; NCDR CathPCI","num":"Major post-PCI adverse events","den":""},{"code":"G3","sec":"G","name":"Puncture Site Hematoma","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of access-site hematomas >5 cm after catheterization","ref":"ACC/AHA 2012; NCDR CathPCI","num":"Access-site hematomas >5 cm","den":""},{"code":"G4","sec":"G","name":"Door-to-ECG ≤10 min","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(ACS with ECG ≤10 min ÷ ACS presentations) × 100","ref":"ACC/AHA 2014; TJC AMI-1","num":"ACS with ECG ≤10 min","den":"ACS / chest-pain presentations"},{"code":"G5","sec":"G","name":"STEMI Door-to-Needle (Fibrinolysis)","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(STEMI fibrinolysis ≤30 min ÷ Eligible STEMI patients) × 100","ref":"ACC/AHA 2013; TJC AMI-7a","num":"Fibrinolysis ≤30 min","den":"Eligible STEMI patients"},{"code":"G6","sec":"G","name":"Heart Failure 30-Day Readmission","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(HF readmissions ≤30 days ÷ HF discharges) × 100","ref":"CMS HRRP (HF-30); AHRQ 2020","num":"HF 30-day readmissions","den":"Heart-failure discharges"},{"code":"H1","sec":"H","name":"Dialysis Adequacy — URR","ft":"pct","dir":"high","unit":"%","bench":"≥65%","bv":65,"expr":"(Patients with URR ≥65% ÷ Patients dialyzed) × 100 · URR=[(pre-BUN−post-BUN)÷pre-BUN]×100","ref":"KDOQI 2015; Tattersall 1996","num":"Patients with URR ≥65%","den":"Patients dialyzed"},{"code":"H2","sec":"H","name":"Kt/V Achievement","ft":"pct","dir":"high","unit":"%","bench":"≥90% achieve Kt/V ≥1.2","bv":90,"expr":"(Patients Kt/V ≥1.2 ÷ Patients dialyzed) × 100 · Kt/V via Daugirdas 2nd-gen","ref":"KDOQI 2015; Daugirdas 1993","num":"Patients with Kt/V ≥1.2","den":"Patients dialyzed"},{"code":"H3","sec":"H","name":"Water Quality Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Water/dialysate tests meeting AAMI/ISO ÷ Tests performed) × 100","ref":"AAMI/ANSI 23500:2019; ISO 23500","num":"Tests meeting AAMI/ISO","den":"Water quality tests performed"},{"code":"H4","sec":"H","name":"Intradialytic Hypotension","ft":"count","dir":"low","unit":"count","bench":"0 / minimize","bv":0,"expr":"Count of sessions with symptomatic hypotension (SBP drop ≥20 / <90 mmHg)","ref":"KDOQI 2015; Flythe 2015","num":"Sessions with symptomatic hypotension","den":""},{"code":"H5","sec":"H","name":"Vascular Access Complication","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of vascular access complications","ref":"KDOQI 2006; KDIGO 2019","num":"Vascular access complications","den":""},{"code":"H6","sec":"H","name":"Accidental De-lining of Catheter","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of accidental catheter disconnection events during dialysis","ref":"KDOQI 2006; Dialysis Nursing Policy","num":"Accidental de-lining events","den":""},{"code":"H7","sec":"H","name":"Dialysis Access Infection Rate","ft":"rate1000","dir":"low","unit":"per 1000 access-days","bench":"0","bv":0,"expr":"(Dialysis access infections ÷ Access-days) × 1,000","ref":"CDC/NHSN 2024 Dialysis Event; KDOQI 2006","num":"Dialysis access infections","den":"Access-days"},{"code":"H8","sec":"H","name":"Missed / Shortened Dialysis Sessions","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(Missed or shortened >10% sessions ÷ Scheduled sessions) × 100","ref":"KDOQI 2015; Saran 2003","num":"Missed / shortened sessions","den":"Scheduled dialysis sessions"},{"code":"I1","sec":"I","name":"On-Time First-Case Start","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(First cases starting on time ÷ First cases scheduled) × 100","ref":"AORN 2022; NHS England 2021","num":"First cases on time","den":"First cases scheduled"},{"code":"I2","sec":"I","name":"Elective Case Cancellation Rate","ft":"pct","dir":"low","unit":"%","bench":"<5%","bv":5,"expr":"(Elective cases cancelled same-day ÷ Elective cases scheduled) × 100","ref":"AORN 2022; RCS standards","num":"Same-day cancellations","den":"Elective cases scheduled"},{"code":"I3","sec":"I","name":"Instrument / Sponge Count Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Cases with documented counts at all timepoints ÷ Surgical procedures) × 100","ref":"AORN 2022; WHO 2009","num":"Cases with documented counts","den":"Surgical procedures"},{"code":"I4","sec":"I","name":"Specimen Labeling Error Rate","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of surgical specimen labeling errors","ref":"CAP 2021; TJC NPSG 01.01.01","num":"Specimen labeling errors","den":""},{"code":"I5","sec":"I","name":"Anaesthesia-Related Complication Rate","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of anaesthesia-related adverse events","ref":"ASA 2019; APSF; Merry 2010","num":"Anaesthesia adverse events","den":""},{"code":"I6","sec":"I","name":"PACU Recovery Delay Rate","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(PACU stays beyond threshold ÷ PACU admissions) × 100","ref":"ASPAN 2021; Aldrete 1995","num":"Delayed PACU discharges","den":"PACU admissions"},{"code":"J1","sec":"J","name":"Post-Procedure Complication","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Count of post-endoscopy complications within 30 days","ref":"ASGE 2015; BSG 2019","num":"Post-endoscopy complications","den":""},{"code":"J2","sec":"J","name":"Endoscope Reprocessing Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Endoscopes reprocessed per HLD protocol ÷ Endoscopes reprocessed) × 100","ref":"SGNA 2022; ESGE/ESGENA 2018","num":"Endoscopes per HLD protocol","den":"Endoscopes reprocessed"},{"code":"J3","sec":"J","name":"Perforation Rate","ft":"pct","dir":"low","unit":"%","bench":"Minimize (<0.1%)","bv":0.1,"expr":"(Iatrogenic perforations ÷ Endoscopic procedures) × 100","ref":"ASGE 2015; Pohl 2012","num":"Iatrogenic perforations","den":"Endoscopic procedures"},{"code":"J4","sec":"J","name":"Post-Polypectomy Bleeding","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Count of significant post-polypectomy bleeds within 30 days","ref":"ASGE 2015; ESGE 2022","num":"Post-polypectomy bleeds","den":""},{"code":"K1","sec":"K","name":"Triage-to-Consult / Door-to-Doctor Time","ft":"pct","dir":"high","unit":"%","bench":"≥90% per category","bv":90,"expr":"(Patients seen within triage TAT ÷ ED presentations by category) × 100","ref":"ACEP 2019 ESI; CTAS 2020","num":"Patients seen within TAT","den":"ED presentations"},{"code":"K2","sec":"K","name":"Left Without Being Seen (LWBS) Rate","ft":"pct","dir":"low","unit":"%","bench":"<2%","bv":2,"expr":"(Patients who left without being seen ÷ ED registrations) × 100","ref":"ACEP 2019; Hobbs 2000","num":"Left without being seen","den":"ED registrations"},{"code":"K3","sec":"K","name":"ED Re-attendance within 72 h","ft":"pct","dir":"low","unit":"%","bench":"<5%","bv":5,"expr":"(ED re-attendances ≤72 h ÷ ED discharges) × 100","ref":"ACEP 2019; NHS England","num":"ED re-attendances ≤72 h","den":"ED discharges"},{"code":"K4","sec":"K","name":"Door-to-Needle for Stroke Thrombolysis","ft":"pct","dir":"high","unit":"%","bench":"≥80%","bv":80,"expr":"(Stroke tPA ≤60 min ÷ Eligible stroke patients) × 100","ref":"AHA/ASA 2019; ESO 2021","num":"Stroke tPA ≤60 min","den":"Eligible ischemic-stroke patients"},{"code":"L1","sec":"L","name":"Mandatory Training Compliance","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Staff completing mandatory training ÷ Staff required) × 100","ref":"JCI 2021 SQE.3; TJC HR.01.05.01","num":"Staff completing training","den":"Staff required to train"},{"code":"L2","sec":"L","name":"BLS / ACLS Certification Rate","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Staff with valid BLS/ACLS ÷ Staff required) × 100","ref":"AHA 2020 BLS/ACLS; JCI 2021 SQE","num":"Staff with valid certification","den":"Staff required to certify"},{"code":"L3","sec":"L","name":"Induction Completion within 30 Days","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(New staff induction ≤30 days ÷ New staff) × 100","ref":"JCI 2021 SQE.7; TJC HR.01.04.01","num":"Inductions ≤30 days","den":"New employees"},{"code":"L4","sec":"L","name":"Accidental Catheter Dislodgement","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of accidental catheter dislodgements","ref":"JCI 2021 QPS; NDNQI 2023","num":"Accidental dislodgements","den":""},{"code":"L5","sec":"L","name":"Accidental Removal of Catheter","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of accidental (unplanned) catheter removals","ref":"JCI 2021 QPS; NDNQI 2023","num":"Accidental catheter removals","den":""},{"code":"M1","sec":"M","name":"Patient Satisfaction Score","ft":"pct","dir":"high","unit":"%","bench":"≥85%","bv":85,"expr":"(Patients rating care 'Very Good/Excellent' ÷ Patients surveyed) × 100","ref":"HCAHPS 2024; Press Ganey 2023","num":"Top-box ratings","den":"Patients surveyed"},{"code":"M2","sec":"M","name":"Complaint Resolution within TAT","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Complaints resolved within TAT ÷ Complaints received) × 100","ref":"JCI 2021 PFR.3; TJC RI.01.07.01","num":"Complaints resolved within TAT","den":"Complaints received"}];
var HQI_SECN = {"A":"Infection Prevention & Control","B":"Medication Safety","C":"Patient Safety (IPSG)","D":"Clinical Outcomes & Mortality","E":"Documentation & Process","F":"Maternal & Neonatal","G":"Cardiac / Cath Lab / CCU","H":"Dialysis","I":"Surgery / OT / Anaesthesia","J":"Endoscopy","K":"Emergency","L":"Staff / Device Safety / Training","M":"Patient Experience"};

/* ===== part: prelude.jsx ===== */
/* ============================================================================
   QUALITY ADMIN CONSOLE — PRELUDE (shared foundation)
   One bundled IIFE scope. These top-level declarations are visible to every
   sibling module component concatenated after this file. Do NOT wrap in an IIFE
   (the build does that). HQI_STANDARDS / HQI_SECN are provided by a separate
   file (05-standards) concatenated BEFORE this one — referenced, never defined.
   ============================================================================ */

const { useState, useEffect, useMemo, useRef } = React;

/* ---- palette ---- */
const P = {
  blue:'#0090ca', blue700:'#0072a3', teal:'#3ab5a7', violet:'#6a52d4',
  green:'#1f9d57', rose:'#d23a52', amber:'#e08a1e',
  ink:'#16202e', ink2:'#3c4858', muted:'#6c7a8c', faint:'#9aa6b4',
  line:'#dde3ec', line2:'#e8edf3', panel2:'#f7f9fc', navy:'#0d1b2e'
};

const MONO = "'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,monospace";

/* [storeKey, 'Mon YYYY', quarter] — fiscal year Jun-2025 … May-2026 */
const MONTHS = [
  ['Jun-25','Jun 2025','Q1'],['Jul-25','Jul 2025','Q1'],['Aug-25','Aug 2025','Q1'],
  ['Sep-25','Sep 2025','Q2'],['Oct-25','Oct 2025','Q2'],['Nov-25','Nov 2025','Q2'],
  ['Dec-25','Dec 2025','Q3'],['Jan-26','Jan 2026','Q3'],['Feb-26','Feb 2026','Q3'],
  ['Mar-26','Mar 2026','Q4'],['Apr-26','Apr 2026','Q4'],['May-26','May 2026','Q4']
];

const QORDER = ['Q1','Q2','Q3','Q4'];
const QL = [['Q1','Jun–Aug 25'],['Q2','Sep–Nov 25'],['Q3','Dec–Feb 26'],['Q4','Mar–May 26']];

const STATUS_CELL = {
  ok:['#e7f6ed','#1f9d57','✓'],
  breach:['#fbe9ec','#d23a52','!'],
  na:['#eef1f5','#9aa6b4','·']
};

/* ============================================================================
   AUTHORITATIVE COMPUTE HELPERS — copied from quality.jsx so numbers match.
   ============================================================================ */

function qiCompute(f, n, d){
  if(n==null||n==='') return null; n=Number(n);
  if(f==='count'||f==='direct') return n;
  if(d==null||d===''||Number(d)===0) return null; d=Number(d);
  if(f==='rate1000') return Math.round(n/d*1000*100)/100;
  return Math.round(n/d*100*100)/100; // rate100 & pct
}

/* true monthly value: direct -> months[key]; formula -> mNum/mDen; fall back to months[key] */
function monthRaw(ind, mk){
  const f = (ind && ind.formula) || ((ind && ind.valueType==='%') ? 'pct' : 'direct');
  if(f==='direct'){ const v = ind.months && ind.months[mk]; return (v==null||v==='') ? null : Number(v); }
  const n = ind.mNum && ind.mNum[mk];
  if(n==null||n===''){ const v = ind.months && ind.months[mk]; return (v==null||v==='') ? null : Number(v); }
  const d = (f!=='count') ? (ind.mDen && ind.mDen[mk]) : null;
  return qiCompute(f, n, d);
}

function qStatus(ind, v){
  if(v==null||v==='') return 'na';
  const b = ind.benchmarkValue;
  if(b==null||b==='') return 'ok';
  return ind.goalDirection==='higher_is_better' ? (v>=b?'ok':'breach') : (v<=b?'ok':'breach');
}

function monthStatus(ind, mk){ return qStatus(ind, monthRaw(ind, mk)); }

function qtrRaw(ind, Q){ const v = ind.quarters ? ind.quarters[Q] : null; return (v==null||v==='') ? null : Number(v); }
function qtrStatus(ind, Q){ return qStatus(ind, ind.quarters ? ind.quarters[Q] : null); }

function isPctInd(ind){
  const t = ((ind && ind.valueType) || '').toString().toLowerCase();
  return t.indexOf('%')>=0 || t.startsWith('per') || ind.formula==='pct';
}

/* aggregate ok/breach/na across 12 months × indicators for a department */
function deptStat(d){
  let ok=0, breach=0, na=0;
  (d.indicators||[]).forEach(ind => MONTHS.forEach(m => {
    const s = monthStatus(ind, m[0]);
    if(s==='ok') ok++; else if(s==='breach') breach++; else na++;
  }));
  return { ok, breach, na, rate: (ok+breach) ? Math.round(ok*100/(ok+breach)) : 100 };
}

function hasData(ind){
  return MONTHS.some(m => monthRaw(ind, m[0])!=null) || QORDER.some(q => qtrRaw(ind, q)!=null);
}

function countBreaches(ind){
  let n=0; MONTHS.forEach(m => { if(monthStatus(ind, m[0])==='breach') n++; }); return n;
}

function fmtVal(ind, v){
  if(v==null||v==='') return '—';
  const num = Math.round(Number(v)*100)/100;
  return isPctInd(ind) ? (num+'%') : num.toLocaleString();
}

function measureOf(f){
  if(f==='pct') return { name:'Percentage', color:P.teal, letter:'%' };
  if(f==='rate1000'||f==='rate100') return { name:'Rate', color:P.violet, letter:'R' };
  return { name:'Count', color:P.blue, letter:'C' };
}

function benchExpr(ind){
  const v = ind.benchmarkValue;
  if(v==null||v==='') return ind.benchmark || 'No benchmark';
  const sym = ind.goalDirection==='higher_is_better' ? '≥' : '≤';
  const pct = ind.formula==='pct' ? '%' : '';
  const unit = (ind.unit && !pct && ind.unit!=='count') ? (' '+ind.unit) : '';
  return sym+' '+v+pct+unit;
}

function formulaText(ind){
  const f = ind.formula;
  const num = ind.numLabel || ind.name || 'numerator';
  const den = ind.denLabel || 'denominator';
  if(f==='direct') return (ind.name||'Value')+' = entered value';
  if(f==='count') return 'value = '+num;
  return '('+num+' ÷ '+den+') '+(f==='rate1000' ? '× 1000' : '× 100');
}

function statusColorFor(s){
  return {
    Excellent:P.green, 'Very Good':P.teal, Good:P.blue, Satisfactory:P.teal,
    Fair:P.amber, Average:P.amber, 'Needs Improvement':P.rose, Poor:P.rose, '':P.muted
  }[s] || P.blue;
}

/* catOf — VERBATIM from design/logic.js (this. -> plain call) */
function catOf(n){
  n = (n||'').toLowerCase();
  if(/cauti|clabsi|vap|vae|ssi|infection|sepsis/.test(n)) return 'Healthcare-Associated Infection';
  if(/hand hygiene|water quality/.test(n)) return 'Infection Prevention';
  if(/needle stick|nsi/.test(n)) return 'Staff Safety';
  if(/training|competency/.test(n)) return 'Staff Competency';
  if(/volume/.test(n)) return 'Activity / Volume';
  if(/survival|adequacy|partograph|door-to-balloon/.test(n)) return 'Clinical Outcomes';
  if(/fall|medication|bed sore|hapu|pressure|dvt|phlebitis|hematoma|complication|hypotension|de-lining|de-linining|vascular|return/.test(n)) return 'Patient Safety';
  return 'Clinical Outcomes';
}

/* stdMatch — VERBATIM from design/logic.js (this. -> plain call) */
function stdMatch(name){
  const n = (name||'').toLowerCase();
  const T = [
    [/hand hygiene/,'A1'], [/\bcauti\b|catheter-associated uti/,'A2'], [/\bclabsi\b|central line/,'A3'],
    [/\bvap\b|ventilator-associated pneumonia/,'A4'], [/\bvae\b|ventilator-associated event/,'A4'],
    [/surgical site infection|\bssi\b/,'A5'], [/phlebitis/,'A6'], [/needle stick|\bnsi\b/,'A13'],
    [/medication error/,'B1'], [/falls with injury/,'C3'], [/patient fall/,'C2'],
    [/pressure ulcer|hapu|bed sore|pressure injury/,'C4'], [/deep vein thrombosis|\bdvt\b/,'C6'],
    [/return to icu/,'D6'], [/cardiac arrest survival/,'D11'], [/cardiac arrest events|code blue/,'D10'],
    [/partograph/,'F1'], [/door-to-balloon/,'G1'], [/post-pci/,'G2'], [/puncture site hematoma/,'G3'],
    [/dialysis adequacy|\burr\b/,'H1'], [/water quality/,'H3'], [/hypotension/,'H4'],
    [/vascular access complication/,'H5'], [/de-lining/,'H6'], [/infection rate/,'H7'],
    [/post-procedure complication/,'J1'], [/training compliance/,'L1'], [/accidental removal of catheter/,'L5'],
  ];
  for(const [re,code] of T){ if(re.test(n)) return code; }
  return null;
}

function norm(s){
  return (s||'').toLowerCase().replace(/\s*\(.*?\)\s*/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
}

function guideOf(code){
  try { return (typeof window!=='undefined' && window.HQI_GUIDE && window.HQI_GUIDE[code]) || null; }
  catch(e){ return null; }
}

/* Build a blank count-type indicator ready for the store (id via window.qualitySlug). */
function blankIndicator(name){
  return {
    id: (window.qualitySlug ? window.qualitySlug(name) : ('ind-'+norm(name).replace(/ /g,'-'))),
    name,
    formula:'count', valueType:'Count',
    goalDirection:'lower_is_better',
    benchmark:'0 (zero defect)', benchmarkValue:0,
    unit:'count', numLabel:name, denLabel:'',
    numeratorDef:'', denominatorDef:'',
    category:catOf(name), frequency:'Monthly', reference:'',
    months:{}, mNum:{}, mDen:{}, quarters:{}
  };
}

/* ===== part: mod-dashboard.jsx ===== */
function QCDashboard({ depts }) {
  const d = useMemo(() => {
    let ok = 0, br = 0, na = 0;
    const uniq = new Set();
    let totalInd = 0;
    depts.forEach(dep => {
      const s = deptStat(dep);
      ok += s.ok; br += s.breach; na += s.na;
      (dep.indicators || []).forEach(ind => { uniq.add(norm(ind.name)); totalInd++; });
    });
    const totalCells = ok + br + na || 1;

    const dashKpis = [
      { label: 'Departments', val: String(depts.length), foot: 'reporting quality KPIs', color: P.blue },
      { label: 'Indicators', val: String(uniq.size), foot: totalInd + ' across departments', color: P.violet },
      { label: 'Zero-Defect Rate', val: ((ok + br) ? Math.round(ok * 100 / (ok + br)) : 100) + '%', foot: ok + ' on benchmark · ' + br + ' breaches', color: P.green },
      { label: 'Breaches', val: String(br), foot: 'indicator-months off benchmark', color: br > 0 ? P.rose : P.green },
    ];

    const mix = [
      { label: 'On benchmark', v: ok, color: P.green },
      { label: 'Breach', v: br, color: P.rose },
      { label: 'Not reported', v: na, color: '#c4ccd6' },
    ].map(x => Object.assign(x, { pct: Math.round(x.v * 100 / totalCells) }));

    let maxB = 1;
    const bbm = MONTHS.map(m => {
      let b = 0;
      depts.forEach(dep => (dep.indicators || []).forEach(ind => { if (monthStatus(ind, m[0]) === 'breach') b++; }));
      if (b > maxB) maxB = b;
      return { label: m[1].split(' ')[0], val: b };
    });
    const breachByMonth = bbm.map(x => Object.assign(x, { h: Math.round(x.val / maxB * 100) }));

    const heatRows = depts.map(dep => {
      const inds = dep.indicators || [];
      const cells = QORDER.map(Q => {
        let b = 0, rep = 0;
        inds.forEach(ind => {
          const s = qtrStatus(ind, Q);
          if (s === 'breach') b++; else if (s !== 'na') rep++;
        });
        const bg = (b + rep) === 0 ? '#eef1f5' : b > 0 ? '#fbe9ec' : '#e7f6ed';
        const fg = (b + rep) === 0 ? '#9aa6b4' : b > 0 ? '#d23a52' : '#1f9d57';
        return { sym: (b + rep) === 0 ? '–' : b > 0 ? String(b) : '✓', bg, fg };
      });
      const st = deptStat(dep);
      let status = dep.status;
      if (!status) {
        const brRate = (st.ok + st.breach) ? st.breach / (st.ok + st.breach) : 0;
        status = brRate > 0.16 ? 'Needs Improvement' : brRate > 0.06 ? 'Good' : 'Excellent';
      }
      const sc = statusColorFor(status);
      return { name: dep.name, count: inds.length, cells, rate: st.rate + '%', status, statusColor: sc, statusBg: sc + '1c' };
    });

    return { dashKpis, mix, breachByMonth, heatRows };
  }, [depts]);

  const thBase = { padding: '9px 8px', fontSize: '10.5px', color: '#6c7a8c', fontWeight: 700, borderBottom: '1px solid #dde3ec', background: '#f7f9fc' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '13px', marginBottom: '16px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: '#eef8fc', color: '#0090ca', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"></path></svg>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '21px', fontWeight: 700, color: '#16202e', letterSpacing: '-.3px' }}>Quality Dashboard</h1>
          <div style={{ fontSize: '12.5px', color: '#6c7a8c', marginTop: '2px' }}>Hospital-wide quality &amp; patient-safety performance · FY 2025–26 (monthly)</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '13px', marginBottom: '16px' }}>
        {d.dashKpis.map(k => (
          <div key={k.label} style={{ background: '#fff', border: '1px solid #dde3ec', borderLeft: '4px solid ' + k.color, borderRadius: '11px', boxShadow: '0 1px 2px rgba(20,32,46,.06)', padding: '14px 17px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#3c4858', textTransform: 'uppercase', letterSpacing: '.3px' }}>{k.label}</div>
            <div style={{ fontFamily: MONO, fontSize: '27px', fontWeight: 600, color: k.color, lineHeight: 1, margin: '8px 0 5px', letterSpacing: '-.5px' }}>{k.val}</div>
            <div style={{ fontSize: '11px', color: '#9aa6b4' }}>{k.foot}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: '12px', boxShadow: '0 1px 2px rgba(20,32,46,.06)', padding: '15px 17px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#16202e', marginBottom: '13px' }}>Compliance Mix</div>
          <div style={{ display: 'flex', height: '22px', borderRadius: '7px', overflow: 'hidden', marginBottom: '12px' }}>
            {d.mix.map(m => (
              <div key={m.label} title={m.label} style={{ width: m.pct + '%', background: m.color }}></div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {d.mix.map(m => (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#3c4858' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: m.color }}></span>
                {m.label} <b style={{ fontFamily: MONO }}>{m.pct}%</b>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: '12px', boxShadow: '0 1px 2px rgba(20,32,46,.06)', padding: '15px 17px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#16202e', marginBottom: '13px' }}>Breaches by Month</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '110px' }}>
            {d.breachByMonth.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', height: '100%', justifyContent: 'flex-end' }}>
                <div title={String(b.val)} style={{ width: '100%', background: 'linear-gradient(180deg,#e8607a,#d23a52)', borderRadius: '3px 3px 0 0', height: b.h + '%', minHeight: '2px' }}></div>
                <span style={{ fontSize: '8.5px', color: '#9aa6b4' }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #dde3ec', borderRadius: '12px', boxShadow: '0 1px 2px rgba(20,32,46,.06)', overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #e8edf3' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#16202e' }}>Department × Quarter Heatmap</div>
          <div style={{ fontSize: '11.5px', color: '#6c7a8c' }}>breaches per quarter — green clean · red breach · grey not reported</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12.5px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...thBase, textAlign: 'left', padding: '9px 16px', textTransform: 'uppercase', letterSpacing: '.3px' }}>Department</th>
                <th style={{ ...thBase, textAlign: 'center' }}>Q1</th>
                <th style={{ ...thBase, textAlign: 'center' }}>Q2</th>
                <th style={{ ...thBase, textAlign: 'center' }}>Q3</th>
                <th style={{ ...thBase, textAlign: 'center' }}>Q4</th>
                <th style={{ ...thBase, textAlign: 'center', padding: '9px 12px' }}>Status</th>
                <th style={{ ...thBase, textAlign: 'right', padding: '9px 16px' }}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {d.heatRows.map((r, ri) => (
                <tr key={ri} style={{ borderBottom: '1px solid #eef1f5' }}>
                  <td style={{ padding: '8px 16px', textAlign: 'left' }}>
                    <b style={{ color: '#16202e' }}>{r.name}</b> <span style={{ color: '#9aa6b4', fontSize: '11px' }}>· {r.count}</span>
                  </td>
                  {r.cells.map((c, ci) => (
                    <td key={ci} style={{ textAlign: 'center', padding: '6px 8px' }}>
                      <span style={{ display: 'inline-grid', placeItems: 'center', minWidth: '28px', height: '24px', borderRadius: '6px', background: c.bg, color: c.fg, fontWeight: 700, fontSize: '11.5px', fontFamily: MONO }}>{c.sym}</span>
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: r.statusColor, background: r.statusBg, padding: '2px 9px', borderRadius: '20px', whiteSpace: 'nowrap' }}>{r.status}</span>
                  </td>
                  <td style={{ textAlign: 'right', padding: '8px 16px', fontFamily: MONO, fontWeight: 600, color: '#16202e' }}>{r.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===== part: mod-scorecard.jsx ===== */
function QCScorecard({depts}){
  const rows = useMemo(()=>{
    return (depts||[]).map(d=>{
      const st = deptStat(d);
      const inds = d.indicators || [];
      const withData = inds.filter(i=>hasData(i)).length;
      const breaches = inds.reduce((a,i)=>a+countBreaches(i),0);
      const rep = st.ok + st.breach;
      const brRate = rep ? st.breach/rep : 0;
      const status = d.status || (st.breach===0 ? 'Excellent' : brRate>0.16 ? 'Needs Improvement' : brRate>0.06 ? 'Good' : 'Very Good');
      const sc = statusColorFor(status);
      return {
        key: d.key,
        name: d.name,
        total: inds.length,
        withData,
        breaches,
        breachColor: breaches>0 ? P.rose : P.ink2,
        rate: st.rate,
        status,
        statusColor: sc,
        statusBg: sc+'1c',
        barColor: st.rate>=95 ? P.green : st.rate>=85 ? P.teal : st.rate>=70 ? P.amber : P.rose
      };
    }).sort((a,b)=>b.rate-a.rate);
  }, [depts]);

  const th = { padding:'10px 12px', fontSize:'10.5px', textTransform:'uppercase', letterSpacing:'.3px', color:P.muted, fontWeight:700, borderBottom:'1px solid '+P.line, background:P.panel2 };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:'13px',marginBottom:'16px'}}>
        <div style={{width:'40px',height:'40px',borderRadius:'11px',background:'#efeaff',color:P.violet,display:'grid',placeItems:'center',flexShrink:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5"></path></svg>
        </div>
        <div>
          <h1 style={{margin:0,fontSize:'21px',fontWeight:700,color:P.ink,letterSpacing:'-.3px'}}>Department Scorecard</h1>
          <div style={{fontSize:'12.5px',color:P.muted,marginTop:'2px'}}>Zero-defect performance by department, ranked best to worst</div>
        </div>
      </div>
      <div style={{background:'#fff',border:'1px solid '+P.line,borderRadius:'12px',boxShadow:'0 1px 2px rgba(20,32,46,.06)',overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',fontSize:'12.5px',width:'100%'}}>
            <thead>
              <tr>
                <th style={{...th, textAlign:'left', padding:'10px 16px'}}>Department</th>
                <th style={{...th, textAlign:'right'}}>Indicators</th>
                <th style={{...th, textAlign:'right'}}>With data</th>
                <th style={{...th, textAlign:'right'}}>Breaches</th>
                <th style={{...th, textAlign:'left', width:'200px'}}>Zero-defect rate</th>
                <th style={{...th, textAlign:'center', padding:'10px 16px'}}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.key} style={{borderBottom:'1px solid '+P.line2}}>
                  <td style={{padding:'10px 16px',textAlign:'left',fontWeight:600,color:P.ink}}>{r.name}</td>
                  <td style={{padding:'10px 12px',textAlign:'right',fontFamily:MONO,color:P.ink2}}>{r.total}</td>
                  <td style={{padding:'10px 12px',textAlign:'right',fontFamily:MONO,color:P.ink2}}>{r.withData}</td>
                  <td style={{padding:'10px 12px',textAlign:'right',fontFamily:MONO,fontWeight:600,color:r.breachColor}}>{r.breaches}</td>
                  <td style={{padding:'10px 12px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <div style={{flex:1,height:'8px',background:P.line2,borderRadius:'5px',overflow:'hidden'}}>
                        <div style={{height:'100%',width:r.rate+'%',background:r.barColor,borderRadius:'5px'}}></div>
                      </div>
                      <span style={{fontFamily:MONO,fontWeight:600,color:P.ink,fontSize:'11.5px',width:'38px',textAlign:'right'}}>{r.rate}%</span>
                    </div>
                  </td>
                  <td style={{padding:'10px 16px',textAlign:'center'}}>
                    <span style={{fontSize:'10.5px',fontWeight:600,color:r.statusColor,background:r.statusBg,padding:'2px 9px',borderRadius:'20px',whiteSpace:'nowrap'}}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===== part: mod-trends.jsx ===== */
function QCTrends({depts}) {
  const [dept, setDept] = useState(depts[0] && depts[0].key);
  const [indId, setIndId] = useState('');

  const td = useMemo(() => depts.find(x => x.key === dept) || depts[0], [depts, dept]);
  const tInds = (td && td.indicators) || [];
  let tIndId = indId;
  if (!tInds.some(i => i.id === tIndId)) tIndId = tInds[0] && tInds[0].id;
  const tInd = tInds.find(i => i.id === tIndId);

  const model = useMemo(() => {
    if (!tInd) return null;
    const vals = MONTHS.map(m => {
      const v = monthRaw(tInd, m[0]);
      return { label: m[1].split(' ')[0], year: m[1].split(' ')[1], v, s: monthStatus(tInd, m[0]) };
    });
    const nums = vals.map(x => x.v).filter(v => v != null);
    const maxV = Math.max(tInd.benchmarkValue != null ? tInd.benchmarkValue : 0, ...(nums.length ? nums : [1]), 1);
    const bars = vals.map(x => ({
      label: x.label,
      year: x.year,
      disp: x.v == null ? '—' : fmtVal(tInd, x.v),
      h: x.v == null ? 0 : Math.max(2, Math.round(x.v / maxV * 100)),
      color: x.s === 'breach' ? P.rose : x.s === 'ok' ? P.green : '#c4ccd6'
    }));
    const avg = nums.length ? (Math.round(nums.reduce((a, b) => a + b, 0) / nums.length * 100) / 100) : '—';
    return {
      name: tInd.name,
      unit: tInd.unit,
      formula: formulaText(tInd),
      bench: benchExpr(tInd),
      avg: avg === '—' ? '—' : fmtVal(tInd, avg),
      breaches: vals.filter(x => x.s === 'breach').length,
      reported: nums.length,
      bars
    };
  }, [tInd]);

  const selStyle = { padding: '8px 11px', border: '1px solid ' + P.line, borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: '#fff', color: P.ink, outline: 'none' };
  const statLabel = { fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', color: P.faint, fontWeight: 700 };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: '#e7f6ed', color: P.green, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8M21 7v5h-5"></path></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: P.ink, letterSpacing: '-.3px' }}>Trends</h1>
          <div style={{ fontSize: 12.5, color: P.muted, marginTop: 2 }}>12-month trend for a single indicator, against its benchmark</div>
        </div>
        <select value={dept || ''} onChange={e => { setDept(e.target.value); setIndId(''); }} style={selStyle}>
          {depts.map(d => <option key={d.key} value={d.key}>{d.name}</option>)}
        </select>
        <select value={tIndId || ''} onChange={e => setIndId(e.target.value)} style={{ ...selStyle, fontWeight: 400, maxWidth: 280 }}>
          {tInds.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>

      {model && (
        <div style={{ background: '#fff', border: '1px solid ' + P.line, borderRadius: 12, boxShadow: '0 1px 2px rgba(20,32,46,.06)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: P.ink }}>{model.name}</span>
            <span style={{ fontSize: 11.5, color: P.faint }}>{model.unit}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: P.blue700, marginBottom: 16 }}>ƒ {model.formula}</div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 18 }}>
            <div><div style={statLabel}>Benchmark</div><div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: P.blue700 }}>{model.bench}</div></div>
            <div><div style={statLabel}>Avg</div><div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: P.ink }}>{model.avg}</div></div>
            <div><div style={statLabel}>Breaches</div><div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: P.rose }}>{model.breaches}</div></div>
            <div><div style={statLabel}>Months reported</div><div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: P.ink }}>{model.reported}</div></div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 200, borderBottom: '1px solid ' + P.line2, paddingBottom: 0 }}>
            {model.bars.map((b, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 9, fontFamily: MONO, color: P.muted }}>{b.disp}</span>
                <div title={b.disp} style={{ width: '100%', maxWidth: 34, background: b.color, borderRadius: '4px 4px 0 0', height: b.h + '%', minHeight: 2 }}></div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
            {model.bars.map((b, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 9, color: P.faint }}>{b.label}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== part: mod-reports.jsx ===== */
function QCReports({depts}){
  const [dept,setDept]=useState(depts[0]&&depts[0].key);
  const rd = useMemo(()=> depts.find(d=>d.key===dept) || depts[0] || null, [depts,dept]);
  const st = useMemo(()=> rd ? deptStat(rd) : {ok:0,breach:0,na:0,rate:100}, [rd]);
  const inds = (rd && rd.indicators) || [];
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{width:40,height:40,borderRadius:11,background:'#eef8fc',color:'#0090ca',display:'grid',placeItems:'center',flexShrink:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7"></path></svg>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{margin:0,fontSize:21,fontWeight:700,color:P.ink,letterSpacing:'-.3px'}}>Monthly Quality Report</h1>
          <div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Full month-wise indicator report · FY 2025–26</div>
        </div>
        <select value={dept||''} onChange={e=>setDept(e.target.value)} style={{padding:'8px 11px',border:'1px solid '+P.line,borderRadius:8,fontSize:12.5,fontWeight:600,background:'#fff',color:P.ink,outline:'none'}}>
          {depts.map(o=> <option key={o.key} value={o.key}>{o.name}</option>)}
        </select>
      </div>
      <div style={{background:'#fff',border:'1px solid '+P.line,borderRadius:12,boxShadow:'0 1px 2px rgba(20,32,46,.06)',overflow:'hidden'}}>
        <div style={{padding:'14px 18px',borderBottom:'1px solid '+P.line2,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',background:'linear-gradient(150deg,#ffffff,#f5fafd)'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:700,color:P.ink}}>UNICO Hospitals — {rd?rd.name:''}</div>
            <div style={{fontSize:11.5,color:P.muted}}>Quality Indicator Report · FY 2025–26 · Jun 2025 – May 2026</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:MONO,fontSize:18,fontWeight:700,color:P.green}}>{st.rate}%</div>
            <div style={{fontSize:10,color:P.faint,textTransform:'uppercase',letterSpacing:'.4px'}}>zero-defect</div>
          </div>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:MONO,fontSize:18,fontWeight:700,color:P.rose}}>{st.breach}</div>
            <div style={{fontSize:10,color:P.faint,textTransform:'uppercase',letterSpacing:'.4px'}}>breaches</div>
          </div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',fontSize:11,width:'100%',minWidth:920}}>
            <thead>
              <tr style={{background:P.panel2}}>
                <th style={{textAlign:'left',padding:'8px 10px',fontSize:10,textTransform:'uppercase',letterSpacing:'.2px',color:P.muted,fontWeight:700,borderBottom:'1px solid '+P.line,position:'sticky',left:0,background:P.panel2,minWidth:190}}>Indicator</th>
                <th style={{textAlign:'left',padding:'8px 8px',fontSize:9.5,color:P.muted,fontWeight:700,borderBottom:'1px solid '+P.line,background:P.panel2,width:96}}>Benchmark</th>
                {MONTHS.map(m=> <th key={m[0]} style={{textAlign:'center',padding:'8px 4px',fontSize:9,color:P.muted,fontWeight:700,borderBottom:'1px solid '+P.line,background:P.panel2}}>{m[1].split(' ')[0]}</th>)}
              </tr>
            </thead>
            <tbody>
              {inds.map(ind=>(
                <tr key={ind.id} style={{borderBottom:'1px solid '+P.line2}}>
                  <td style={{padding:'7px 10px',textAlign:'left',fontWeight:600,color:P.ink,position:'sticky',left:0,background:'#fff'}}>{ind.name} <span style={{color:P.faint,fontWeight:400}}>{ind.goalDirection==='higher_is_better'?'↑':'↓'}</span></td>
                  <td style={{padding:'7px 8px',textAlign:'left',fontFamily:MONO,fontSize:10,color:P.ink2}}>{benchExpr(ind)}</td>
                  {MONTHS.map(m=>{
                    const v=monthRaw(ind,m[0]); const s=monthStatus(ind,m[0]);
                    const col= s==='breach'?P.rose : s==='ok'?P.green : P.faint;
                    const bg= s==='breach'?'#fbe9ec' : s==='ok'?'#e7f6ed' : '#f4f6f9';
                    const disp = s==='na' ? '·' : fmtVal(ind,v);
                    return (
                      <td key={m[0]} style={{textAlign:'center',padding:'4px 3px'}}>
                        <span style={{display:'inline-block',minWidth:30,padding:'3px 4px',borderRadius:5,background:bg,color:col,fontFamily:MONO,fontWeight:600,fontSize:10}}>{disp}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===== part: mod-incidents.jsx ===== */
function QCIncidents({depts}){
  const [dept,setDept]=useState('all');

  const list=useMemo(()=>{
    const out=[];
    (depts||[]).forEach(d=>{
      if(dept!=='all' && d.key!==dept) return;
      (d.indicators||[]).forEach(ind=>{
        MONTHS.forEach(m=>{
          if(monthStatus(ind,m[0])==='breach'){
            out.push({
              dept:d.name,
              deptKey:d.key,
              ind:ind.name,
              cat:ind.category,
              month:m[1],
              value:fmtVal(ind,monthRaw(ind,m[0])),
              bench:benchExpr(ind)
            });
          }
        });
      });
    });
    return out;
  },[depts,dept]);

  const rows=list.slice(0,150);
  const empty=list.length===0;
  const options=[{key:'all',label:'All departments'}].concat((depts||[]).map(d=>({key:d.key,label:d.name})));

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{width:40,height:40,borderRadius:11,background:'#fbe9ec',color:P.rose,display:'grid',placeItems:'center',flexShrink:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2 6 4-14 2 8h6"></path></svg>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{margin:0,fontSize:21,fontWeight:700,color:P.ink,letterSpacing:'-.3px'}}>Incident Reports</h1>
          <div style={{fontSize:12.5,color:P.muted,marginTop:2}}><b style={{color:P.rose}}>{list.length}</b> benchmark breaches flagged this year — each needs review</div>
        </div>
        <select value={dept} onChange={e=>setDept(e.target.value)} style={{padding:'8px 11px',border:'1px solid '+P.line,borderRadius:8,fontSize:12.5,fontWeight:600,background:'#fff',color:P.ink,outline:'none'}}>
          {options.map(o=>(<option key={o.key} value={o.key}>{o.label}</option>))}
        </select>
      </div>

      {empty && (
        <div style={{background:'#fff',border:'1px solid '+P.line,borderRadius:12,padding:50,textAlign:'center',color:P.green,fontWeight:600}}>✓ No breaches in scope — all reported indicators on benchmark.</div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:9}}>
        {rows.map((x,i)=>(
          <div key={x.deptKey+'|'+x.ind+'|'+x.month+'|'+i} style={{background:'#fff',border:'1px solid '+P.line,borderLeft:'3px solid '+P.rose,borderRadius:10,boxShadow:'0 1px 2px rgba(20,32,46,.05)',padding:'12px 15px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
            <div style={{width:34,height:34,borderRadius:9,background:'#fbe9ec',color:P.rose,display:'grid',placeItems:'center',flexShrink:0}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path></svg>
            </div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:P.ink}}>{x.ind}</div>
              <div style={{fontSize:11,color:P.faint}}>{x.dept} · {x.cat}</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10,color:P.faint,textTransform:'uppercase',letterSpacing:'.3px'}}>Month</div>
              <div style={{fontSize:12,fontWeight:600,color:P.ink2}}>{x.month}</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10,color:P.faint,textTransform:'uppercase',letterSpacing:'.3px'}}>Value</div>
              <div style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:P.rose}}>{x.value}</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10,color:P.faint,textTransform:'uppercase',letterSpacing:'.3px'}}>Benchmark</div>
              <div style={{fontFamily:MONO,fontSize:12,fontWeight:600,color:P.blue700}}>{x.bench}</div>
            </div>
            <span style={{fontSize:10.5,fontWeight:600,color:P.rose,background:'#fbe9ec',padding:'3px 10px',borderRadius:20}}>Breach</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== part: mod-actionplans.jsx ===== */
function QCActionPlans({depts}){
  const [capa,setCapa]=useState(()=>{try{return JSON.parse(localStorage.getItem('unico_capa_v1'))||{}}catch(e){return{}}});
  useEffect(()=>{try{localStorage.setItem('unico_capa_v1',JSON.stringify(capa))}catch(e){}},[capa]);

  const plans=useMemo(()=>{
    const out=[];
    (depts||[]).forEach(d=>(d.indicators||[]).forEach(ind=>{
      // find the last reported quarter (has a non-null value) and its breach state
      let lastQ=null;
      QORDER.forEach(Q=>{ if(qtrRaw(ind,Q)!=null) lastQ=Q; });
      const lastBreach = lastQ!=null && qtrStatus(ind,lastQ)==='breach';
      const nBreach = countBreaches(ind);
      if(!(lastBreach || nBreach>=3)) return; // only current / persistent breaches get a plan
      const key=d.key+'/'+ind.id;
      out.push({
        key, dept:d.name, ind:ind.name, cat:ind.category||catOf(ind.name),
        breaches:nBreach, bench:benchExpr(ind), status:capa[key]||'Open'
      });
    }));
    return out;
  },[depts,capa]);

  const cycle=(key,status)=>{
    const order=['Open','In Progress','Closed'];
    const next=order[(order.indexOf(status)+1)%3];
    setCapa(c=>Object.assign({},c,{[key]:next}));
  };

  const capaOpen=plans.filter(p=>p.status==='Open').length;
  const capaProgress=plans.filter(p=>p.status==='In Progress').length;
  const capaClosed=plans.filter(p=>p.status==='Closed').length;

  const kpi=(label,value,color)=>(
    <div key={label} style={{background:'#fff',border:'1px solid '+P.line,borderLeft:'4px solid '+color,borderRadius:11,padding:'13px 16px'}}>
      <div style={{fontSize:11.5,fontWeight:700,color:P.ink2,textTransform:'uppercase',letterSpacing:'.3px'}}>{label}</div>
      <div style={{fontFamily:MONO,fontSize:25,fontWeight:600,color:color,marginTop:6}}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:16}}>
        <div style={{width:40,height:40,borderRadius:11,background:'#e7f6ed',color:P.green,display:'grid',placeItems:'center',flexShrink:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12l5 5L20 6"></path></svg>
        </div>
        <div>
          <h1 style={{margin:0,fontSize:21,fontWeight:700,color:P.ink,letterSpacing:'-.3px'}}>Action Plans (CAPA)</h1>
          <div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Corrective &amp; preventive actions for breached indicators — click status to advance</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:13,marginBottom:16}}>
        {kpi('Total plans',plans.length,P.violet)}
        {kpi('Open',capaOpen,P.rose)}
        {kpi('In progress',capaProgress,P.amber)}
        {kpi('Closed',capaClosed,P.green)}
      </div>

      {plans.length===0 && (
        <div style={{background:'#fff',border:'1px solid '+P.line,borderRadius:12,padding:50,textAlign:'center',color:P.green,fontWeight:600}}>✓ No open action plans — no indicators in breach.</div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:9}}>
        {plans.map(p=>{
          const statusColor = p.status==='Closed'?P.green : p.status==='In Progress'?P.amber : P.rose;
          const statusBg = statusColor+'1c';
          return (
            <div key={p.key} style={{background:'#fff',border:'1px solid '+P.line,borderRadius:10,boxShadow:'0 1px 2px rgba(20,32,46,.05)',padding:'12px 15px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:P.ink}}>{p.ind}</div>
                <div style={{fontSize:11,color:P.faint}}>{p.dept} · {p.cat}</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:10,color:P.faint,textTransform:'uppercase',letterSpacing:'.3px'}}>Breaches</div>
                <div style={{fontFamily:MONO,fontSize:14,fontWeight:700,color:P.rose}}>{p.breaches}</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:10,color:P.faint,textTransform:'uppercase',letterSpacing:'.3px'}}>Benchmark</div>
                <div style={{fontFamily:MONO,fontSize:12,fontWeight:600,color:P.blue700}}>{p.bench}</div>
              </div>
              <button onClick={()=>cycle(p.key,p.status)} title="Click to advance status" style={{border:'1px solid '+statusColor,background:statusBg,color:statusColor,padding:'6px 13px',borderRadius:20,fontSize:11.5,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>{p.status}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===== part: mod-admin.jsx ===== */
function QCAdmin({Q,q,onQ,initialDept}){
  const depts = (Q.depts||[]).filter(d=>(d.indicators||[]).length);

  const [view,setView]=useState('manage');            // manage | assign | catalog
  const [tab,setTab]=useState('identity');
  const [sel,setSel]=useState(()=> initialDept? {deptKey:initialDept,id:null} : {deptKey:null,id:null});
  const [scope,setScope]=useState('all');
  const [mf,setMf]=useState('all');                   // measure filter: all|Count|Rate|Percentage
  const [sf,setSf]=useState('all');                   // status filter: all|data|breach
  const [copyOpen,setCopyOpen]=useState(false);
  const [copyT,setCopyT]=useState({});
  const [expand,setExpand]=useState('');

  const CATS = ['Healthcare-Associated Infection','Infection Prevention','Patient Safety','Clinical Outcomes','Staff Safety','Staff Competency','Activity / Volume','Medication Safety'];
  const FREQ = ['Monthly','Quarterly','Annually','Bi-annually'];
  const FORMULAS = [['direct','Direct value — enter the number as-is'],['count','Count — a running tally (numerator only)'],['rate1000','Rate per 1000 — numerator ÷ denominator × 1000'],['rate100','Rate per 100 — numerator ÷ denominator × 100'],['pct','Percentage — numerator ÷ denominator × 100']];
  const DIRS = [['lower_is_better','↓ Lower is better'],['higher_is_better','↑ Higher is better']];
  const FORMULA_HINT = {
    direct:'The value is entered directly each month; no numerator/denominator needed.',
    count:'A simple count (e.g. number of events). Only the numerator is captured.',
    rate1000:'A rate expressed per 1000 denominator-units (e.g. per 1000 device-days).',
    rate100:'A rate expressed per 100 denominator-units.',
    pct:'A percentage of the denominator (numerator ÷ denominator × 100).'
  };

  const findInd = (dk,id)=>{ const d=(Q.depts||[]).find(x=>x.key===dk); return d? (d.indicators||[]).find(x=>x.id===id) : null; };

  // ---- totals ----
  let totalInd=0, withData=0, totalBreach=0; const uniq=new Set();
  depts.forEach(d=>{ (d.indicators||[]).forEach(i=>{ totalInd++; uniq.add(norm(i.name)); if(hasData(i)) withData++; totalBreach+=countBreaches(i); }); });

  // ---- shared-name map ----
  const nameDepts={};
  depts.forEach(d=>(d.indicators||[]).forEach(i=>{ const k=norm(i.name); (nameDepts[k]=nameDepts[k]||new Set()).add(d.key); }));

  // ---- department status label (for the master group pills) ----
  const deptStatus = (d)=>{ const r=deptStat(d).rate; return r>=95?'Excellent':r>=85?'Very Good':r>=70?'Good':r>=55?'Fair':r>=40?'Needs Improvement':'Poor'; };

  // ---- new indicator ----
  const onNew = ()=>{
    const dk = (scope!=='all' ? scope : (depts[0] && depts[0].key)) || (Q.depts[0] && Q.depts[0].key);
    if(!dk) return;
    const blank = blankIndicator('New Indicator');
    Q.addIndicator(dk, blank);
    setSel({deptKey:dk,id:blank.id}); setView('manage'); setTab('identity'); setCopyOpen(false); setCopyT({});
  };

  // ---- filters ----
  const ql=(q||'').trim().toLowerCase();
  const matchInd = (i)=>{
    if(mf!=='all' && measureOf(i.formula).name!==mf) return false;
    if(sf==='data' && !hasData(i)) return false;
    if(sf==='breach' && countBreaches(i)===0) return false;
    if(!ql) return true;
    return (i.name||'').toLowerCase().includes(ql)||(i.category||'').toLowerCase().includes(ql)||(i.reference||'').toLowerCase().includes(ql)||(i.unit||'').toLowerCase().includes(ql);
  };
  const scopeDepts = scope==='all' ? depts : depts.filter(d=>d.key===scope);

  const heatOf = (ind)=> QORDER.map(Qn=>{ const s=qtrStatus(ind,Qn); const [bg,fg,sym]=STATUS_CELL[s]; const v=qtrRaw(ind,Qn); return { bg,fg,sym, title: Qn+': '+(v==null?'not reported':v)+(s==='breach'?' · breach':s==='ok'?' · on benchmark':'') }; });

  let shownCount=0; const groups=[];
  scopeDepts.forEach(d=>{
    const items=(d.indicators||[]).filter(matchInd).map(i=>{
      const meas=measureOf(i.formula); const hd=hasData(i); const br=countBreaches(i);
      const shareN=(nameDepts[norm(i.name)]||new Set()).size;
      const on = sel.deptKey===d.key && sel.id===i.id;
      shownCount++;
      return {
        id:i.id, name:i.name, sub:(i.unit||meas.name)+' · '+(i.category||'—'),
        measure:meas.name, measureLetter:meas.letter, measureColor:meas.color, measureBg:meas.color+'1c',
        dotColor: br>0?P.rose:(hd?P.blue:'#cdd6e2'), dotTitle: br>0?(br+' breach'):(hd?'has data':'no data yet'),
        hasBreach: br>0, breachCount:br,
        isShared: shareN>=2, sharedCount:shareN,
        heat: heatOf(i), bg: on?'#eef8fc':'#fff', bar: on?P.blue:'transparent',
        onClick: ()=>{ setSel({deptKey:d.key,id:i.id}); setCopyOpen(false); setCopyT({}); }
      };
    });
    if(items.length===0 && scope==='all') return;
    const st=deptStatus(d);
    groups.push({ deptKey:d.key, deptName:d.name, count:items.length, statusColor:statusColorFor(st), statusBg:statusColorFor(st)+'1c', statusLabel:st, items });
  });

  const chip=(active,label,onClick)=>({ label,onClick, bg: active?P.blue:'#fff', color: active?'#fff':P.ink2, border: active?P.blue:'#dde3ec' });
  const measureChips=[ chip(mf==='all','All',()=>setMf('all')), chip(mf==='Count','Count',()=>setMf('Count')), chip(mf==='Rate','Rate',()=>setMf('Rate')), chip(mf==='Percentage','%',()=>setMf('Percentage')) ];
  const statusChips=[ chip(sf==='all','All',()=>setSf('all')), chip(sf==='data','Has data',()=>setSf('data')), chip(sf==='breach','Breaches',()=>setSf('breach')) ];

  const scopeOptions=[{key:'all',label:'All departments'}].concat(depts.map(d=>({key:d.key,label:d.name+' · '+(d.indicators||[]).length})));

  // ---- selected indicator (live from store) ----
  const selInd = sel.deptKey && sel.id ? findInd(sel.deptKey,sel.id) : null;
  const selDept = selInd ? (Q.depts||[]).find(d=>d.key===sel.deptKey) : null;

  // ---- edit helpers (ALL through Q) ----
  const patch = (obj)=>{ if(sel.deptKey&&sel.id) Q.patchIndicator(sel.deptKey,sel.id,obj); };
  const patchField = (f)=> (e)=> patch({[f]:e.target.value});
  const patchMonthVal = (idx)=> (e)=>{ const v=e.target.value; patch({ months:{ [MONTHS[idx][0]]: (v===''?null:Number(v)) } }); };
  const patchMonthNum = (idx)=> (e)=>{ const v=e.target.value; patch({ mNum:{ [MONTHS[idx][0]]: (v===''?null:Number(v)) } }); };
  const patchMonthDen = (idx)=> (e)=>{ const v=e.target.value; patch({ mDen:{ [MONTHS[idx][0]]: (v===''?null:Number(v)) } }); };
  const patchMonthRemark = (idx)=> (e)=> patch({ monthRemarks:{ [MONTHS[idx][0]]: e.target.value } });

  const onClone = ()=>{ if(!selInd) return; const copy=Object.assign({},selInd,{ id:window.qualitySlug(selInd.name+' copy'), name:selInd.name+' (copy)' }); Q.addIndicator(sel.deptKey,copy); setSel({deptKey:sel.deptKey,id:copy.id}); };
  const onDelete = ()=>{ if(!selInd) return; Q.removeIndicator(sel.deptKey,sel.id); setSel({deptKey:null,id:null}); setCopyOpen(false); setCopyT({}); };
  const onMove = (e)=>{ const nd=e.target.value; if(!selInd||nd===sel.deptKey) return; const moved=Object.assign({},selInd); Q.addIndicator(nd,moved); Q.removeIndicator(sel.deptKey,sel.id); setSel({deptKey:nd,id:moved.id}); };
  const onDoCopy = ()=>{ if(!selInd) return; Object.keys(copyT).forEach(dk=>{ if(copyT[dk]){ const c=Object.assign({},selInd,{ id:window.qualitySlug(selInd.name) }); Q.addIndicator(dk,c); } }); setCopyOpen(false); setCopyT({}); };

  const meas = selInd? measureOf(selInd.formula) : null;
  const dirHigh = selInd && selInd.goalDirection==='higher_is_better';
  const benchSet = selInd && selInd.benchmarkValue!=null && selInd.benchmarkValue!=='';
  const needsNum = selInd && selInd.formula!=='direct';
  const needsDen = selInd && (selInd.formula==='rate1000'||selInd.formula==='rate100'||selInd.formula==='pct');

  // ---- assign matrix ----
  const assignCols = depts.map(d=>({key:d.key, short:(d.name||'').replace(/Ward|Department/g,'').trim().slice(0,8), name:d.name}));
  const byName={};
  depts.forEach(d=>(d.indicators||[]).forEach(i=>{ const k=norm(i.name); if(!byName[k]) byName[k]={key:k,name:i.name,formula:i.formula,tmpl:i,set:new Set()}; byName[k].set.add(d.key); }));
  const assignNames = Object.values(byName).sort((a,b)=> b.set.size-a.set.size || a.name.localeCompare(b.name));
  const toggleAssign = (rec,dk)=>{
    if(rec.set.has(dk)){
      const d=(Q.depts||[]).find(x=>x.key===dk); const inst=d&&(d.indicators||[]).find(x=>norm(x.name)===rec.key); if(inst) Q.removeIndicator(dk,inst.id);
    } else {
      const c=Object.assign({},rec.tmpl,{ id:window.qualitySlug(rec.tmpl.name) }); Q.addIndicator(dk,c);
    }
  };

  // ---- catalog / formula library ----
  const STD = (typeof HQI_STANDARDS!=='undefined' && HQI_STANDARDS) || [];
  const useCount={};
  depts.forEach(d=>(d.indicators||[]).forEach(i=>{ const c=stdMatch(i.name); if(c){ (useCount[c]=useCount[c]||new Set()).add(d.key); } }));
  const ql2=(q||'').trim().toLowerCase();
  const catGroups={};
  STD.forEach(s=>{ if(ql2 && !((s.name||'').toLowerCase().includes(ql2)||(s.expr||'').toLowerCase().includes(ql2)||(s.ref||'').toLowerCase().includes(ql2)||(s.code||'').toLowerCase()===ql2)) return; (catGroups[s.sec]=catGroups[s.sec]||[]).push(s); });
  const measTypeC = f=>({pct:'%',rate1000:'Rate',rate100:'Rate',count:'Count',direct:'Count'}[f]||'Count');
  const measColC = f=> f==='pct'?P.teal : (f==='rate1000'||f==='rate100')?P.violet : P.blue;
  const libSections = Object.keys(catGroups).sort().map(sec=>({ sec, name:(typeof HQI_SECN!=='undefined'&&HQI_SECN[sec])||sec, count:catGroups[sec].length, rows:catGroups[sec] }));

  const subnav=[
    { id:'manage', label:'Manage Indicators', count:totalInd, d:'M4 20h4l11-11-4-4L4 16zM14 5l4 4' },
    { id:'assign', label:'Assign by Department', count:depts.length, d:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
    { id:'catalog', label:'Formula Library', count:STD.length, d:'M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7' }
  ];
  const kpis=[
    { label:'Departments', val:String(depts.length), foot:'reporting quality KPIs', color:P.blue },
    { label:'Indicators', val:String(uniq.size), foot:uniq.size+' unique · '+totalInd+' across departments', color:P.violet },
    { label:'With data', val:String(withData), foot:'hold ≥ 1 saved value', color:P.green },
    { label:'Breaches', val:String(totalBreach), foot:'indicator-months off benchmark', color: totalBreach>0?P.rose:P.green }
  ];

  return (
    <div>
      {/* page header */}
      <div style={{display:'flex',alignItems:'flex-start',gap:14,flexWrap:'wrap',marginBottom:16}}>
        <div style={{width:40,height:40,borderRadius:11,background:'#eef8fc',color:'#0090ca',display:'grid',placeItems:'center',flexShrink:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4l11-11-4-4L4 16zM14 5l4 4"></path></svg>
        </div>
        <div style={{minWidth:0,flex:1}}>
          <h1 style={{margin:0,fontSize:21,fontWeight:700,color:P.ink,letterSpacing:'-.3px'}}>Indicator Administration</h1>
          <div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Define, organise &amp; assign every quality indicator across the hospital. Changes flow to the Dashboard, Scorecard, Reports &amp; CAPA.</div>
        </div>
        <button onClick={onNew} style={{display:'inline-flex',alignItems:'center',gap:7,border:'1px solid #0090ca',background:'#0090ca',color:'#fff',padding:'9px 15px',borderRadius:8,fontSize:13,fontWeight:600,boxShadow:'0 1px 3px rgba(0,144,202,.4)',cursor:'pointer'}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round"><path d="M12 5v14M5 12h14"></path></svg>New indicator
        </button>
      </div>

      {/* sub-nav */}
      <div style={{display:'flex',gap:4,background:'#fff',border:'1px solid #dde3ec',borderRadius:11,padding:5,marginBottom:16,width:'max-content',maxWidth:'100%',boxShadow:'0 1px 2px rgba(20,32,46,.05)'}}>
        {subnav.map(t=>{ const active=view===t.id; return (
          <button key={t.id} onClick={()=>setView(t.id)} style={{display:'inline-flex',alignItems:'center',gap:8,border:0,padding:'8px 16px',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',color:active?P.blue:P.muted,background:active?'#fff':'transparent',boxShadow:active?'0 1px 3px rgba(20,32,46,.12)':'none'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={t.d}></path></svg>
            <span>{t.label}</span>
            <span style={{fontFamily:MONO,fontSize:11,opacity:.7}}>{t.count}</span>
          </button>
        ); })}
      </div>

      {/* KPI strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:13,marginBottom:18}}>
        {kpis.map(k=>(
          <div key={k.label} style={{background:'#fff',border:'1px solid #dde3ec',borderLeft:'4px solid '+k.color,borderRadius:11,boxShadow:'0 1px 2px rgba(20,32,46,.06)',padding:'14px 17px'}}>
            <div style={{fontSize:11.5,fontWeight:700,color:P.ink2,textTransform:'uppercase',letterSpacing:'.3px'}}>{k.label}</div>
            <div style={{fontFamily:MONO,fontSize:27,fontWeight:600,color:k.color,lineHeight:1,margin:'8px 0 5px',letterSpacing:'-.5px'}}>{k.val}</div>
            <div style={{fontSize:11,color:P.faint}}>{k.foot}</div>
          </div>
        ))}
      </div>

      {/* ============ MANAGE ============ */}
      {view==='manage' && (
      <div>
        {/* filter toolbar */}
        <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:11,boxShadow:'0 1px 2px rgba(20,32,46,.06)',padding:'13px 15px',marginBottom:14,display:'flex',flexDirection:'column',gap:11}}>
          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
            <select value={scope} onChange={e=>setScope(e.target.value)} style={{padding:'8px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:12.5,fontWeight:600,background:'#fff',color:P.ink,minWidth:210,outline:'none'}}>
              {scopeOptions.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <div style={{display:'flex',alignItems:'center',gap:8,background:'#f7f9fc',border:'1px solid #dde3ec',borderRadius:8,padding:'8px 12px',flex:1,minWidth:200,color:P.faint}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M11 4a7 7 0 105 12l4 4M11 4a7 7 0 015 12"></path></svg>
              <input placeholder="Filter this list by name, category or reference…" value={q||''} onInput={e=>onQ(e.target.value)} onChange={e=>onQ(e.target.value)} style={{border:0,background:'transparent',outline:'none',fontSize:12.5,color:P.ink,width:'100%'}}/>
            </div>
            <div style={{fontSize:11.5,color:P.faint,fontFamily:MONO,whiteSpace:'nowrap'}}>{shownCount} shown</div>
          </div>
          <div style={{display:'flex',gap:18,alignItems:'center',flexWrap:'wrap',borderTop:'1px solid #e8edf3',paddingTop:11}}>
            <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
              <span style={{fontSize:10,fontWeight:700,color:P.faint,textTransform:'uppercase',letterSpacing:'.4px',marginRight:1}}>Measure</span>
              {measureChips.map(c=><button key={c.label} onClick={c.onClick} style={{border:'1px solid '+c.border,background:c.bg,color:c.color,padding:'4px 11px',borderRadius:20,fontSize:11.5,fontWeight:600,cursor:'pointer'}}>{c.label}</button>)}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
              <span style={{fontSize:10,fontWeight:700,color:P.faint,textTransform:'uppercase',letterSpacing:'.4px',marginRight:1}}>Status</span>
              {statusChips.map(c=><button key={c.label} onClick={c.onClick} style={{border:'1px solid '+c.border,background:c.bg,color:c.color,padding:'4px 11px',borderRadius:20,fontSize:11.5,fontWeight:600,cursor:'pointer'}}>{c.label}</button>)}
            </div>
          </div>
        </div>

        {/* master / detail */}
        <div style={{display:'grid',gridTemplateColumns:'392px 1fr',gap:16,alignItems:'start'}}>

          {/* MASTER */}
          <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:12,boxShadow:'0 1px 2px rgba(20,32,46,.06)',overflow:'hidden',display:'flex',flexDirection:'column',maxHeight:'calc(100vh - 320px)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'11px 14px',borderBottom:'1px solid #e8edf3',flexShrink:0}}>
              <span style={{fontSize:12.5,fontWeight:700,color:P.ink}}>Indicators</span>
              <span style={{fontSize:11,color:P.faint,fontFamily:MONO}}>{shownCount}</span>
              <span style={{flex:1}}></span>
              <div style={{display:'flex',alignItems:'center',gap:11,fontSize:10,color:P.faint}}>
                <span style={{display:'flex',alignItems:'center',gap:4}}><i style={{width:8,height:8,borderRadius:'50%',background:'#0090ca',display:'inline-block'}}></i>data</span>
                <span style={{display:'flex',alignItems:'center',gap:4}}><i style={{width:8,height:8,borderRadius:2,background:'#d23a52',display:'inline-block'}}></i>breach</span>
              </div>
            </div>
            <div style={{overflowY:'auto',flex:1}}>
              {groups.map(g=>(
                <div key={g.deptKey}>
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 14px',background:'#f7f9fc',borderBottom:'1px solid #e8edf3',borderTop:'1px solid #e8edf3',position:'sticky',top:0,zIndex:2}}>
                    <span style={{width:7,height:7,borderRadius:'50%',background:g.statusColor,flexShrink:0}}></span>
                    <span style={{fontSize:11.5,fontWeight:700,color:P.ink}}>{g.deptName}</span>
                    <span style={{fontSize:10,color:P.faint,fontFamily:MONO}}>{g.count}</span>
                    <span style={{flex:1}}></span>
                    <span style={{fontSize:9.5,fontWeight:700,color:g.statusColor,background:g.statusBg,padding:'1px 7px',borderRadius:10,textTransform:'uppercase',letterSpacing:'.3px'}}>{g.statusLabel}</span>
                  </div>
                  {g.items.map(it=>(
                    <div key={it.id} onClick={it.onClick} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',cursor:'pointer',borderBottom:'1px solid #eef1f5',borderLeft:'3px solid '+it.bar,background:it.bg}}>
                      <span title={it.dotTitle} style={{width:8,height:8,borderRadius:'50%',background:it.dotColor,flexShrink:0}}></span>
                      <div style={{minWidth:0,flex:1}}>
                        <div style={{fontSize:12.5,fontWeight:600,color:P.ink,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.name}</div>
                        <div style={{fontSize:10,color:P.faint,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.sub}</div>
                      </div>
                      {it.isShared && <span title={'reported by '+it.sharedCount+' departments'} style={{flexShrink:0,fontSize:9.5,fontWeight:600,color:'#6a52d4',background:'#efeaff',padding:'1px 6px',borderRadius:6,whiteSpace:'nowrap'}}>↗{it.sharedCount}</span>}
                      <div style={{display:'flex',gap:2,flexShrink:0}}>
                        {it.heat.map((c,ci)=><span key={ci} title={c.title} style={{width:17,height:16,borderRadius:3,display:'grid',placeItems:'center',fontSize:9,fontWeight:700,background:c.bg,color:c.fg}}>{c.sym}</span>)}
                      </div>
                      <span title={it.measure} style={{flexShrink:0,width:19,height:19,borderRadius:6,display:'grid',placeItems:'center',fontSize:10,fontWeight:700,background:it.measureBg,color:it.measureColor}}>{it.measureLetter}</span>
                      {it.hasBreach && <span title={it.breachCount+' month breach(es)'} style={{flexShrink:0,fontSize:10,fontWeight:700,color:'#d23a52',background:'#fbe9ec',padding:'1px 6px',borderRadius:10,fontFamily:MONO}}>{it.breachCount}!</span>}
                    </div>
                  ))}
                </div>
              ))}
              {shownCount===0 && <div style={{padding:'40px 20px',textAlign:'center',color:P.faint,fontSize:12.5}}>No indicators match your filters.</div>}
            </div>
          </div>

          {/* DETAIL */}
          <div style={{minWidth:0}}>
            {!selInd && <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:12,boxShadow:'0 1px 2px rgba(20,32,46,.06)',padding:'60px 30px',textAlign:'center',color:P.faint}}><div style={{fontSize:14,fontWeight:600,color:P.muted}}>Select an indicator to edit</div><div style={{fontSize:12,marginTop:5}}>Pick one from the list, or create a new indicator.</div></div>}

            {selInd && (
            <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:12,boxShadow:'0 1px 2px rgba(20,32,46,.06)',overflow:'hidden'}}>

              {/* detail header */}
              <div style={{padding:'15px 18px',borderBottom:'1px solid #e8edf3',background:'linear-gradient(150deg,#ffffff,#f5fafd)'}}>
                <div style={{display:'flex',alignItems:'center',gap:9,flexWrap:'wrap',marginBottom:11}}>
                  <span style={{fontSize:11,fontWeight:600,color:P.muted}}>{selDept?selDept.name:''}</span>
                  <span style={{color:'#cdd6e2'}}>·</span>
                  <span style={{fontSize:10.5,fontWeight:600,color:meas.color,background:meas.color+'1c',padding:'2px 9px',borderRadius:20}}>{meas.name}</span>
                  <span style={{fontSize:10.5,fontWeight:600,color:dirHigh?P.blue:P.green,background:(dirHigh?P.blue:P.green)+'1c',padding:'2px 9px',borderRadius:20}}>{dirHigh?'↑ higher is better':'↓ lower is better'}</span>
                  <span style={{fontSize:10.5,fontWeight:600,color:benchSet?P.blue700:P.rose,background:benchSet?'#eef8fc':'#fbe9ec',padding:'2px 9px',borderRadius:20}}>{benchExpr(selInd)}</span>
                  {hasData(selInd) && <span style={{fontSize:10.5,fontWeight:600,color:'#0072a3',background:'#eef8fc',padding:'2px 9px',borderRadius:20}}>● has data</span>}
                  <span style={{flex:1}}></span>
                  <button onClick={onClone} style={{display:'inline-flex',alignItems:'center',gap:5,border:'1px solid #dde3ec',background:'#fff',color:P.ink2,padding:'5px 10px',borderRadius:7,fontSize:11.5,fontWeight:600,cursor:'pointer'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"></path></svg>Clone</button>
                  <button onClick={()=>setCopyOpen(!copyOpen)} style={{display:'inline-flex',alignItems:'center',gap:5,border:'1px solid #dde3ec',background:'#fff',color:P.ink2,padding:'5px 10px',borderRadius:7,fontSize:11.5,fontWeight:600,cursor:'pointer'}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5zM2 12l10 5 10-5"></path></svg>Copy to…</button>
                  <button onClick={onDelete} title="Delete indicator" style={{width:30,height:30,borderRadius:7,border:'1px solid #f1c6cd',background:'#fff',display:'grid',placeItems:'center',color:'#d23a52',cursor:'pointer'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg></button>
                </div>
                <input value={selInd.name||''} onInput={patchField('name')} onChange={patchField('name')} placeholder="Indicator name" style={{width:'100%',border:'1px solid transparent',background:'transparent',fontFamily:'inherit',fontSize:19,fontWeight:700,color:P.ink,padding:'3px 6px',marginLeft:-6,borderRadius:7,outline:'none'}}/>
                <div style={{marginTop:9,background:'#eef8fc',border:'1px solid #dceffa',borderRadius:8,padding:'8px 12px',fontFamily:MONO,fontSize:12.5,color:'#0072a3'}}>ƒ&nbsp; {formulaText(selInd)}</div>

                {copyOpen && (
                <div style={{marginTop:11,border:'1px solid #dceffa',borderRadius:9,background:'#eef8fc',padding:'11px 13px'}}>
                  <div style={{fontSize:11.5,fontWeight:600,marginBottom:8,color:P.ink}}>Copy this indicator (with its values) to:</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:6}}>
                    {depts.filter(d=>d.key!==sel.deptKey).map(d=>(
                      <label key={d.key} style={{display:'flex',alignItems:'center',gap:7,fontSize:12,background:'#fff',border:'1px solid #dde3ec',borderRadius:7,padding:'6px 9px',cursor:'pointer'}}>
                        <input type="checkbox" checked={!!copyT[d.key]} onChange={()=>setCopyT(t=>Object.assign({},t,{[d.key]:!t[d.key]}))}/>
                        <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.name}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8,marginTop:9}}>
                    <button onClick={onDoCopy} style={{display:'inline-flex',alignItems:'center',gap:5,border:'1px solid #0090ca',background:'#0090ca',color:'#fff',padding:'6px 12px',borderRadius:7,fontSize:11.5,fontWeight:600,cursor:'pointer'}}>Copy</button>
                    <button onClick={()=>setCopyOpen(false)} style={{border:'1px solid #dde3ec',background:'#fff',color:P.ink2,padding:'6px 12px',borderRadius:7,fontSize:11.5,fontWeight:600,cursor:'pointer'}}>Cancel</button>
                  </div>
                </div>
                )}
              </div>

              {/* tab bar */}
              <div style={{display:'flex',gap:2,padding:'0 14px',borderBottom:'1px solid #e8edf3',background:'#fff',overflowX:'auto'}}>
                {[['identity','Identity'],['measure','Measurement'],['target','Target & Benchmark'],['values','Monthly Values'],['place','Placement']].map(([id,label])=>{ const on=tab===id; return (
                  <button key={id} onClick={()=>setTab(id)} style={{border:0,background:'transparent',padding:'12px 14px 11px',fontSize:12.5,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',color:on?P.blue700:P.muted,borderBottom:'2.5px solid '+(on?P.blue:'transparent')}}>{label}</button>
                ); })}
              </div>

              <div style={{padding:18}}>
                {/* IDENTITY */}
                {tab==='identity' && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div style={{display:'flex',flexDirection:'column',gap:5,gridColumn:'1 / -1'}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Indicator name</label><input value={selInd.name||''} onInput={patchField('name')} onChange={patchField('name')} style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}/></div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Clinical category</label><select value={selInd.category||''} onChange={patchField('category')} style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}>{(CATS.indexOf(selInd.category)<0 && selInd.category ? [selInd.category].concat(CATS) : CATS).map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                  <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Reporting frequency</label><select value={selInd.frequency||'Monthly'} onChange={patchField('frequency')} style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}>{FREQ.map(o=><option key={o} value={o}>{o}</option>)}</select></div>
                  <div style={{display:'flex',flexDirection:'column',gap:5,gridColumn:'1 / -1'}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Reference / standard <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>WHO · CDC NHSN · NABH</span></label><input value={selInd.reference||''} onInput={patchField('reference')} onChange={patchField('reference')} placeholder="e.g. CDC NHSN CAUTI definition" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}/></div>
                  <div style={{display:'flex',flexDirection:'column',gap:5,gridColumn:'1 / -1'}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Overall remark <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>shown on the report</span></label><textarea value={selInd.remarks||''} onInput={patchField('remarks')} onChange={patchField('remarks')} placeholder="optional summary note for this indicator" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:12.5,background:'#fff',outline:'none',minHeight:60,resize:'vertical',lineHeight:1.5}}/></div>
                </div>
                )}

                {/* MEASUREMENT */}
                {tab==='measure' && (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div style={{display:'flex',flexDirection:'column',gap:5,gridColumn:'1 / -1'}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>How is this measured?</label><select value={selInd.formula||'count'} onChange={patchField('formula')} style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}>{FORMULAS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
                  <div style={{gridColumn:'1 / -1',background:'#eef8fc',border:'1px solid #dceffa',borderRadius:8,padding:'11px 13px'}}>
                    <div style={{fontSize:10,color:P.muted,textTransform:'uppercase',letterSpacing:'.4px',fontWeight:700,marginBottom:4}}>Formula used to calculate the value</div>
                    <div style={{fontFamily:MONO,fontSize:13.5,color:'#0072a3',fontWeight:700,wordBreak:'break-word'}}>ƒ&nbsp; {formulaText(selInd)}</div>
                    <div style={{fontSize:10.5,color:P.muted,marginTop:5}}>{FORMULA_HINT[selInd.formula]||''}</div>
                  </div>
                  {needsNum && <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Numerator label</label><input value={selInd.numLabel||''} onInput={patchField('numLabel')} onChange={patchField('numLabel')} placeholder="e.g. CAUTI cases" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}/></div>}
                  {needsDen && <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Denominator label</label><input value={selInd.denLabel||''} onInput={patchField('denLabel')} onChange={patchField('denLabel')} placeholder="e.g. Catheter days" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}/></div>}
                  <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Unit <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>display label</span></label><input value={selInd.unit||''} onInput={patchField('unit')} onChange={patchField('unit')} placeholder="per 1000 cath-days · % · count" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}/></div>
                  {needsNum && <div style={{display:'flex',flexDirection:'column',gap:5,gridColumn:'1 / -1'}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Numerator definition <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>what counts</span></label><textarea value={selInd.numeratorDef||''} onInput={patchField('numeratorDef')} onChange={patchField('numeratorDef')} placeholder="Precise definition of the numerator" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:12.5,background:'#fff',outline:'none',minHeight:54,resize:'vertical',lineHeight:1.5}}/></div>}
                  {needsDen && <div style={{display:'flex',flexDirection:'column',gap:5,gridColumn:'1 / -1'}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Denominator definition <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>what counts</span></label><textarea value={selInd.denominatorDef||''} onInput={patchField('denominatorDef')} onChange={patchField('denominatorDef')} placeholder="Precise definition of the denominator" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:12.5,background:'#fff',outline:'none',minHeight:54,resize:'vertical',lineHeight:1.5}}/></div>}
                </div>
                )}

                {/* TARGET */}
                {tab==='target' && (
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',background:'#f7f9fc',border:'1px solid #e8edf3',borderRadius:9,padding:'10px 13px',marginBottom:14}}>
                    <span style={{fontSize:11,color:P.muted,textTransform:'uppercase',letterSpacing:'.4px',fontWeight:700}}>Benchmark</span>
                    <span style={{fontSize:13,fontWeight:700,color:benchSet?P.blue700:P.rose,background:benchSet?'#eef8fc':'#fbe9ec',padding:'3px 11px',borderRadius:20}}>{benchExpr(selInd)}</span>
                    <span style={{fontSize:11,color:P.muted}}>{dirHigh?'values at or above this are on benchmark':'values at or below this are on benchmark'}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                    <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Goal direction <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>which way is good?</span></label><select value={selInd.goalDirection||'lower_is_better'} onChange={patchField('goalDirection')} style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}>{DIRS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
                    <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Benchmark value <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>drives status</span></label><input type="number" value={selInd.benchmarkValue==null?'':selInd.benchmarkValue} onInput={e=>patch({benchmarkValue: e.target.value===''?null:Number(e.target.value)})} onChange={e=>patch({benchmarkValue: e.target.value===''?null:Number(e.target.value)})} placeholder="e.g. 0 or 90" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,fontFamily:MONO,background:'#fff',outline:'none',textAlign:'right'}}/></div>
                    <div style={{display:'flex',flexDirection:'column',gap:5,gridColumn:'1 / -1'}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Benchmark description <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>free text shown on reports</span></label><input value={selInd.benchmark||''} onInput={patchField('benchmark')} onChange={patchField('benchmark')} placeholder="e.g. 0 (zero defect) · ≥ 90% of moments" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}/></div>
                  </div>
                </div>
                )}

                {/* VALUES */}
                {tab==='values' && (
                <div>
                  <div style={{fontSize:11.5,color:P.muted,marginBottom:11}}>{needsDen ? ('Enter '+(selInd.numLabel||'numerator')+' ÷ '+(selInd.denLabel||'denominator')+' for each month — the value computes from the formula and rolls up into quarters automatically.') : 'Enter each month’s value (Jun 2025 – May 2026). Leave a month blank to mark it not reported; quarters roll up automatically.'}</div>
                  <div style={{overflowX:'auto',border:'1px solid #e8edf3',borderRadius:9}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12.5}}>
                      <thead><tr style={{background:'#f7f9fc'}}>
                        <th style={{textAlign:'left',padding:'9px 12px',fontSize:10.5,textTransform:'uppercase',letterSpacing:'.3px',color:P.muted,fontWeight:700,borderBottom:'1px solid #e8edf3'}}>Month</th>
                        {needsDen && <th style={{textAlign:'right',padding:'9px 12px',fontSize:10.5,textTransform:'uppercase',letterSpacing:'.3px',color:P.muted,fontWeight:700,borderBottom:'1px solid #e8edf3',width:96}}>{selInd.numLabel||'Numerator'}</th>}
                        {needsDen && <th style={{textAlign:'right',padding:'9px 12px',fontSize:10.5,textTransform:'uppercase',letterSpacing:'.3px',color:P.muted,fontWeight:700,borderBottom:'1px solid #e8edf3',width:96}}>{selInd.denLabel||'Denominator'}</th>}
                        <th style={{textAlign:'right',padding:'9px 12px',fontSize:10.5,textTransform:'uppercase',letterSpacing:'.3px',color:P.muted,fontWeight:700,borderBottom:'1px solid #e8edf3',width:90}}>Value</th>
                        <th style={{textAlign:'left',padding:'9px 12px',fontSize:10.5,textTransform:'uppercase',letterSpacing:'.3px',color:P.muted,fontWeight:700,borderBottom:'1px solid #e8edf3',width:120}}>Status</th>
                        <th style={{textAlign:'left',padding:'9px 12px',fontSize:10.5,textTransform:'uppercase',letterSpacing:'.3px',color:P.muted,fontWeight:700,borderBottom:'1px solid #e8edf3'}}>Remark</th>
                      </tr></thead>
                      <tbody>
                        {MONTHS.map(([key,label,Qn],idx)=>{
                          const v = monthRaw(selInd,key);
                          const s = qStatus(selInd,v);
                          const smap={ok:['#e7f6ed','#1f9d57','On benchmark'],breach:['#fbe9ec','#d23a52','Breach'],na:['#eef1f5','#9aa6b4','Not reported']};
                          const [sbg,sfg,slab]=smap[s];
                          const qFirst=(idx%3===0);
                          const disp = v==null?'—':(selInd.formula==='pct'?v+'%':v);
                          const numV=(selInd.mNum&&selInd.mNum[key]!=null)?selInd.mNum[key]:'';
                          const denV=(selInd.mDen&&selInd.mDen[key]!=null)?selInd.mDen[key]:'';
                          const directV=(selInd.months&&selInd.months[key]!=null)?selInd.months[key]:'';
                          const rem=(selInd.monthRemarks&&selInd.monthRemarks[key]!=null)?selInd.monthRemarks[key]:'';
                          return (
                          <tr key={key} style={{borderBottom:'1px solid #eef1f5',background:qFirst?'#fbfcfe':'#fff'}}>
                            <td style={{padding:'7px 12px',textAlign:'left'}}><span style={{fontWeight:600,color:P.ink}}>{label}</span> <span style={{fontFamily:MONO,fontSize:9.5,color:P.faint,background:'#eef1f5',padding:'1px 5px',borderRadius:5,marginLeft:5}}>{Qn}</span></td>
                            {needsDen && <td style={{padding:'5px 8px'}}><input type="number" value={numV} onInput={patchMonthNum(idx)} onChange={patchMonthNum(idx)} placeholder="—" style={{width:'100%',padding:'6px 8px',border:'1px solid #dde3ec',borderRadius:6,fontFamily:MONO,fontSize:12.5,textAlign:'right',background:'#fff',outline:'none'}}/></td>}
                            {needsDen && <td style={{padding:'5px 8px'}}><input type="number" value={denV} onInput={patchMonthDen(idx)} onChange={patchMonthDen(idx)} placeholder="—" style={{width:'100%',padding:'6px 8px',border:'1px solid #dde3ec',borderRadius:6,fontFamily:MONO,fontSize:12.5,textAlign:'right',background:'#fff',outline:'none'}}/></td>}
                            <td style={{padding:'5px 8px'}}>
                              {needsDen
                                ? <span title="Computed from the formula" style={{display:'block',textAlign:'right',fontFamily:MONO,fontWeight:700,fontSize:12.5,color:'#0072a3',padding:'6px 4px'}}>{disp}</span>
                                : <input type="number" value={directV} onInput={patchMonthVal(idx)} onChange={patchMonthVal(idx)} placeholder="—" style={{width:'100%',padding:'6px 8px',border:'1px solid #dde3ec',borderRadius:6,fontFamily:MONO,fontSize:12.5,textAlign:'right',background:'#fff',outline:'none'}}/>}
                            </td>
                            <td style={{padding:'7px 12px',textAlign:'left'}}><span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'2px 9px',borderRadius:20,background:sbg,color:sfg}}>{slab}</span></td>
                            <td style={{padding:'5px 8px'}}><input value={rem} onInput={patchMonthRemark(idx)} onChange={patchMonthRemark(idx)} placeholder="optional note" style={{width:'100%',padding:'6px 9px',border:'1px solid #dde3ec',borderRadius:6,fontSize:12,background:'#fff',outline:'none'}}/></td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:11,padding:'9px 13px',background:'#f7f9fc',border:'1px solid #e8edf3',borderRadius:9}}>
                    <span style={{fontSize:10,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'.4px'}}>Quarter rollup</span>
                    {QORDER.map(Qn=>{ const v=qtrRaw(selInd,Qn); const s=qStatus(selInd,v); const col=s==='breach'?P.rose:s==='ok'?P.green:P.faint; return (
                      <span key={Qn} style={{fontFamily:MONO,fontSize:12,color:P.muted}}>{Qn} <b style={{color:col}}>{v==null?'—':(selInd.formula==='pct'?v+'%':v)}</b></span>
                    ); })}
                    <span style={{fontSize:10.5,color:P.faint}}>· auto-summed from months · feeds the Quarterly Report</span>
                  </div>
                </div>
                )}

                {/* PLACEMENT */}
                {tab==='place' && (
                <div>
                  <div style={{display:'flex',flexDirection:'column',gap:5,maxWidth:280,marginBottom:18}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Department <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>move this indicator</span></label><select value={sel.deptKey} onChange={onMove} style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}>{depts.map(d=><option key={d.key} value={d.key}>{d.name}</option>)}</select></div>
                  <div style={{borderTop:'1px solid #e8edf3',paddingTop:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#d23a52',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:9}}>Danger zone</div>
                    <button onClick={onDelete} style={{display:'inline-flex',alignItems:'center',gap:6,border:'1px solid #f1c6cd',background:'#fff',color:'#d23a52',padding:'8px 13px',borderRadius:8,fontSize:12.5,fontWeight:600,cursor:'pointer'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>Delete indicator</button>
                  </div>
                </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ============ ASSIGN ============ */}
      {view==='assign' && (
      <div style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:12,boxShadow:'0 1px 2px rgba(20,32,46,.06)',overflow:'hidden'}}>
        <div style={{padding:'13px 16px',borderBottom:'1px solid #e8edf3'}}><div style={{fontSize:13.5,fontWeight:700,color:P.ink}}>Assign by Department</div><div style={{fontSize:11.5,color:P.muted}}>Which department reports which standard indicator. Tick a cell to assign it.</div></div>
        <div style={{overflowX:'auto'}}>
          <table style={{borderCollapse:'collapse',fontSize:12,width:'100%'}}>
            <thead><tr>
              <th style={{textAlign:'left',padding:'10px 14px',fontSize:10.5,textTransform:'uppercase',letterSpacing:'.3px',color:P.muted,fontWeight:700,borderBottom:'1px solid #dde3ec',background:'#f7f9fc',position:'sticky',left:0,zIndex:3,minWidth:230}}>Indicator</th>
              {assignCols.map(c=><th key={c.key} title={c.name} style={{padding:'10px 6px',fontSize:10,color:P.muted,fontWeight:700,borderBottom:'1px solid #dde3ec',background:'#f7f9fc',textAlign:'center',whiteSpace:'nowrap'}}>{c.short}</th>)}
            </tr></thead>
            <tbody>
              {assignNames.map(rec=>{ const rmeas=measureOf(rec.formula); return (
              <tr key={rec.key} style={{borderBottom:'1px solid #eef1f5'}}>
                <td style={{padding:'8px 14px',textAlign:'left',position:'sticky',left:0,background:'#fff',zIndex:1}}><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:7,height:7,borderRadius:'50%',background:rmeas.color,flexShrink:0}}></span><span style={{fontWeight:600,color:P.ink}}>{rec.name}</span></div></td>
                {assignCols.map(c=>{ const on=rec.set.has(c.key); return (
                  <td key={c.key} style={{textAlign:'center',padding:'6px 4px'}}><span onClick={()=>toggleAssign(rec,c.key)} title={(on?'Assigned to ':'Not assigned · ')+c.name} style={{display:'inline-grid',placeItems:'center',width:22,height:22,borderRadius:6,cursor:'pointer',background:on?'#e7f6ed':'#f7f9fc',color:on?'#1f9d57':'#cdd6e2',fontSize:12,fontWeight:700}}>{on?'✓':''}</span></td>
                ); })}
              </tr>
              ); })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* ============ CATALOG / FORMULA LIBRARY ============ */}
      {view==='catalog' && (
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <div style={{background:'#0d1b2e',color:'#fff',borderRadius:12,padding:'16px 20px',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{width:42,height:42,borderRadius:11,background:'rgba(39,168,219,.2)',color:'#7fd0f0',display:'grid',placeItems:'center',flexShrink:0}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7"></path></svg></div>
          <div style={{minWidth:0,flex:1}}><div style={{fontSize:16,fontWeight:700}}>Hospital Quality Indicator Framework</div><div style={{fontSize:12,color:'#9fb0c4',marginTop:2}}>Standardised measurement formulas, benchmarks &amp; evidence-based references · 13 domains · aligned to WHO · JCI · CDC/NHSN · KDOQI · ACC/AHA</div></div>
          <div style={{textAlign:'center',flexShrink:0}}><div style={{fontFamily:MONO,fontSize:26,fontWeight:700,color:'#7fd0f0',lineHeight:1}}>{STD.length}</div><div style={{fontSize:10.5,color:'#9fb0c4',textTransform:'uppercase',letterSpacing:'.4px'}}>indicators</div></div>
        </div>
        {libSections.map(g=>(
        <div key={g.sec} style={{background:'#fff',border:'1px solid #dde3ec',borderRadius:12,boxShadow:'0 1px 2px rgba(20,32,46,.06)',overflow:'hidden'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 16px',borderBottom:'1px solid #e8edf3',background:'#f7f9fc'}}>
            <span style={{width:26,height:26,borderRadius:7,background:'#0090ca',color:'#fff',display:'grid',placeItems:'center',fontWeight:700,fontSize:12,flexShrink:0}}>{g.sec}</span>
            <span style={{fontSize:13.5,fontWeight:700,color:P.ink}}>{g.name}</span>
            <span style={{fontSize:11,color:P.faint,fontFamily:MONO}}>{g.count}</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table style={{borderCollapse:'collapse',fontSize:12,width:'100%'}}>
              <thead><tr style={{background:'#fbfcfe'}}>
                <th style={{textAlign:'left',padding:'8px 10px 8px 16px',fontSize:10,textTransform:'uppercase',letterSpacing:'.3px',color:P.faint,fontWeight:700,borderBottom:'1px solid #eef1f5',width:42}}>#</th>
                <th style={{textAlign:'left',padding:'8px 10px',fontSize:10,textTransform:'uppercase',letterSpacing:'.3px',color:P.faint,fontWeight:700,borderBottom:'1px solid #eef1f5',width:220}}>Indicator</th>
                <th style={{textAlign:'left',padding:'8px 10px',fontSize:10,textTransform:'uppercase',letterSpacing:'.3px',color:P.faint,fontWeight:700,borderBottom:'1px solid #eef1f5'}}>Formula / Calculation</th>
                <th style={{textAlign:'left',padding:'8px 10px',fontSize:10,textTransform:'uppercase',letterSpacing:'.3px',color:P.faint,fontWeight:700,borderBottom:'1px solid #eef1f5',width:118}}>Unit</th>
                <th style={{textAlign:'left',padding:'8px 10px',fontSize:10,textTransform:'uppercase',letterSpacing:'.3px',color:P.faint,fontWeight:700,borderBottom:'1px solid #eef1f5',width:96}}>Benchmark</th>
                <th style={{textAlign:'left',padding:'8px 10px',fontSize:10,textTransform:'uppercase',letterSpacing:'.3px',color:P.faint,fontWeight:700,borderBottom:'1px solid #eef1f5',width:88}}>Status</th>
              </tr></thead>
              <tbody>
                {g.rows.map(s=>{
                  const used = useCount[s.code] ? useCount[s.code].size : 0;
                  const gd = guideOf(s.code) || {};
                  const expanded = expand===s.code;
                  const mColor = measColC(s.ft);
                  return [
                  <tr key={s.code} onClick={()=>setExpand(expand===s.code?'':s.code)} style={{borderBottom:'1px solid #f1f3f6',verticalAlign:'top',cursor:'pointer'}}>
                    <td style={{padding:'9px 10px 9px 16px',fontFamily:MONO,fontSize:11,color:P.faint,fontWeight:600}}><span style={{color:'#cdd6e2',marginRight:3}}>{expanded?'▾':'▸'}</span>{s.code}</td>
                    <td style={{padding:'9px 10px'}}><div style={{display:'flex',alignItems:'center',gap:7}}><span style={{width:7,height:7,borderRadius:'50%',background:mColor,flexShrink:0}}></span><span style={{fontWeight:600,color:P.ink}}>{s.name}</span></div><div style={{fontSize:9.5,color:P.faint,marginTop:2}}>{s.ref}</div></td>
                    <td style={{padding:'9px 10px',color:P.ink2,fontSize:11.5,lineHeight:1.45}}>{s.expr}</td>
                    <td style={{padding:'9px 10px'}}><span style={{fontSize:10,fontWeight:600,color:mColor,background:mColor+'1c',padding:'2px 8px',borderRadius:6,whiteSpace:'nowrap'}}>{s.unit||'—'}</span></td>
                    <td style={{padding:'9px 10px',fontFamily:MONO,fontWeight:600,color:P.ink}}>{s.bench}</td>
                    <td style={{padding:'9px 10px'}}><span style={{fontSize:10,fontWeight:600,color:used>0?P.green:P.faint,background:used>0?'#e7f6ed':'#f1f3f6',padding:'2px 8px',borderRadius:20,whiteSpace:'nowrap'}}>{used>0?('in use · '+used+' dept'+(used>1?'s':'')):'not in use'}</span></td>
                  </tr>,
                  expanded && (
                  <tr key={s.code+'-x'} style={{borderBottom:'1px solid #e8edf3',background:'#fbfcfe'}}>
                    <td></td>
                    <td colSpan="5" style={{padding:'4px 16px 16px 10px'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                        <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:9,padding:'11px 13px'}}><div style={{fontSize:9.5,fontWeight:700,color:'#0090ca',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Numerator — what to count</div><div style={{fontSize:11.5,color:P.ink2,lineHeight:1.5}}>{gd.numDef||s.num||'—'}</div></div>
                        <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:9,padding:'11px 13px'}}><div style={{fontSize:9.5,fontWeight:700,color:'#6a52d4',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Denominator — what to count</div><div style={{fontSize:11.5,color:P.ink2,lineHeight:1.5}}>{gd.denDef||s.den||'—'}</div></div>
                        <div style={{background:'#eef8fc',border:'1px solid #dceffa',borderRadius:9,padding:'11px 13px',gridColumn:'1 / -1'}}><div style={{fontSize:9.5,fontWeight:700,color:'#0072a3',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>🔢 Worked example</div><div style={{fontSize:11.5,color:'#0072a3',lineHeight:1.55,fontFamily:MONO}}>{gd.example||'—'}</div></div>
                        <div style={{background:'#fff',border:'1px solid #e8edf3',borderRadius:9,padding:'11px 13px',gridColumn:'1 / -1'}}><div style={{fontSize:9.5,fontWeight:700,color:'#1f9d57',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>💡 Interpretation &amp; action</div><div style={{fontSize:11.5,color:P.ink2,lineHeight:1.5}}>{gd.interpretation||'—'}</div></div>
                        <div style={{gridColumn:'1 / -1',display:'flex',gap:16,flexWrap:'wrap',fontSize:10.5,color:P.faint}}><span><b style={{color:P.muted}}>Multiplier:</b> {gd.multiplier||'—'}</span><span><b style={{color:P.muted}}>Source:</b> {gd.source||'—'}</span><span><b style={{color:P.muted}}>Reference:</b> {gd.reference||s.ref||'—'}</span></div>
                      </div>
                    </td>
                  </tr>
                  )
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
        ))}
      </div>
      )}
    </div>
  );
}

/* ===== part: shell.jsx ===== */
/* ============================================================================
   QUALITY ADMIN CONSOLE — SHELL (chrome + module switch + two tiny modules)
   Concatenated AFTER the prelude and all sibling module components.
   QCDashboard / QCScorecard / QCTrends / QCReports / QCIncidents /
   QCActionPlans / QCAdmin are declared by other agents earlier in the bundle;
   function declarations hoist, so referencing them here is safe.
   ============================================================================ */

/* ---- Quality Data Entry module — reuse the existing, tested form ---- */
function QCDataEntry(){
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:16}}>
        <div style={{width:40,height:40,borderRadius:11,background:'#eef8fc',color:P.blue,display:'grid',placeItems:'center',flexShrink:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4zM4 9h16M9 4v16"></path></svg>
        </div>
        <div>
          <h1 style={{margin:0,fontSize:21,fontWeight:700,color:P.ink,letterSpacing:'-.3px'}}>Quality Data Entry</h1>
          <div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Log the month's incidents — the count / rate is calculated automatically</div>
        </div>
      </div>
      {typeof DataQualityForm!=='undefined'
        ? <DataQualityForm/>
        : <div style={{padding:40,textAlign:'center',color:P.muted}}>Data entry form unavailable.</div>}
    </div>
  );
}

/* ---- nav icon paths (single-path stroke svgs) ---- */
const QC_ICONS = {
  dashboard:'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  scorecard:'M4 4h16v16H4zM4 9h16M4 14h16M9 4v16',
  trends:'M3 17l6-6 4 4 8-8',
  reports:'M6 2h9l5 5v15H6zM14 2v6h6',
  incidents:'M12 2l10 18H2zM12 9v5M12 17v.5',
  admin:'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  dataentry:'M4 4h16v16H4zM4 9h16M9 4v16',
  actionplans:'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'
};

function QualityConsole({ onExit, initialView, initialDept }){
  const Q = window.useQualityStore();
  const depts = (Q.depts||[]).filter(d => d.indicators && d.indicators.length);

  const [module, setModule] = useState(initialView || 'dashboard');
  const [gq, setGq] = useState('');

  const crumbTitle = {
    dashboard:'Dashboard', scorecard:'Scorecard', trends:'Trends',
    reports:'Reports', incidents:'Incident Reports',
    admin:'Indicator Administration', dataentry:'Quality Data Entry', actionplans:'Action Plans'
  }[module] || 'Dashboard';

  const navGroups = [
    { sec:'Monitor', items:[
      { id:'dashboard', label:'Dashboard' },
      { id:'scorecard', label:'Scorecard' },
      { id:'trends',    label:'Trends' },
    ]},
    { sec:'Reporting', items:[
      { id:'reports',   label:'Reports' },
      { id:'incidents', label:'Incident Reports' },
    ]},
    { sec:'Administration', items:[
      { id:'admin',       label:'Indicator Administration' },
      { id:'dataentry',   label:'Quality Data Entry' },
      { id:'actionplans', label:'Action Plans' },
    ]},
  ];

  return (
    <div style={{height:'100vh',display:'grid',gridTemplateColumns:'236px 1fr',overflow:'hidden',fontFamily:"'IBM Plex Sans',system-ui,sans-serif",background:'#eef1f5',color:P.ink}}>

      {/* ===================== SIDEBAR ===================== */}
      <aside className="qsb" style={{background:P.navy,color:'#c7d2e0',display:'flex',flexDirection:'column',minWidth:0,overflow:'hidden'}}>
        <div
          onClick={()=> onExit && onExit()}
          title="Back to UNICO"
          style={{display:'flex',alignItems:'center',gap:10,padding:'0 16px',height:56,borderBottom:'1px solid rgba(255,255,255,.07)',flexShrink:0,cursor:'pointer'}}>
          <div style={{width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,#27a8db,#0072a3)',display:'grid',placeItems:'center',color:'#fff',fontWeight:700,fontSize:15,boxShadow:'0 2px 9px rgba(0,144,202,.5)'}}>U</div>
          <div style={{minWidth:0}}>
            <div style={{fontWeight:700,color:'#fff',fontSize:14,letterSpacing:'.2px',whiteSpace:'nowrap'}}>UNICO</div>
            <div style={{fontWeight:500,color:'#83909f',fontSize:9.5,letterSpacing:'.7px',textTransform:'uppercase'}}>Hospital Analytics</div>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'10px 0'}}>
          {navGroups.map(g => (
            <div key={g.sec}>
              <div style={{padding:'13px 16px 5px',fontSize:10,letterSpacing:'.8px',textTransform:'uppercase',color:'#6b7a90',fontWeight:600}}>{g.sec}</div>
              {g.items.map(n => {
                const active = module===n.id;
                return (
                  <div
                    key={n.id}
                    onClick={()=> setModule(n.id)}
                    style={{
                      display:'flex',alignItems:'center',gap:11,padding:'8px 16px',cursor:'pointer',
                      borderLeft:'3px solid '+(active ? '#27a8db' : 'transparent'),
                      whiteSpace:'nowrap',fontSize:13,fontWeight:500,
                      color: active ? '#fff' : '#c7d2e0',
                      background: active ? 'linear-gradient(90deg,rgba(11,102,208,.24),transparent)' : 'transparent'
                    }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,opacity:.92}}><path d={QC_ICONS[n.id]}></path></svg>
                    <span>{n.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{padding:'11px 14px',borderTop:'1px solid rgba(255,255,255,.07)',display:'flex',alignItems:'center',gap:9,flexShrink:0}}>
          <div style={{width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,#3ab5a7,#0090ca)',color:'#fff',display:'grid',placeItems:'center',fontWeight:700,fontSize:12}}>QM</div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:12,fontWeight:600,color:'#e6edf5',whiteSpace:'nowrap'}}>Quality Manager</div>
            <div style={{fontSize:10,color:'#83909f'}}>Admin · full access</div>
          </div>
        </div>
      </aside>

      {/* ===================== MAIN ===================== */}
      <div style={{display:'flex',flexDirection:'column',minWidth:0,height:'100vh',overflow:'hidden'}}>

        {/* topbar */}
        <header style={{height:56,background:'#fff',borderBottom:'1px solid '+P.line,display:'flex',alignItems:'center',gap:14,padding:'0 18px',flexShrink:0,zIndex:5}}>
          <div style={{width:32,height:32,border:'1px solid '+P.line,background:P.panel2,borderRadius:7,display:'grid',placeItems:'center',color:P.ink2}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"></path></svg>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,color:P.muted,fontSize:12,whiteSpace:'nowrap'}}>
            <span>Quality Indicators</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"></path></svg>
            <b style={{color:P.ink,fontWeight:600,fontSize:14}}>{crumbTitle}</b>
          </div>
          <div style={{marginLeft:8,display:'flex',alignItems:'center',gap:8,background:P.panel2,border:'1px solid '+P.line,borderRadius:8,padding:'7px 11px',width:300,color:P.faint}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M11 4a7 7 0 105 12l4 4M11 4a7 7 0 015 12"></path></svg>
            <input
              placeholder="Search indicators, departments, references…"
              value={gq}
              onInput={e=> setGq(e.target.value)}
              onChange={e=> setGq(e.target.value)}
              style={{border:0,background:'transparent',outline:'none',fontSize:12.5,color:P.ink,width:'100%'}} />
          </div>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}}>
            <div style={{display:'flex',alignItems:'center',gap:7,background:P.panel2,border:'1px solid '+P.line,borderRadius:20,padding:'5px 12px',fontSize:12,color:P.ink2,fontWeight:500,whiteSpace:'nowrap'}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:'#3ddc97',boxShadow:'0 0 0 3px rgba(61,220,151,.18)'}}></span>FY 2025–26
            </div>
            <div style={{width:34,height:34,borderRadius:9,background:'linear-gradient(135deg,#3ab5a7,#0090ca)',color:'#fff',display:'grid',placeItems:'center',fontWeight:700,fontSize:13}}>QM</div>
          </div>
        </header>

        {/* content */}
        <div style={{flex:1,overflowY:'auto',padding:'20px 26px 64px'}}>
          {module==='dashboard'   && <QCDashboard depts={depts}/>}
          {module==='scorecard'   && <QCScorecard depts={depts}/>}
          {module==='trends'      && <QCTrends depts={depts}/>}
          {module==='reports'     && <QCReports depts={depts}/>}
          {module==='incidents'   && <QCIncidents depts={depts}/>}
          {module==='actionplans' && <QCActionPlans depts={depts}/>}
          {module==='dataentry'   && <QCDataEntry/>}
          {module==='admin'       && <QCAdmin Q={Q} q={gq} onQ={setGq} initialDept={initialDept}/>}
        </div>
      </div>
    </div>
  );
}

window.QualityConsole = QualityConsole;
