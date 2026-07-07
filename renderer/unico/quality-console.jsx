/* UNICO — Quality Admin Console (unified). One self-contained module: dark-sidebar shell + 8 views
   (Dashboard, Scorecard, Trends, Reports, Incident Reports, Quality Data Entry, Action Plans,
   Indicator Administration = Manage / Assign / Catalog). Reads live data via window.useQualityStore().
   Assembled from the Claude Design "Quality Admin Console". Publishes window.QualityConsole. */

/* ===== part: 05-standards.jsx ===== */
/* HQI framework standards (96 indicators, A–M) — extracted verbatim from the design. */
var HQI_STANDARDS = [{"code":"A1","sec":"A","name":"Hand Hygiene Compliance","ft":"pct","dir":"high","unit":"%","bench":">90%","bv":90,"expr":"(Hand-hygiene actions performed ÷ Opportunities observed) × 100","ref":"WHO 2009 — Hand Hygiene Guidelines","num":"Hand-hygiene actions performed","den":"Opportunities observed"},{"code":"A2","sec":"A","name":"Catheter-Associated UTI (CAUTI)","ft":"rate1000","dir":"low","unit":"per 1000 cath-days","bench":"<1","bv":1,"expr":"(Catheter-associated UTIs ÷ Urinary catheter-days) × 1,000","ref":"CDC/NHSN 2024 — UTI Event","num":"CAUTI cases","den":"Urinary catheter-days"},{"code":"A3","sec":"A","name":"Central Line-Associated Bloodstream Infection (CLABSI)","ft":"rate1000","dir":"low","unit":"per 1000 line-days","bench":"<1","bv":1,"expr":"(Central line-associated BSIs ÷ Central-line days) × 1,000","ref":"CDC/NHSN 2024 — BSI Event","num":"CLABSI cases","den":"Central-line days"},{"code":"A4","sec":"A","name":"VAP / VAE Rate","ft":"rate1000","dir":"low","unit":"per 1000 vent-days","bench":"<1","bv":1,"expr":"(Ventilator-associated events ÷ Ventilator-days) × 1,000","ref":"CDC/NHSN 2024 — VAE Module","num":"VAP / VAE events","den":"Ventilator-days"},{"code":"A5","sec":"A","name":"Surgical Site Infection (SSI) Rate","ft":"pct","dir":"low","unit":"%","bench":"<1–2%","bv":2,"expr":"(SSIs within 30/90 days ÷ Surgical procedures) × 100","ref":"CDC/NHSN 2024; WHO 2018 SSI Guidelines","num":"SSI cases","den":"Surgical procedures"},{"code":"A6","sec":"A","name":"Phlebitis Rate (IV Site)","ft":"pct","dir":"low","unit":"%","bench":"≤5%","bv":5,"expr":"(IV sites with phlebitis VIP ≥2 ÷ Peripheral IV sites in use) × 100","ref":"INS 2021; Jackson VIP Score","num":"IV sites with phlebitis (VIP ≥2)","den":"Peripheral IV sites in use"},{"code":"A7","sec":"A","name":"MRSA / MDRO Infection Rate","ft":"rate1000","dir":"low","unit":"per 1000 pt-days","bench":"Minimize / track","bv":null,"expr":"(HA MRSA/MDRO infections ÷ Patient-days) × 1,000","ref":"CDC/NHSN 2024 MDRO; WHO 2022 AMR","num":"HA MRSA/MDRO infections","den":"Patient-days"},{"code":"A8","sec":"A","name":"Overall HAI Rate","ft":"pct","dir":"low","unit":"%","bench":"<5%","bv":5,"expr":"(All healthcare-associated infections ÷ Patient-days) × 100","ref":"WHO 2022 IPC Report; Allegranzi 2011","num":"All HAIs","den":"Patient-days"},{"code":"A9","sec":"A","name":"Blood Culture Contamination Rate","ft":"pct","dir":"low","unit":"%","bench":"<3%","bv":3,"expr":"(Culture sets with skin-flora contaminants ÷ Total culture sets) × 100","ref":"CLSI 2022 M47-A2","num":"Contaminated culture sets","den":"Blood culture sets collected"},{"code":"A10","sec":"A","name":"Surgical Antibiotic Prophylaxis Timing","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Prophylaxis ≤60 min before incision ÷ Eligible surgical patients) × 100","ref":"SCIP Inf-1; Bratzler 2013","num":"Patients with timely prophylaxis","den":"Eligible surgical patients"},{"code":"A11","sec":"A","name":"CSSD Sterilization (BI) Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Cycles with passing biological indicator ÷ Total sterilization cycles) × 100","ref":"AAMI/ANSI ST79:2017; ISO 11138-3","num":"Cycles passing BI","den":"Sterilization cycles run"},{"code":"A12","sec":"A","name":"Biomedical Waste Segregation Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Compliant waste-audit observations ÷ Total audit observations) × 100","ref":"WHO 2014 Safe Waste Mgmt","num":"Compliant audit observations","den":"Waste audit observations"},{"code":"A13","sec":"A","name":"Needle Stick / Sharps Injury","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of reported needlestick & sharps injuries","ref":"OSHA 29 CFR 1910.1030; WHO 2018","num":"Needlestick / sharps injuries","den":""},{"code":"A14","sec":"A","name":"Isolation / Transmission-Precaution Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Patients in correct isolation ÷ Patients requiring isolation) × 100","ref":"CDC/HICPAC 2007 (rev 2023)","num":"Correct isolations","den":"Patients requiring isolation"},{"code":"B1","sec":"B","name":"Medication Administration Error","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of medication errors (all categories)","ref":"ISMP 2023; NQF 2011","num":"Medication errors","den":""},{"code":"B2","sec":"B","name":"Adverse Drug Reaction (ADR) Rate","ft":"count","dir":"","unit":"count","bench":"Track","bv":null,"expr":"Total count of confirmed ADRs (by severity)","ref":"WHO 2002 Pharmacovigilance; ICH E2A","num":"Confirmed ADRs","den":""},{"code":"B3","sec":"B","name":"Medication Reconciliation Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Reconciliation at admit AND discharge ÷ Admissions & discharges) × 100","ref":"JCI 2021 IPSG.3; ISMP 2011","num":"Completed reconciliations","den":"Admissions & discharges"},{"code":"B4","sec":"B","name":"High-Alert Medication Double-Check","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(High-alert doses with independent double-check ÷ High-alert doses) × 100","ref":"ISMP 2023; JCI 2021 MMU.5","num":"Doses double-checked","den":"High-alert doses administered"},{"code":"B5","sec":"B","name":"Verbal / Telephone Order Read-Back","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Orders with documented read-back ÷ Verbal/telephone orders) × 100","ref":"JCI 2021 IPSG.2; TJC NPSG 02.01.01","num":"Orders with read-back","den":"Verbal/telephone orders"},{"code":"B6","sec":"B","name":"LASA Drug Storage / Labeling Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(LASA drugs stored & labelled correctly ÷ LASA drugs audited) × 100","ref":"ISMP 2023; WHO 2019","num":"LASA drugs compliant","den":"LASA drugs audited"},{"code":"B7","sec":"B","name":"Controlled Drug Count Accuracy","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Shift counts with zero discrepancy ÷ Controlled-drug counts) × 100","ref":"DEA 21 CFR 1304; Pharmacy Policy","num":"Counts with zero discrepancy","den":"Controlled-drug shift counts"},{"code":"B8","sec":"B","name":"STAT Medication Administration Timeliness","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(STAT orders within TAT ÷ Total STAT orders) × 100","ref":"ISMP 2011; TJC MM.04.01.01","num":"STAT orders within TAT","den":"STAT medication orders"},{"code":"C1","sec":"C","name":"Patient Identification (2-Identifier)","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Interactions with verified 2-identifier check ÷ Interactions audited) × 100","ref":"JCI 2021 IPSG.1; TJC NPSG 01.01.01","num":"Verified 2-identifier checks","den":"Care interactions audited"},{"code":"C2","sec":"C","name":"Patient Fall Rate","ft":"rate1000","dir":"low","unit":"per 1000 pt-days","bench":"≤3.3","bv":3.3,"expr":"(Patient falls assisted + unassisted ÷ Patient-days) × 1,000","ref":"NDNQI 2023; Morse 2009","num":"Patient falls","den":"Patient-days"},{"code":"C2b","sec":"C","name":"Out Patient Fall","ft":"rate1000","dir":"low","unit":"per 1000 out-patient visits","bench":"≤3.3","bv":3.3,"expr":"(Out-patient falls ÷ Out-patient visits) × 1,000","ref":"Adapted from NDNQI inpatient fall rate","num":"Out-patient falls","den":"Out-patient visits"},{"code":"C3","sec":"C","name":"Falls with Injury","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of falls resulting in any injury","ref":"NDNQI 2023; AHRQ 2013","num":"Falls with injury","den":""},{"code":"C4","sec":"C","name":"Hospital-Acquired Pressure Ulcer (HAPU) Rate","ft":"rate1000","dir":"low","unit":"per 1000 pt-days","bench":"<0.75","bv":0.75,"expr":"(New stage 2–4/unstageable pressure injuries >72 h ÷ Patient-days) × 1,000","ref":"NPUAP/EPUAP/PPPIA 2019; NDNQI 2023","num":"New pressure injuries (stage 2–4)","den":"Patient-days"},{"code":"C5","sec":"C","name":"VTE / DVT Prophylaxis Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Eligible inpatients on VTE prophylaxis by day 2 ÷ Eligible inpatients) × 100","ref":"ACCP 2012; JCI 2021 IPSG.6","num":"Patients on prophylaxis","den":"Eligible adult inpatients"},{"code":"C6","sec":"C","name":"Deep Vein Thrombosis (DVT)","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of new DVT events ≥48 h after admission","ref":"ACCP 2012; Goldhaber 2011","num":"New DVT events ≥48 h","den":""},{"code":"C7","sec":"C","name":"Wrong-Site / -Patient / -Procedure Events","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of wrong-site/-patient/-procedure (sentinel) events","ref":"TJC Universal Protocol; JCI 2021 IPSG.4","num":"Wrong-site/-patient/-procedure events","den":""},{"code":"C8","sec":"C","name":"Surgical Safety Checklist Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Procedures with all 3 checklist phases ÷ Surgical procedures) × 100","ref":"WHO 2009 SSC; Haynes 2009","num":"Procedures with full checklist","den":"Surgical procedures"},{"code":"C9","sec":"C","name":"Restraint Use Appropriateness / Monitoring","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Restraints with order + justification + monitoring ÷ Restrained patients) × 100","ref":"TJC RC.02.01.01; CMS 42 CFR 482.13(e)","num":"Appropriate restraints","den":"Restrained patients"},{"code":"C10","sec":"C","name":"Pain Assessment & Reassessment","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Pain assessed + reassessed ÷ Patients requiring assessment) × 100","ref":"JCI 2021 COP; TJC PC.01.02.07","num":"Pain assessed + reassessed","den":"Patients requiring assessment"},{"code":"C11","sec":"C","name":"Critical Value Reporting Timeliness","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Critical values reported within TAT ÷ Critical values generated) × 100","ref":"TJC NPSG 02.03.01; CLIA","num":"Critical values within TAT","den":"Critical values generated"},{"code":"C12","sec":"C","name":"Patient Handover (SBAR) Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Handovers using SBAR ÷ Handovers audited) × 100","ref":"JCI 2021 IPSG.2.2; WHO 2007","num":"SBAR handovers","den":"Handovers audited"},{"code":"D1","sec":"D","name":"Gross Hospital Mortality Rate","ft":"pct","dir":"","unit":"%","bench":"Track / benchmark","bv":null,"expr":"(Inpatient deaths ÷ Discharges incl. deaths) × 100","ref":"AHRQ 2020 IQI; CMS IQR","num":"Inpatient deaths","den":"Discharges incl. deaths"},{"code":"D2","sec":"D","name":"ICU Mortality Rate","ft":"pct","dir":"","unit":"%","bench":"Track (APACHE/SOFA)","bv":null,"expr":"(ICU deaths ÷ ICU admissions) × 100","ref":"SCCM 2020; Knaus 1985 APACHE II","num":"ICU deaths","den":"ICU admissions"},{"code":"D3","sec":"D","name":"ICU Re-admission within 48 h","ft":"pct","dir":"low","unit":"%","bench":"<5%","bv":5,"expr":"(ICU readmits ≤48 h ÷ Planned ICU step-downs) × 100","ref":"SCCM 2020; Rosenberg 2001","num":"ICU readmits ≤48 h","den":"Planned ICU discharges"},{"code":"D4","sec":"D","name":"Re-admission within 30 Days","ft":"pct","dir":"low","unit":"%","bench":"Track / minimize","bv":null,"expr":"(30-day readmissions ÷ Discharges excl. deaths/planned) × 100","ref":"CMS HRRP; Jencks 2009","num":"30-day readmissions","den":"Eligible discharges"},{"code":"D5","sec":"D","name":"Re-intubation within 48 h","ft":"pct","dir":"low","unit":"%","bench":"<10%","bv":10,"expr":"(Re-intubations ≤48 h ÷ Planned extubations) × 100","ref":"Epstein 1998; SCCM 2020","num":"Re-intubations ≤48 h","den":"Planned extubations"},{"code":"D6","sec":"D","name":"Return to ICU","ft":"count","dir":"low","unit":"count","bench":"0 / minimize","bv":0,"expr":"Count of ward→ICU transfers  (or ÷ ICU discharges to ward × 100)","ref":"SCCM 2020; Rosenberg 2001","num":"Ward patients returned to ICU","den":""},{"code":"D7","sec":"D","name":"Unplanned Return to OT","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(Unplanned OT returns ÷ Surgical procedures) × 100","ref":"ACS NSQIP 2022; Clavien-Dindo","num":"Unplanned OT returns","den":"Surgical procedures"},{"code":"D8","sec":"D","name":"Accidental Removal of ETT (Unplanned Extubation)","ft":"rate100","dir":"low","unit":"per 100 vent-days","bench":"<1","bv":1,"expr":"(Unplanned extubations ÷ Ventilator-days) × 100","ref":"Girard 2008; SCCM 2020","num":"Unplanned extubations","den":"Ventilator-days"},{"code":"D9","sec":"D","name":"LAMA / DAMA Rate","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(AMA/LAMA discharges ÷ Total discharges) × 100","ref":"WHO 2014; Alfandre 2009","num":"AMA / LAMA discharges","den":"Hospital discharges"},{"code":"D10","sec":"D","name":"Cardiac Arrest (Code Blue) Events","ft":"count","dir":"","unit":"count","bench":"Track","bv":null,"expr":"Total count of in-hospital cardiac arrest (Code Blue) events","ref":"AHA 2020 ACLS; Utstein Style","num":"IHCA (Code Blue) events","den":""},{"code":"D11","sec":"D","name":"Cardiac Arrest Survival (ROSC)","ft":"pct","dir":"high","unit":"%","bench":"≥25%","bv":25,"expr":"(IHCA with sustained ROSC ≥20 min ÷ IHCA events) × 100","ref":"AHA 2020 ACLS; ILCOR 2020","num":"IHCA with sustained ROSC","den":"In-hospital cardiac arrest events"},{"code":"E1","sec":"E","name":"Informed Consent Completeness","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Procedures with complete signed consent ÷ Procedures needing consent) × 100","ref":"JCI 2021 PFR.5; TJC RI.01.03.01","num":"Complete signed consents","den":"Procedures requiring consent"},{"code":"E2","sec":"E","name":"Initial Nursing Assessment within 24 h","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Nursing assessment ≤24 h ÷ Inpatient admissions) × 100","ref":"JCI 2021 AOP.1; TJC PC.01.02.01","num":"Assessments ≤24 h","den":"Inpatient admissions"},{"code":"E3","sec":"E","name":"Nursing Care Plan Documentation","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Care plans ≤24–48 h ÷ Admitted patients) × 100","ref":"JCI 2021 AOP.1; NANDA 2021","num":"Documented care plans","den":"Admitted patients"},{"code":"E4","sec":"E","name":"Discharge Summary Timeliness","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Discharge summaries within TAT ÷ Discharges) × 100","ref":"JCI 2021 ACC.3; TJC RC.02.04.01","num":"Summaries within TAT","den":"Patient discharges"},{"code":"E5","sec":"E","name":"Allergy Documentation Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Allergy/NKDA documented ÷ Admissions) × 100","ref":"JCI 2021 IPSG.3; TJC NPSG 03.06.01","num":"Allergy/NKDA documented","den":"Patient admissions"},{"code":"E6","sec":"E","name":"Medication Chart Completeness","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Complete medication charts ÷ Charts audited) × 100","ref":"JCI 2021 MMU; TJC MM.04.01.01","num":"Complete medication charts","den":"Medication charts audited"},{"code":"E7","sec":"E","name":"Patient / Family Education Documentation","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Documented education sessions ÷ Eligible patients) × 100","ref":"JCI 2021 PFE.2; TJC PC.02.03.01","num":"Documented education sessions","den":"Eligible patients"},{"code":"F1","sec":"F","name":"Partograph Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Completed partographs ÷ Labours monitored) × 100","ref":"WHO 2014; FIGO 2018","num":"Completed partographs","den":"Labours monitored"},{"code":"F2","sec":"F","name":"Fetal Heart Rate (FHR) Monitoring","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Appropriate FHR monitoring ÷ Deliveries) × 100","ref":"ACOG #106 2021; FIGO 2015","num":"Appropriate FHR monitoring","den":"Deliveries"},{"code":"F3","sec":"F","name":"Caesarean-Section Rate","ft":"pct","dir":"","unit":"%","bench":"WHO optimal 10–15%","bv":null,"expr":"(Caesarean deliveries ÷ Total deliveries) × 100","ref":"WHO 2015; Robson Classification","num":"Caesarean deliveries","den":"Total deliveries"},{"code":"F4","sec":"F","name":"Postpartum Haemorrhage (PPH) Rate","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(Deliveries with PPH ÷ Total deliveries) × 100","ref":"WHO 2012; ACOG 183 2017","num":"Deliveries with PPH","den":"Total deliveries"},{"code":"F5","sec":"F","name":"Birth Asphyxia Rate","ft":"rate1000","dir":"low","unit":"per 1000 live births","bench":"Minimize","bv":null,"expr":"(5-min APGAR <7 / needing PPV ÷ Live births) × 1,000","ref":"WHO 2012; AAP/AHA NRP 2015","num":"Asphyxiated live births","den":"Live births"},{"code":"F6","sec":"F","name":"Neonatal Mortality Rate","ft":"rate1000","dir":"","unit":"per 1000 live births","bench":"Track (national)","bv":null,"expr":"(Neonatal deaths ≤28 days ÷ Live births) × 1,000","ref":"WHO 2023; UNICEF 2023","num":"Neonatal deaths ≤28 days","den":"Live births"},{"code":"F7","sec":"F","name":"Breastfeeding Initiation within 1 h","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Breastfeeding ≤1 h ÷ Live births) × 100","ref":"WHO/UNICEF 2018 BFHI","num":"Breastfeeding ≤1 h","den":"Live births"},{"code":"F9","sec":"F","name":"Kangaroo Mother Care (KMC) Compliance","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Eligible neonates receiving KMC ÷ Eligible neonates) × 100","ref":"WHO 2022; Conde-Agudelo 2016","num":"Neonates receiving KMC","den":"Eligible preterm/LBW neonates"},{"code":"G1","sec":"G","name":"Door-to-Balloon Time ≤90 min","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(STEMI PCI with D2B ≤90 min ÷ STEMI primary-PCI patients) × 100","ref":"ACC/AHA 2013; TJC AMI-8a","num":"STEMI PCI D2B ≤90 min","den":"STEMI primary-PCI patients"},{"code":"G2","sec":"G","name":"Post-PCI Complication","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of major post-PCI adverse events (24–48 h)","ref":"ACC/AHA 2021; NCDR CathPCI","num":"Major post-PCI adverse events","den":""},{"code":"G3","sec":"G","name":"Puncture Site Hematoma","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of access-site hematomas >5 cm after catheterization","ref":"ACC/AHA 2012; NCDR CathPCI","num":"Access-site hematomas >5 cm","den":""},{"code":"G4","sec":"G","name":"Door-to-ECG ≤10 min","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(ACS with ECG ≤10 min ÷ ACS presentations) × 100","ref":"ACC/AHA 2014; TJC AMI-1","num":"ACS with ECG ≤10 min","den":"ACS / chest-pain presentations"},{"code":"G5","sec":"G","name":"STEMI Door-to-Needle (Fibrinolysis)","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(STEMI fibrinolysis ≤30 min ÷ Eligible STEMI patients) × 100","ref":"ACC/AHA 2013; TJC AMI-7a","num":"Fibrinolysis ≤30 min","den":"Eligible STEMI patients"},{"code":"G6","sec":"G","name":"Heart Failure 30-Day Readmission","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(HF readmissions ≤30 days ÷ HF discharges) × 100","ref":"CMS HRRP (HF-30); AHRQ 2020","num":"HF 30-day readmissions","den":"Heart-failure discharges"},{"code":"H1","sec":"H","name":"Dialysis Adequacy — URR","ft":"pct","dir":"high","unit":"%","bench":"≥65%","bv":65,"expr":"(Patients with URR ≥65% ÷ Patients dialyzed) × 100 · URR=[(pre-BUN−post-BUN)÷pre-BUN]×100","ref":"KDOQI 2015; Tattersall 1996","num":"Patients with URR ≥65%","den":"Patients dialyzed"},{"code":"H2","sec":"H","name":"Kt/V Achievement","ft":"pct","dir":"high","unit":"%","bench":"≥90% achieve Kt/V ≥1.2","bv":90,"expr":"(Patients Kt/V ≥1.2 ÷ Patients dialyzed) × 100 · Kt/V via Daugirdas 2nd-gen","ref":"KDOQI 2015; Daugirdas 1993","num":"Patients with Kt/V ≥1.2","den":"Patients dialyzed"},{"code":"H3","sec":"H","name":"Water Quality Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Water/dialysate tests meeting AAMI/ISO ÷ Tests performed) × 100","ref":"AAMI/ANSI 23500:2019; ISO 23500","num":"Tests meeting AAMI/ISO","den":"Water quality tests performed"},{"code":"H4","sec":"H","name":"Intradialytic Hypotension","ft":"count","dir":"low","unit":"count","bench":"0 / minimize","bv":0,"expr":"Count of sessions with symptomatic hypotension (SBP drop ≥20 / <90 mmHg)","ref":"KDOQI 2015; Flythe 2015","num":"Sessions with symptomatic hypotension","den":""},{"code":"H5","sec":"H","name":"Vascular Access Complication","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of vascular access complications","ref":"KDOQI 2006; KDIGO 2019","num":"Vascular access complications","den":""},{"code":"H6","sec":"H","name":"Accidental De-lining of Catheter","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of accidental catheter disconnection events during dialysis","ref":"KDOQI 2006; Dialysis Nursing Policy","num":"Accidental de-lining events","den":""},{"code":"H7","sec":"H","name":"Dialysis Access Infection Rate","ft":"rate1000","dir":"low","unit":"per 1000 access-days","bench":"0","bv":0,"expr":"(Dialysis access infections ÷ Access-days) × 1,000","ref":"CDC/NHSN 2024 Dialysis Event; KDOQI 2006","num":"Dialysis access infections","den":"Access-days"},{"code":"H8","sec":"H","name":"Missed / Shortened Dialysis Sessions","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(Missed or shortened >10% sessions ÷ Scheduled sessions) × 100","ref":"KDOQI 2015; Saran 2003","num":"Missed / shortened sessions","den":"Scheduled dialysis sessions"},{"code":"I1","sec":"I","name":"On-Time First-Case Start","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(First cases starting on time ÷ First cases scheduled) × 100","ref":"AORN 2022; NHS England 2021","num":"First cases on time","den":"First cases scheduled"},{"code":"I2","sec":"I","name":"Elective Case Cancellation Rate","ft":"pct","dir":"low","unit":"%","bench":"<5%","bv":5,"expr":"(Elective cases cancelled same-day ÷ Elective cases scheduled) × 100","ref":"AORN 2022; RCS standards","num":"Same-day cancellations","den":"Elective cases scheduled"},{"code":"I3","sec":"I","name":"Instrument / Sponge Count Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Cases with documented counts at all timepoints ÷ Surgical procedures) × 100","ref":"AORN 2022; WHO 2009","num":"Cases with documented counts","den":"Surgical procedures"},{"code":"I4","sec":"I","name":"Specimen Labeling Error Rate","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of surgical specimen labeling errors","ref":"CAP 2021; TJC NPSG 01.01.01","num":"Specimen labeling errors","den":""},{"code":"I5","sec":"I","name":"Anaesthesia-Related Complication Rate","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of anaesthesia-related adverse events","ref":"ASA 2019; APSF; Merry 2010","num":"Anaesthesia adverse events","den":""},{"code":"I6","sec":"I","name":"PACU Recovery Delay Rate","ft":"pct","dir":"low","unit":"%","bench":"Minimize","bv":null,"expr":"(PACU stays beyond threshold ÷ PACU admissions) × 100","ref":"ASPAN 2021; Aldrete 1995","num":"Delayed PACU discharges","den":"PACU admissions"},{"code":"J1","sec":"J","name":"Post-Procedure Complication","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Count of post-endoscopy complications within 30 days","ref":"ASGE 2015; BSG 2019","num":"Post-endoscopy complications","den":""},{"code":"J2","sec":"J","name":"Endoscope Reprocessing Compliance","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(Endoscopes reprocessed per HLD protocol ÷ Endoscopes reprocessed) × 100","ref":"SGNA 2022; ESGE/ESGENA 2018","num":"Endoscopes per HLD protocol","den":"Endoscopes reprocessed"},{"code":"J3","sec":"J","name":"Perforation Rate","ft":"pct","dir":"low","unit":"%","bench":"Minimize (<0.1%)","bv":0.1,"expr":"(Iatrogenic perforations ÷ Endoscopic procedures) × 100","ref":"ASGE 2015; Pohl 2012","num":"Iatrogenic perforations","den":"Endoscopic procedures"},{"code":"J4","sec":"J","name":"Post-Polypectomy Bleeding","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Count of significant post-polypectomy bleeds within 30 days","ref":"ASGE 2015; ESGE 2022","num":"Post-polypectomy bleeds","den":""},{"code":"K1","sec":"K","name":"Triage-to-Consult / Door-to-Doctor Time","ft":"pct","dir":"high","unit":"%","bench":"≥90% per category","bv":90,"expr":"(Patients seen within triage TAT ÷ ED presentations by category) × 100","ref":"ACEP 2019 ESI; CTAS 2020","num":"Patients seen within TAT","den":"ED presentations"},{"code":"K2","sec":"K","name":"Left Without Being Seen (LWBS) Rate","ft":"pct","dir":"low","unit":"%","bench":"<2%","bv":2,"expr":"(Patients who left without being seen ÷ ED registrations) × 100","ref":"ACEP 2019; Hobbs 2000","num":"Left without being seen","den":"ED registrations"},{"code":"K3","sec":"K","name":"ED Re-attendance within 72 h","ft":"pct","dir":"low","unit":"%","bench":"<5%","bv":5,"expr":"(ED re-attendances ≤72 h ÷ ED discharges) × 100","ref":"ACEP 2019; NHS England","num":"ED re-attendances ≤72 h","den":"ED discharges"},{"code":"K4","sec":"K","name":"Door-to-Needle for Stroke Thrombolysis","ft":"pct","dir":"high","unit":"%","bench":"≥80%","bv":80,"expr":"(Stroke tPA ≤60 min ÷ Eligible stroke patients) × 100","ref":"AHA/ASA 2019; ESO 2021","num":"Stroke tPA ≤60 min","den":"Eligible ischemic-stroke patients"},{"code":"L1","sec":"L","name":"Mandatory Training Compliance","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Staff completing mandatory training ÷ Staff required) × 100","ref":"JCI 2021 SQE.3; TJC HR.01.05.01","num":"Staff completing training","den":"Staff required to train"},{"code":"L2","sec":"L","name":"BLS / ACLS Certification Rate","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Staff with valid BLS/ACLS ÷ Staff required) × 100","ref":"AHA 2020 BLS/ACLS; JCI 2021 SQE","num":"Staff with valid certification","den":"Staff required to certify"},{"code":"L3","sec":"L","name":"Induction Completion within 30 Days","ft":"pct","dir":"high","unit":"%","bench":"100%","bv":100,"expr":"(New staff induction ≤30 days ÷ New staff) × 100","ref":"JCI 2021 SQE.7; TJC HR.01.04.01","num":"Inductions ≤30 days","den":"New employees"},{"code":"L4","sec":"L","name":"Accidental Catheter Dislodgement","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of accidental catheter dislodgements","ref":"JCI 2021 QPS; NDNQI 2023","num":"Accidental dislodgements","den":""},{"code":"L5","sec":"L","name":"Accidental Removal of Catheter","ft":"count","dir":"low","unit":"count","bench":"0","bv":0,"expr":"Total count of accidental (unplanned) catheter removals","ref":"JCI 2021 QPS; NDNQI 2023","num":"Accidental catheter removals","den":""},{"code":"M1","sec":"M","name":"Patient Satisfaction Score","ft":"pct","dir":"high","unit":"%","bench":"≥85%","bv":85,"expr":"(Patients rating care 'Very Good/Excellent' ÷ Patients surveyed) × 100","ref":"HCAHPS 2024; Press Ganey 2023","num":"Top-box ratings","den":"Patients surveyed"},{"code":"M2","sec":"M","name":"Complaint Resolution within TAT","ft":"pct","dir":"high","unit":"%","bench":"≥90%","bv":90,"expr":"(Complaints resolved within TAT ÷ Complaints received) × 100","ref":"JCI 2021 PFR.3; TJC RI.01.07.01","num":"Complaints resolved within TAT","den":"Complaints received"}];
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

/* The module-level default month axis (the current calendar year, Jan–Dec) is defined just
   below once fyAxis() exists. Views compute their own axis via fyAxis(selectedYear). */

const QORDER = ['Q1','Q2','Q3','Q4'];
const QL = [['Q1','Jan–Mar'],['Q2','Apr–Jun'],['Q3','Jul–Sep'],['Q4','Oct–Dec']];

/* ---- reporting-year helpers (calendar year, Jan–Dec) for the month + year switcher ---- */
const FY_MONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/* The 12 months of the calendar year `startYear`, as [storeKey 'Mon-YY', 'Mon YYYY', 'Mon'] —
   the same [key,label,…] shape MONTHS uses, so deptStat / monthStatus work unchanged. */
function fyMonthsFor(startYear){
  const yy = String(startYear % 100).padStart(2, '0');
  return FY_MONS.map(mn => [ mn + '-' + yy, mn + ' ' + startYear, mn ]);
}
/* Calendar year for a 'Mon-YY' key. */
function fyOfKey(key){
  const p = String(key || '').split('-'); const mi = FY_MONS.indexOf(p[0]);
  const yy = parseInt(p[1], 10);
  if(mi < 0 || isNaN(yy)) return null;
  return 2000 + yy;
}
/* Current calendar year from the browser clock. */
function currentFy(){ return new Date().getFullYear(); }
/* Set of fiscal-year starts that have any actual recorded value in the data. */
function dataFySet(depts){
  const set = new Set();
  (depts || []).forEach(dep => (dep.indicators || []).forEach(ind => {
    const scan = (obj) => { if(obj) Object.keys(obj).forEach(k => { if(obj[k] != null && obj[k] !== ''){ const fy = fyOfKey(k); if(fy != null) set.add(fy); } }); };
    scan(ind.months); scan(ind.mNum);
  }));
  return set;
}
/* Contiguous list of selectable fiscal years — spans every year that has data and
   the current year, so you can page back through history and forward to a fresh year. */
function fyOptions(depts){
  const set = dataFySet(depts); set.add(currentFy());
  const arr = [...set]; if(!arr.length) arr.push(currentFy());
  const lo = Math.min(...arr), hi = Math.max(...arr);
  const out = []; for(let y = lo; y <= hi; y++) out.push(y);
  return out;
}
/* Default year to open on: the fiscal year with the MOST reported data (so overview views
   aren't near-empty early in a fresh year); ties break to the most recent. The current year
   is always still selectable in every picker. */
function defaultFy(depts){
  const counts = {};
  (depts || []).forEach(dep => (dep.indicators || []).forEach(ind => {
    const scan = (obj) => { if(obj) Object.keys(obj).forEach(k => { if(obj[k] != null && obj[k] !== ''){ const fy = fyOfKey(k); if(fy != null) counts[fy] = (counts[fy] || 0) + 1; } }); };
    scan(ind.months); scan(ind.mNum);
  }));
  const yrs = Object.keys(counts).map(Number);
  if(!yrs.length) return currentFy();
  return yrs.sort((a,b) => (counts[b]-counts[a]) || (b-a))[0];
}
function fyLabelOf(startYear){ return 'Year ' + startYear; }
/* The quarter-tagged 12-month axis for a reporting year — same [key,'Mon YYYY',Q] shape as the
   module MONTHS, so any view can `const MONTHS = fyAxis(fy)` to become year-aware with no other
   change (the local const lexically shadows the module one). */
const QTAG_FY = ['Q1','Q1','Q1','Q2','Q2','Q2','Q3','Q3','Q3','Q4','Q4','Q4'];
function fyAxis(startYear){ return fyMonthsFor(startYear).map((r,i)=>[r[0],r[1],QTAG_FY[i]]); }
/* Default axis = the current calendar year; a safe fallback for helpers called without an
   explicit months array. Every view overrides it with its selected year. */
const MONTHS = fyAxis(currentFy());
/* 'Mon-YY' storeKey -> 'Mon YYYY' display label (year-agnostic). */
function qcMonthLabel(key){ const p=String(key||'').split('-'); return p[1] ? (p[0]+' 20'+p[1]) : String(key||''); }
/* Small reusable fiscal-year <select>. `depts` drives the selectable range (years with data
   + the current year). Pure/controlled. */
function QCFyPicker({fy, setFy, depts, style}){
  return (
    <select value={fy} onChange={e=>setFy(Number(e.target.value))}
      style={Object.assign({padding:'7px 10px',border:'1px solid '+P.line,borderRadius:8,fontSize:12.5,fontWeight:600,background:'#fff',color:P.ink,outline:'none',cursor:'pointer'}, style||{})}>
      {fyOptions(depts).map(y=><option key={y} value={y}>{fyLabelOf(y)}{y===currentFy()?' · current':''}</option>)}
    </select>
  );
}

/* Edit rights: the signed-in Administrator (REQUIRE_AUTH mode) or the single-user
   local PC build (no __UNICO_USER__ injected). Collectors never reach this console. */
function qcCanEdit(){
  try { const u = window.__UNICO_USER__; return !u || u.role === 'Administrator'; } catch (e) { return true; }
}

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
  if(f==='avg') return Math.round(n/d*100)/100; // mean/average = num ÷ den (no multiplier)
  return Math.round(n/d*100*100)/100; // rate100 & pct
}

/* true monthly value: direct -> months[key]; formula -> mNum/mDen; fall back to months[key] */
function monthRaw(ind, mk){
  const f = (ind && ind.formula) || ((ind && ind.valueType==='%') ? 'pct' : 'direct');
  if(f==='direct'){ const v = ind.months && ind.months[mk]; return (v==null||v==='') ? null : Number(v); }
  const n = ind.mNum && ind.mNum[mk];
  if(n==null||n===''){ const v = ind.months && ind.months[mk]; return (v==null||v==='') ? null : Number(v); }
  const d = (f!=='count') ? (ind.mDen && ind.mDen[mk]) : null;
  const r = qiCompute(f, n, d);
  if(r!=null) return r;
  // num present but rate not computable (e.g. an approved ZERO-EVENT reading stores
  // mNum=0 with no denominator): fall back to the stored monthly value so the
  // submission still shows as reported instead of vanishing as "not submitted".
  const v = ind.months && ind.months[mk];
  return (v==null||v==='') ? null : Number(v);
}

function qStatus(ind, v){
  if(v==null||v==='') return 'na';
  const b = ind.benchmarkValue;
  if(b==null||b==='') return 'ok';
  return ind.goalDirection==='higher_is_better' ? (v>=b?'ok':'breach') : (v<=b?'ok':'breach');
}

function monthStatus(ind, mk){ return qStatus(ind, monthRaw(ind, mk)); }

// Optional `fy` (fiscal-year start) reads that year's rollup from ind.quartersByFy; when a
// year has no rollup (e.g. legacy quarter-only data) it falls back to the flat ind.quarters.
function qtrSrc(ind, fy){ return (fy!=null && ind && ind.quartersByFy && ind.quartersByFy[fy]) ? ind.quartersByFy[fy] : ((ind && ind.quarters) || {}); }
function qtrRaw(ind, Q, fy){ const v = qtrSrc(ind, fy)[Q]; return (v==null||v==='') ? null : Number(v); }
function qtrStatus(ind, Q, fy){ return qStatus(ind, qtrSrc(ind, fy)[Q]); }

/* Display value for ONE month cell (report tables, heat grids, chart series, exports).
   Monthly value when present; else the quarter rollup ONLY when that whole quarter has
   no monthly entries at all (pure quarter-recorded data legitimately spreads across its
   3 months). A partially-reported quarter must return null for its gap months — the
   rollup already CONTAINS the reported months, so painting it into a gap month showed
   a phantom duplicated total (e.g. Jan=2, Feb=3, Mar unreported → Mar showed "5"). */
function qcCellVal(ind, m){
  const v = monthRaw(ind, m[0]);
  if(v!=null) return v;
  const fy = fyOfKey(m[0]);
  if(fy==null || !m[2]) return null;
  const qMonths = fyAxis(fy).filter(r=>r[2]===m[2]);
  if(qMonths.some(r=>monthRaw(ind, r[0])!=null)) return null;
  return qtrRaw(ind, m[2], fy);
}

function isPctInd(ind){
  const t = ((ind && ind.valueType) || '').toString().toLowerCase();
  return t.indexOf('%')>=0 || t.startsWith('per') || ind.formula==='pct';
}

/* aggregate ok/breach/na across a set of months × indicators for a department.
   `months` defaults to the built-in FY 2025–26 so other callers are unaffected;
   the dashboard passes the switcher-selected fiscal year's months. */
function deptStat(d, months){
  if(!Array.isArray(months)) months = MONTHS; // guards .filter/.map callers passing the index

  let ok=0, breach=0, na=0;
  (d.indicators||[]).forEach(ind => months.forEach(m => {
    const s = monthStatus(ind, m[0]);
    if(s==='ok') ok++; else if(s==='breach') breach++; else na++;
  }));
  return { ok, breach, na, rate: (ok+breach) ? Math.round(ok*100/(ok+breach)) : 100 };
}

function hasData(ind, months){
  if(!Array.isArray(months)) months = MONTHS; // guards .filter/.map callers passing the index
  // Quarter fallback is YEAR-AWARE: test the axis year's rollup (quartersByFy), not the
  // year-agnostic flat quarters, so a past-year report doesn't pass/fail on another
  // year's data (legacy flat quarters still apply via qtrSrc's fallback).
  const qfy = months.length ? fyOfKey(months[0][0]) : null;
  return months.some(m => monthRaw(ind, m[0])!=null) || QORDER.some(q => qtrRaw(ind, q, qfy)!=null);
}

function countBreaches(ind, months){
  if(!Array.isArray(months)) months = MONTHS; // guards .filter/.map callers passing the index

  let n=0; months.forEach(m => { if(monthStatus(ind, m[0])==='breach') n++; }); return n;
}

function fmtVal(ind, v){
  if(v==null||v==='') return '—';
  const num = Math.round(Number(v)*100)/100;
  return isPctInd(ind) ? (num+'%') : num.toLocaleString();
}

function measureOf(f){
  if(f==='pct') return { name:'Percentage', color:P.teal, letter:'%' };
  if(f==='rate1000'||f==='rate100') return { name:'Rate', color:P.violet, letter:'R' };
  if(f==='avg') return { name:'Average', color:P.violet, letter:'x̄' };
  return { name:'Count', color:P.blue, letter:'C' };
}

/* Is this indicator EVENT/incident-oriented (so the incident register + per-patient
   CAPA layout applies) rather than a continuous compliance rate? True for counts, for
   per-100 event rates (rate100, e.g. unplanned-extubation), for zero-defect benchmarks,
   for indicators that actually carry a per-incident incidents[] payload, and for names
   that clearly denote discrete adverse events. Deciding on this rather than purely on
   formula==='count' means a low-frequency rate like NICU ETT still gets the register. */
function isEventIndicator(ind){
  if(!ind) return false;
  if(ind.formula==='count' || ind.formula==='rate100') return true;
  const bv = ind.benchmarkValue;
  if((bv===0 || bv==='0') && ind.goalDirection!=='higher_is_better') return true;
  if(/zero.?defect/i.test(String(ind.benchmark||''))) return true;
  if(ind.incidents && Object.keys(ind.incidents).length) return true;
  const n = (ind.name||'').toLowerCase();
  if(/extubation|removal of ett|accidental removal|dislodge|self-?extubat|needle ?stick|sharps|wrong-?site|wrong-?patient|wrong-?procedure|specimen labeling|medication (administration )?error|fall|de-?lining/.test(n)) return true;
  return false;
}

/* Unit word for the compliance-gap sentence. Only a true percentage indicator
   (formula==='pct' with a % unit) reads in 'points'; rate indicators read in their
   own unit (e.g. 'per 100 vent-days') so a ventilator-day rate is not mislabelled. */
function rateUnitWord(ind){
  if(!ind) return 'units';
  if(ind.unit && ind.unit!=='count' && ind.unit!=='%') return ind.unit;
  if(ind.formula==='pct') return 'points';
  return 'units';
}

function qtrLabelOf(Q){ const row = QL.find(r=>r[0]===Q); return row ? (Q+' · '+row[1]) : Q; }

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
  if(f==='avg') return 'average = '+num+' ÷ '+den;
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
    // out-patient falls FIRST — the generic /patient fall/ would swallow them into C2,
    // collapsing "Out Patient Fall" and "In Patient Fall" into one Assign-matrix row
    [/medication (administration )?error/,'B1'], [/falls with injury/,'C3'], [/out.?patient fall/,'C2b'], [/patient fall/,'C2'],
    [/pressure ulcer|hapu|bed sore|pressure injury/,'C4'], [/deep vein thrombosis|\bdvt\b/,'C6'],
    [/return to icu/,'D6'], [/cardiac arrest survival/,'D11'], [/cardiac arrest events|code blue/,'D10'],
    [/partograph/,'F1'], [/door-to-balloon/,'G1'], [/post-pci/,'G2'], [/puncture site hematoma/,'G3'],
    [/dialysis adequacy|\burr\b/,'H1'], [/water quality/,'H3'], [/hypotension/,'H4'],
    [/vascular access complication/,'H5'], [/de-lining/,'H6'], [/infection rate/,'H7'],
    [/post-procedure complication/,'J1'], [/training compliance/,'L1'], [/surgical safety/,'C8'],
    [/accidental removal of ett|unplanned extubation|extubation/,'D8'], [/accidental removal of catheter/,'L5'],
    [/catheter dislodgement|dislodgement/,'L4'],
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
function QCDashboard({ depts, Q }) {
  // Fiscal-year switcher: the whole dashboard (KPIs, mix, breaches-by-month and the
  // heatmap) reflects the selected fiscal year. Defaults to the latest year with data.
  const fyOpts = useMemo(() => fyOptions(depts), [depts]);
  const [fyStart, setFyStart] = useState(() => defaultFy(depts));
  const curPos = fyOpts.indexOf(fyStart);
  const safeFy = curPos >= 0 ? fyStart : (fyOpts.length ? fyOpts[fyOpts.length - 1] : currentFy());
  const fyMonths = useMemo(() => fyMonthsFor(safeFy), [safeFy]);

  const pos = fyOpts.indexOf(safeFy);
  const canPrev = pos > 0;
  const canNext = pos >= 0 && pos < fyOpts.length - 1;
  const goPrev = () => { if (canPrev) setFyStart(fyOpts[pos - 1]); };
  const goNext = () => { if (canNext) setFyStart(fyOpts[pos + 1]); };

  // Heatmap cell drill-down: which department × month is being viewed (null = closed).
  const [cellSel, setCellSel] = useState(null);

  const d = useMemo(() => {
    let ok = 0, br = 0, na = 0;
    const uniq = new Set();
    let totalInd = 0;
    depts.forEach(dep => {
      const s = deptStat(dep, fyMonths);
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
    const bbm = fyMonths.map(m => {
      let b = 0;
      depts.forEach(dep => (dep.indicators || []).forEach(ind => { if (monthStatus(ind, m[0]) === 'breach') b++; }));
      if (b > maxB) maxB = b;
      return { label: m[2], val: b };
    });
    const breachByMonth = bbm.map(x => Object.assign(x, { h: Math.round(x.val / maxB * 100) }));

    const heatRows = depts.map(dep => {
      const inds = dep.indicators || [];
      // One cell per month of the selected fiscal year (was one per quarter). Uses the
      // real monthly values, so cells now populate instead of showing all "–".
      const cells = fyMonths.map(m => {
        // Per-ASSIGNED-indicator submission state: which of this department's indicators
        // have a value for the month and which are still missing — so a cell can say
        // "9/15 submitted" instead of a flat ✓ that hid the missing ones.
        let b = 0, rep = 0; const missing = [];
        inds.forEach(ind => {
          const s = monthStatus(ind, m[0]);
          if (s === 'breach') b++; else if (s !== 'na') rep++; else missing.push(ind.name);
        });
        const total = inds.length, sub = b + rep;
        const partial = sub > 0 && sub < total;
        const bg = sub === 0 ? '#eef1f5' : b > 0 ? '#fbe9ec' : partial ? '#fdf3e3' : '#e7f6ed';
        const fg = sub === 0 ? '#9aa6b4' : b > 0 ? '#d23a52' : partial ? '#b26a0f' : '#1f9d57';
        // Breach cells keep the submission count visible: "6/7 ✕1" = 6 of 7 indicators
        // submitted, 1 breaching — a bare breach count hid how much was reported.
        const sym = sub === 0 ? '–' : b > 0 ? (sub + '/' + total + ' ✕' + b) : partial ? (sub + '/' + total) : '✓';
        // mk/mlabel let the cell open a full dept×month drill-down (all cells clickable —
        // a grey/partial cell opens the same modal, which lists what is NOT submitted).
        return { sym, bg, fg, mk: m[0], mlabel: m[1], breach: b, sub, total, missing, has: sub > 0 };
      });
      const st = deptStat(dep, fyMonths);
      // A department with NOTHING reported this year must read "No data", not a
      // flattering "Excellent · 100%" (rate defaults to 100 when ok+breach is 0).
      const reported = (st.ok + st.breach) > 0;
      let status = dep.status;
      if (!reported) status = 'No data';
      else if (!status) {
        const brRate = st.breach / (st.ok + st.breach);
        status = brRate > 0.16 ? 'Needs Improvement' : brRate > 0.06 ? 'Good' : 'Excellent';
      }
      const sc = reported ? statusColorFor(status) : '#8a97a6';
      return { dep, name: dep.name, count: inds.length, cells, rate: reported ? st.rate + '%' : '—', status, statusColor: sc, statusBg: sc + '1c' };
    });

    const monthCols = fyMonths.map(m => m[2]);
    return { dashKpis, mix, breachByMonth, heatRows, monthCols };
  }, [depts, fyMonths]);

  const thBase = { padding: '9px 8px', fontSize: '10.5px', color: '#6c7a8c', fontWeight: 700, borderBottom: '1px solid #dde3ec', background: '#f7f9fc' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '13px', marginBottom: '16px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: '#eef8fc', color: '#0090ca', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"></path></svg>
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '21px', fontWeight: 700, color: '#16202e', letterSpacing: '-.3px' }}>Quality Dashboard</h1>
          <div style={{ fontSize: '12.5px', color: '#6c7a8c', marginTop: '2px' }}>Hospital-wide quality &amp; patient-safety performance · monthly view</div>
        </div>
        {/* Fiscal-year switcher — drives every panel on this dashboard. */}
        <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '2px', background: '#f1f6fb', border: '1px solid #dde3ec', borderRadius: '10px', padding: '3px', flexShrink: 0 }}>
          <button onClick={goPrev} disabled={!canPrev} title="Previous fiscal year" style={{ border: 0, background: 'transparent', cursor: canPrev ? 'pointer' : 'default', color: canPrev ? '#0090ca' : '#c4ccd6', fontSize: '17px', lineHeight: 1, padding: '3px 10px', borderRadius: '7px', fontWeight: 700 }}>‹</button>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#16202e', minWidth: '96px', textAlign: 'center', fontFamily: MONO }}>{fyLabelOf(safeFy)}</span>
          <button onClick={goNext} disabled={!canNext} title="Next fiscal year" style={{ border: 0, background: 'transparent', cursor: canNext ? 'pointer' : 'default', color: canNext ? '#0090ca' : '#c4ccd6', fontSize: '17px', lineHeight: 1, padding: '3px 10px', borderRadius: '7px', fontWeight: 700 }}>›</button>
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
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#16202e' }}>Department × Month Heatmap <span style={{ fontWeight: 600, color: '#9aa6b4', fontSize: '11.5px' }}>· {fyLabelOf(safeFy)}</span></div>
          <div style={{ fontSize: '11.5px', color: '#6c7a8c' }}>per assigned indicator — <b style={{ color: '#1f9d57' }}>✓ all submitted</b> · <b style={{ color: '#b26a0f' }}>n/N partially submitted</b> · <b style={{ color: '#d23a52' }}>red = breaches</b> · grey none — click any cell to see what's submitted &amp; missing</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '12.5px', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...thBase, textAlign: 'left', padding: '9px 16px', textTransform: 'uppercase', letterSpacing: '.3px' }}>Department</th>
                {d.monthCols.map((mc, i) => (
                  <th key={i} style={{ ...thBase, textAlign: 'center', padding: '9px 5px' }}>{mc}</th>
                ))}
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
                    <td key={ci} style={{ textAlign: 'center', padding: '6px 4px' }}>
                      <span
                        onClick={() => setCellSel({ depKey: r.dep.key, mk: c.mk, mlabel: c.mlabel })}
                        title={r.name + ' · ' + c.mlabel + ' — ' + c.sub + ' of ' + c.total + ' assigned indicator' + (c.total !== 1 ? 's' : '') + ' submitted'
                          + (c.breach ? ' · ' + c.breach + ' breach' + (c.breach > 1 ? 'es' : '') : '')
                          + (c.missing.length ? ' · not submitted: ' + c.missing.slice(0, 5).join(', ') + (c.missing.length > 5 ? ' +' + (c.missing.length - 5) + ' more' : '') : '')
                          + ' · click for details'}
                        style={{ display: 'inline-grid', placeItems: 'center', minWidth: '24px', height: '24px', padding: '0 4px', borderRadius: '6px', background: c.bg, color: c.fg, fontWeight: 700, fontSize: c.sym.length > 2 ? '9.5px' : '11px', fontFamily: MONO, cursor: 'pointer', boxShadow: c.breach ? '0 0 0 1px #eeb9c2' : 'none' }}
                      >{c.sym}</span>
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

      {cellSel && (() => {
        const cd = depts.find(d => d.key === cellSel.depKey);
        return cd ? <QCCellDetail dep={cd} mk={cellSel.mk} mlabel={cellSel.mlabel} Q={Q} onClose={() => setCellSel(null)} /> : null;
      })()}
    </div>
  );
}

/* Full incident-report drill-down for one department × month — opened by clicking a
   heatmap cell. Lists every indicator reported that month (breaches first) with its
   value vs benchmark, plus the FULL detail of every logged incident / CAPA. */
function QCCellDetail({ dep, mk, mlabel, onClose, Q }){
  const canEdit = qcCanEdit() && !!Q;
  const [editId, setEditId] = useState(null);   // indicator id being edited (null = none)
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { if (editId) setEditId(null); else onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editId]);

  const allInds = dep.indicators || [];
  const rowFor = (ind) => {
    const incsRaw = (ind.incidents && Array.isArray(ind.incidents[mk])) ? ind.incidents[mk] : [];
    const incs = incsRaw.filter(x => x && (x.details || x.finding || x.corrective || x.preventive || x.patientName || x.uhid || x.diagnosis || x.remark));
    return {
      ind, v: monthRaw(ind, mk), s: monthStatus(ind, mk), incs,
      capa: (ind.capa && ind.capa[mk]) ? ind.capa[mk] : null,
      remark: (ind.monthRemarks && ind.monthRemarks[mk]) || ''
    };
  };
  const reported = allInds.map(rowFor).filter(r => r.s !== 'na')
    .sort((a, b) => (a.s === 'breach' ? 0 : 1) - (b.s === 'breach' ? 0 : 1));
  const unreported = allInds.filter(ind => monthStatus(ind, mk) === 'na');
  const breaches = reported.filter(r => r.s === 'breach').length;

  const field = (label, val) => val ? (
    <div style={{ marginBottom: 7 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
      <div style={{ fontSize: 12.5, color: P.ink, whiteSpace: 'pre-wrap' }}>{val}</div>
    </div>
  ) : null;

  const incidentCard = (x, i) => (
    <div key={i} style={{ border: '1px solid #f1c6cd', background: '#fff', borderRadius: 9, padding: '11px 13px', marginTop: 9 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: P.rose, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.3px' }}>Incident {i + 1}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16 }}>
        {field('UHID', x.uhid)}
        {field('Patient', x.patientName)}
        {field('Age / Sex', [x.age, x.gender].filter(Boolean).join(' / '))}
        {field('Diagnosis', x.diagnosis)}
        {field('Date of incident', x.incidentDate)}
        {field('Admission', x.admissionDate)}
        {field('Procedure date', x.procedureDate)}
        {field('Victim (staff)', x.victimName)}
        {field('Victim emp ID / UHID', x.victimId)}
      </div>
      {field('Incident details', x.details)}
      {field('Finding / root cause', x.finding)}
      {field('Corrective action', x.corrective)}
      {field('Preventive action', x.preventive)}
      {field('Remark', x.remark)}
    </div>
  );

  const viewCard = (r) => {
    const isBr = r.s === 'breach';
    const col = isBr ? P.rose : P.green;
    const hasDetail = r.incs.length > 0 || r.capa;
    return (
      <div key={r.ind.id} style={{ border: '1px solid ' + (isBr ? '#f1c6cd' : '#dde3ec'), borderLeft: '4px solid ' + col, borderRadius: 10, padding: '12px 15px', marginBottom: 11, background: isBr ? '#fef6f7' : '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{r.ind.name}</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: col, background: col + '1c', padding: '2px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.3px' }}>{isBr ? 'Breach' : 'On benchmark'}</span>
          <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 14, fontWeight: 700, color: col }}>{fmtVal(r.ind, r.v)}</div>
          <div style={{ fontSize: 11.5, color: P.muted }}>vs {benchExpr(r.ind)}</div>
          {canEdit && <button onClick={() => { setAddOpen(false); setEditId(r.ind.id); }} title="Edit this reading & incident report" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid #cfe6f4', background: '#eef8fc', color: '#0090ca', padding: '4px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>Edit</button>}
        </div>
        {r.remark && <div style={{ fontSize: 12, color: P.ink2, marginTop: 7, fontStyle: 'italic' }}>“{r.remark}”</div>}
        {r.incs.map((x, i) => incidentCard(x, i))}
        {r.incs.length === 0 && r.capa && incidentCard({ details: r.capa.incidentDetails, finding: r.capa.finding, corrective: r.capa.corrective, preventive: r.capa.preventive }, 0)}
        {isBr && !hasDetail && <div style={{ fontSize: 11.5, color: P.muted, marginTop: 8, padding: '8px 10px', background: '#f7f9fc', borderRadius: 7 }}>No incident report logged for this breach.{canEdit ? ' Click Edit to add one.' : ' Add details in Quality Data Entry.'}</div>}
      </div>
    );
  };

  const editIndOf = (id) => allInds.find(i => i.id === id);
  const editing = editId ? editIndOf(editId) : null;
  const editingUnreported = editing && monthStatus(editing, mk) === 'na';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,46,.55)', zIndex: 6000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '38px 16px', overflowY: 'auto' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', width: 'min(760px,100%)', borderRadius: 14, boxShadow: '0 24px 60px rgba(5,12,24,.4)', overflow: 'hidden' }}>
        <div style={{ padding: '15px 20px', borderBottom: '1px solid #e8edf3', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16.5, fontWeight: 700, color: P.ink }}>{dep.name} <span style={{ color: P.muted, fontWeight: 600, fontSize: 13 }}>· {mlabel}</span></div>
            <div style={{ fontSize: 12, color: P.muted, marginTop: 2 }}>
              <b style={{ color: reported.length === allInds.length ? P.green : P.ink2 }}>{reported.length} of {allInds.length}</b> assigned indicator{allInds.length !== 1 ? 's' : ''} submitted · <b style={{ color: breaches ? P.rose : P.green }}>{breaches} breach{breaches !== 1 ? 'es' : ''}</b>
              {canEdit && <span style={{ marginLeft: 8, color: '#0090ca', fontWeight: 700 }}>· admin edit</span>}
            </div>
          </div>
          <button onClick={onClose} title="Close (Esc)" style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 8, border: '1px solid #dde3ec', background: '#fff', color: P.muted, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>
          </button>
        </div>
        <div style={{ padding: '14px 20px 20px', maxHeight: '72vh', overflowY: 'auto' }}>
          {reported.length === 0 && !editing && <div style={{ fontSize: 13, color: P.muted, padding: '24px 0', textAlign: 'center' }}>No indicators were submitted for this month.{canEdit ? ' Click an indicator below to add its reading.' : ''}</div>}

          {reported.map((r) => (editId === r.ind.id
            ? <QCIndEdit key={r.ind.id} dep={dep} ind={r.ind} mk={mk} mlabel={mlabel} Q={Q} onClose={() => setEditId(null)} />
            : viewCard(r)))}

          {/* editing an indicator that had no reading yet (create path) */}
          {editing && editingUnreported && <QCIndEdit key={editing.id} dep={dep} ind={editing} mk={mk} mlabel={mlabel} Q={Q} isNew onClose={() => setEditId(null)} />}

          {/* Which ASSIGNED indicators are still missing this month — always visible so
              the submitted/not-submitted split is explicit; admins click one to add
              its reading (the old collapsed "Add a reading" flow, now one click). */}
          {!editId && unreported.length > 0 && (
            <div style={{ marginTop: 4, border: '1px dashed #b9c6d2', borderRadius: 9, padding: '11px 13px', background: '#f7f9fc' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#b26a0f', textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 7 }}>
                Not submitted for {mlabel} ({unreported.length} of {allInds.length} assigned)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {unreported.map(ind => canEdit
                  ? <button key={ind.id} title={'Add the ' + mlabel + ' reading for ' + ind.name} onClick={() => { setAddOpen(false); setEditId(ind.id); }} style={{ border: '1px solid #cfe6f4', background: '#eef8fc', color: '#0072a3', padding: '6px 11px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>+ {ind.name}</button>
                  : <span key={ind.id} style={{ border: '1px solid #dde3ec', background: '#fff', color: P.muted, padding: '6px 11px', borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>{ind.name}</span>)}
              </div>
              {canEdit && <div style={{ fontSize: 10.5, color: P.muted, marginTop: 8 }}>Click an indicator to add its {mlabel} reading now.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Admin editor for ONE indicator's reading + incident report(s) in a given month.
   Local form state; commits everything at once through Q.patchIndicator (overlay ->
   MongoDB). Handles the value (direct/count) or numerator+denominator (rate/%),
   the month remark, and full CRUD of the incident list. */
function QCIndEdit({ dep, ind, mk, mlabel, Q, isNew, onClose }){
  const isRate = ['pct', 'rate100', 'rate1000', 'avg'].indexOf(ind.formula) >= 0;
  const g = (o, k) => (o && o[k] != null && o[k] !== '') ? String(o[k]) : '';
  const [val, setVal] = useState(() => g(ind.months, mk));
  const [num, setNum] = useState(() => g(ind.mNum, mk));
  const [den, setDen] = useState(() => g(ind.mDen, mk));
  const [remark, setRemark] = useState(() => (ind.monthRemarks && ind.monthRemarks[mk]) || '');
  const [incs, setIncs] = useState(() => (ind.incidents && Array.isArray(ind.incidents[mk])) ? ind.incidents[mk].map(x => Object.assign({}, x)) : []);

  const setF = (i, k, v) => setIncs(a => a.map((x, j) => j === i ? Object.assign({}, x, { [k]: v }) : x));
  const addInc = () => setIncs(a => [...a, { source: 'admin edit' }]);
  const delInc = (i) => setIncs(a => a.filter((_, j) => j !== i));

  const num2 = num === '' ? null : Number(num), den2 = den === '' ? null : Number(den);
  const preview = isRate ? fmtVal(ind, window.qiFormulaCompute(ind.formula, num2 || 0, den2 || 0)) : null;

  const save = () => {
    const patch = { monthRemarks: { [mk]: remark } };
    if (isRate) { patch.mNum = { [mk]: num2 }; patch.mDen = { [mk]: den2 }; }
    else { const v = val === '' ? null : Number(val); patch.months = { [mk]: v }; if (ind.formula === 'count') patch.mNum = { [mk]: v }; }
    const clean = incs.map(x => {
      const o = {}; Object.keys(x).forEach(k => { const s = (x[k] == null ? '' : String(x[k])).trim(); if (s) o[k] = s; });
      return o;
    }).filter(o => Object.keys(o).filter(k => k !== 'source').length);
    patch.incidents = { [mk]: clean };
    Q.patchIndicator(dep.key, ind.id, patch);
    onClose();
  };
  const clearAll = () => {
    Q.patchIndicator(dep.key, ind.id, { months: { [mk]: null }, mNum: { [mk]: null }, mDen: { [mk]: null }, incidents: { [mk]: [] }, monthRemarks: { [mk]: '' } });
    onClose();
  };

  const inp = { width: '100%', padding: '7px 9px', border: '1px solid #dde3ec', borderRadius: 7, fontFamily: 'inherit', fontSize: 12.5, color: P.ink, background: '#fff', outline: 'none', boxSizing: 'border-box' };
  const lbl = { fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 3, display: 'block' };
  const fin = (label, i, k, ta) => (
    <div style={{ marginBottom: 8 }}>
      <label style={lbl}>{label}</label>
      {ta
        ? <textarea value={incs[i][k] || ''} onChange={e => setF(i, k, e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', lineHeight: 1.4 }} />
        : <input type={/date/i.test(k) ? 'date' : 'text'} value={incs[i][k] || ''} onChange={e => setF(i, k, e.target.value)} style={inp} />}
    </div>
  );

  return (
    <div style={{ border: '1.5px solid #27a8db', borderRadius: 11, padding: '13px 15px', marginBottom: 11, background: '#fbfdff', boxShadow: '0 2px 10px rgba(0,144,202,.10)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: P.ink }}>{ind.name}</div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#0090ca', background: '#eef8fc', padding: '2px 9px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.3px' }}>{isNew ? 'New reading' : 'Editing'} · {mlabel}</span>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: P.muted }}>Benchmark {benchExpr(ind)}</div>
      </div>

      {/* value */}
      <div style={{ display: 'grid', gridTemplateColumns: isRate ? '1fr 1fr auto' : '1fr', gap: 12, alignItems: 'end', marginBottom: 11 }}>
        {isRate ? (
          <>
            <div><label style={lbl}>{ind.numLabel || 'Numerator'}</label><input type="number" step="any" value={num} onChange={e => setNum(e.target.value)} style={inp} /></div>
            <div><label style={lbl}>{ind.denLabel || 'Denominator'}</label><input type="number" step="any" value={den} onChange={e => setDen(e.target.value)} style={inp} /></div>
            <div style={{ paddingBottom: 7, fontFamily: MONO, fontSize: 13, fontWeight: 700, color: P.ink }}>= {preview}</div>
          </>
        ) : (
          <div><label style={lbl}>Value</label><input type="number" step="any" value={val} onChange={e => setVal(e.target.value)} style={inp} /></div>
        )}
      </div>
      <div style={{ marginBottom: 12 }}><label style={lbl}>Month remark (optional)</label><input value={remark} onChange={e => setRemark(e.target.value)} style={inp} /></div>

      {/* incidents CRUD */}
      <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '.3px', marginBottom: 6 }}>Incident report(s) · {incs.length}</div>
      {incs.map((x, i) => (
        <div key={i} style={{ border: '1px solid #e3e9f1', borderRadius: 9, padding: '11px 12px', marginBottom: 9, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.rose, textTransform: 'uppercase', letterSpacing: '.3px' }}>Incident {i + 1}</div>
            <button onClick={() => delInc(i)} title="Delete this incident" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #f1c6cd', background: '#fff', color: '#d23a52', padding: '3px 9px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"></path></svg>Delete</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12 }}>
            {fin('Patient name', i, 'patientName')}
            {fin('UHID', i, 'uhid')}
            {fin('Age', i, 'age')}
            {fin('Sex', i, 'gender')}
            {fin('Date of incident', i, 'incidentDate')}
            {fin('Admission date', i, 'admissionDate')}
            {fin('Procedure date', i, 'procedureDate')}
          </div>
          {fin('Diagnosis', i, 'diagnosis', true)}
          {fin('Incident details', i, 'details', true)}
          {fin('Finding / root cause', i, 'finding', true)}
          {fin('Corrective action', i, 'corrective', true)}
          {fin('Preventive action', i, 'preventive', true)}
          {fin('Remark', i, 'remark')}
        </div>
      ))}
      <button onClick={addInc} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px dashed #b9c6d2', background: '#fff', color: P.ink2, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"></path></svg>Add incident</button>

      {/* actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, paddingTop: 12, borderTop: '1px solid #e8edf3' }}>
        <button onClick={save} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 0, background: '#0090ca', color: '#fff', padding: '9px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,144,202,.4)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>Save changes</button>
        <button onClick={onClose} style={{ border: '1px solid #dde3ec', background: '#fff', color: P.ink2, padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        {!isNew && <button onClick={clearAll} title="Delete this month's reading + incidents" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #f1c6cd', background: '#fff', color: '#d23a52', padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"></path></svg>Delete reading</button>}
      </div>
    </div>
  );
}

/* ===== part: mod-scorecard.jsx ===== */
function QCScorecard({depts}){
  const [fy,setFy] = useState(()=>defaultFy(depts));
  const MONTHS = fyAxis(fy);
  const rows = useMemo(()=>{
    return (depts||[]).map(d=>{
      const st = deptStat(d, MONTHS);
      const inds = d.indicators || [];
      const withData = inds.filter(i=>hasData(i, MONTHS)).length;
      const breaches = inds.reduce((a,i)=>a+countBreaches(i, MONTHS),0);
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
  }, [depts, fy]);

  const th = { padding:'10px 12px', fontSize:'10.5px', textTransform:'uppercase', letterSpacing:'.3px', color:P.muted, fontWeight:700, borderBottom:'1px solid '+P.line, background:P.panel2 };

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:'13px',marginBottom:'16px'}}>
        <div style={{width:'40px',height:'40px',borderRadius:'11px',background:'#efeaff',color:P.violet,display:'grid',placeItems:'center',flexShrink:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5zM2 12l10 5 10-5M2 17l10 5 10-5"></path></svg>
        </div>
        <div>
          <h1 style={{margin:0,fontSize:'21px',fontWeight:700,color:P.ink,letterSpacing:'-.3px'}}>Department Scorecard</h1>
          <div style={{fontSize:'12.5px',color:P.muted,marginTop:'2px'}}>Zero-defect performance by department · {fyLabelOf(fy)}</div>
        </div>
        <span style={{flex:1}}/>
        <QCFyPicker fy={fy} setFy={setFy} depts={depts}/>
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
  const [fy, setFy] = useState(()=>defaultFy(depts));
  const MONTHS = fyAxis(fy);

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
  }, [tInd, fy]);

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
          <div style={{ fontSize: 12.5, color: P.muted, marginTop: 2 }}>12-month trend for a single indicator, against its benchmark · {fyLabelOf(fy)}</div>
        </div>
        <QCFyPicker fy={fy} setFy={setFy} depts={depts} style={{padding:'8px 11px'}}/>
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
/* ---- export helpers (self-contained; incident details included) ---- */
function qcEsc(s){ return ((s==null?'':s)+'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function qcDownload(content, filename, mime){
  try{ const blob=new Blob([content],{type:mime}); const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{document.body.removeChild(a);}catch(e){} URL.revokeObjectURL(url); },600);
  }catch(e){}
}
// Every logged incident (with its full detail fields) for a department.
function qcIncidentsOf(d){
  const out=[];
  // Iterate the indicator's OWN incident month keys (not a fixed fiscal-year axis) so incidents
  // in ANY year are surfaced; callers filter with qcIncInPeriod for their selected period.
  // Legacy records can be keyed by QUARTER ('Q1'..'Q4') instead of month — carry the
  // quarter on `q` and label it readably instead of a bare 'Q1' that no filter matched.
  (d.indicators||[]).forEach(ind=>{ const incs=ind.incidents||{}; Object.keys(incs).forEach(mk=>{ const arr=incs[mk];
    const isQ=/^Q[1-4]$/.test(mk);
    if(Array.isArray(arr)) arr.forEach(x=>{ if(x && (x.details||x.finding||x.corrective||x.preventive||x.patientName||x.uhid||x.victimName||x.victimId)) out.push({ind:ind.name, month:isQ?qtrLabelOf(mk):qcMonthLabel(mk), q:isQ?mk:null, x:x}); }); }); });
  return out;
}
/* Incident-in-period test shared by EVERY report surface (dept pages, heatmap, appendix,
   CSV/Excel/Word). Month-keyed records match by month label; legacy quarter-keyed records
   match when the period spans that quarter — they used to be silently dropped from every
   report and export because 'Q1' never equals a month label. */
function qcIncInPeriod(r, months){
  if(!months || !months.length) return true;
  if(r.q) return months.some(m=>m[2]===r.q);
  return months.some(m=>m[1]===r.month);
}
// Full multi-department report HTML (tables + incident details).
// `months`/`fyIn` parameterize the axis (the Report Builder passes ITS selected year and
// period — this used to recompute defaultFy and export a different year than the header
// claimed); `opts.noTitle` suppresses the internal H1 when the caller renders its own.
function qcReportHTML(depts, months, fyIn, opts){
  const o=opts||{};
  const date=new Date().toISOString().slice(0,10);
  const fy=(fyIn!=null)?fyIn:defaultFy(depts);
  const MONTHS=(Array.isArray(months)&&months.length)?months:fyAxis(fy);
  let body=o.noTitle?'':('<h1 style="font-family:Calibri,Arial;color:#0072a3;margin:0 0 2px">UNICO Hospitals — Quality Indicator Report</h1>'
    +'<div style="font-family:Calibri;color:#555;margin-bottom:12px">'+fyLabelOf(fy)+' · '+MONTHS[0][1]+' - '+MONTHS[MONTHS.length-1][1]+' · generated '+date+' · Confidential</div>');
  depts.forEach(d=>{
    const st=deptStat(d, MONTHS);
    body+='<h2 style="font-family:Calibri;color:#16202e;margin:16px 0 3px">'+qcEsc(d.name)+'</h2>'
      +'<div style="font-family:Calibri;color:#555;margin-bottom:6px">Zero-defect: <b>'+st.rate+'%</b> · Breaches: <b style="color:#d23a52">'+st.breach+'</b> · Indicators: '+((d.indicators||[]).length)+'</div>';
    const th=['Indicator','Benchmark'].concat(MONTHS.map(m=>m[1].split(' ')[0])).map(h=>'<th style="background:#0090ca;color:#fff;border:1px solid #2b6f9c;padding:5px 7px;font-family:Calibri;font-size:10.5pt;text-align:left">'+h+'</th>').join('');
    const trs=(d.indicators||[]).map((ind,i)=>{
      // month value with the same quarter fallback the on-screen pages use
      const cells=[qcEsc(ind.name), qcEsc(benchExpr(ind))].concat(MONTHS.map(m=>{ const v=qcCellVal(ind,m); const s=qStatus(ind,v); const disp=s==='na'?'—':fmtVal(ind,v); const col=s==='breach'?'#d23a52':s==='ok'?'#1f9d57':'#9aa6b4'; return '<span style="color:'+col+';font-weight:600">'+qcEsc(disp)+'</span>'; }));
      return '<tr style="background:'+(i%2?'#eef6fb':'#fff')+'">'+cells.map((c,ci)=>'<td style="border:1px solid #b9c6d2;padding:4px 7px;font-family:Calibri;font-size:10pt;'+(ci>1?'text-align:center':'')+'">'+c+'</td>').join('')+'</tr>';
    }).join('');
    body+='<table border="1" style="border-collapse:collapse"><thead><tr>'+th+'</tr></thead><tbody>'+trs+'</tbody></table>';
    const inc=qcIncidentsOf(d).filter(r=>qcIncInPeriod(r,MONTHS));
    if(inc.length){
      body+='<h3 style="font-family:Calibri;color:#b32339;margin:12px 0 3px">Incident details ('+inc.length+')</h3>';
      const ith=['Indicator','Month','Date of incident','UHID','Patient','Age/Sex','Incident details','Finding','Corrective action','Preventive action'].map(h=>'<th style="background:#d23a52;color:#fff;border:1px solid #a02a3c;padding:5px 7px;font-family:Calibri;font-size:9.5pt;text-align:left">'+h+'</th>').join('');
      const itrs=inc.map((r,i)=>{ const x=r.x; const cols=[r.ind, r.month, x.incidentDate||'', x.uhid||'', x.patientName||'', ((x.age||'')+(x.gender?(' / '+x.gender):'')), x.details||'', x.finding||'', x.corrective||'', x.preventive||'']; return '<tr style="background:'+(i%2?'#fbeef0':'#fff')+'">'+cols.map(c=>'<td style="border:1px solid #e0b6bf;padding:4px 7px;font-family:Calibri;font-size:9pt;vertical-align:top">'+qcEsc(c)+'</td>').join('')+'</tr>'; }).join('');
      body+='<table border="1" style="border-collapse:collapse;margin-top:2px"><thead><tr>'+ith+'</tr></thead><tbody>'+itrs+'</tbody></table>';
    }
  });
  return body;
}
function qcExport(depts, fmt){
  const date=new Date().toISOString().slice(0,10); const base='UNICO-Quality-Report-'+date;
  const MONTHS=fyAxis(defaultFy(depts));
  if(fmt==='csv'){
    const rows=[['Department','Indicator','Benchmark','Goal'].concat(MONTHS.map(m=>m[1]))];
    depts.forEach(d=>(d.indicators||[]).forEach(ind=>{ rows.push([d.name, ind.name, benchExpr(ind), ind.goalDirection==='higher_is_better'?'higher is better':'lower is better'].concat(MONTHS.map(m=>{ const v=qcCellVal(ind,m); return qStatus(ind,v)==='na'?'':fmtVal(ind,v); }))); }));
    rows.push([]); rows.push(['INCIDENT DETAILS']); rows.push(['Department','Indicator','Month','Date of incident','UHID','Patient','Age','Sex','Diagnosis','Details','Finding','Corrective','Preventive']);
    depts.forEach(d=>qcIncidentsOf(d).filter(r=>qcIncInPeriod(r,MONTHS)).forEach(r=>{ const x=r.x; rows.push([d.name, r.ind, r.month, x.incidentDate||'', x.uhid||'', x.patientName||'', x.age||'', x.gender||'', x.diagnosis||'', x.details||'', x.finding||'', x.corrective||'', x.preventive||'']); }));
    qcDownload('﻿'+rows.map(r=>r.map(c=>'"'+((c==null?'':c)+'').replace(/"/g,'""')+'"').join(',')).join('\r\n'), base+'.csv','text/csv;charset=utf-8'); return;
  }
  const html='<html xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:A4 landscape;margin:1cm}</style></head><body>'+qcReportHTML(depts)+'</body></html>';
  if(fmt==='excel') return qcDownload(html, base+'.xls','application/vnd.ms-excel');
  if(fmt==='word') return qcDownload(html, base+'.doc','application/msword');
  if(fmt==='pdf'){
    const root=typeof document!=='undefined'?document.getElementById('pdf-root'):null; const native=window.unicoNative;
    if(!root){ try{window.print();}catch(e){} return; }
    root.innerHTML='<div class="pdf-page" style="padding:9mm 10mm;font-family:Calibri,Arial">'+qcReportHTML(depts)+'</div>';
    document.body.classList.add('pdf-export-mode');
    const done=()=>{ root.innerHTML=''; document.body.classList.remove('pdf-export-mode'); };
    if(native&&typeof native.exportPDF==='function'){ Promise.resolve(native.exportPDF({pageSize:'A4',landscape:true,defaultName:base})).catch(()=>{}).then(done); }
    else { try{window.print();}catch(e){} setTimeout(done,700); }
  }
}
/* ---- inline charts (self-contained SVG, console palette) ---- */
function QCDonut({rate,size=118}){
  const r=size/2-11, c=2*Math.PI*r, on=Math.max(0,Math.min(100,rate)); const col=on>=90?P.green:on>=70?P.amber:P.rose;
  return (<svg width={size} height={size} viewBox={'0 0 '+size+' '+size}>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={P.line2} strokeWidth="12"/>
    <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="12" strokeLinecap="round" strokeDasharray={(c*on/100)+' '+c} transform={'rotate(-90 '+(size/2)+' '+(size/2)+')'}/>
    <text x="50%" y="47%" textAnchor="middle" fontFamily={MONO} fontSize="19" fontWeight="700" fill={P.ink}>{on}%</text>
    <text x="50%" y="61%" textAnchor="middle" fontSize="8.5" fill={P.faint}>on benchmark</text>
  </svg>);
}
function QCMonthBars({inds}){
  const data=MONTHS.map(m=>({label:m[1].split(' ')[0], v: inds.reduce((n,ind)=> n+(monthStatus(ind,m[0])==='breach'?1:0),0)}));
  const max=Math.max(1,...data.map(d=>d.v));
  return (<div style={{display:'flex',alignItems:'flex-end',gap:5,height:118}}>
    {data.map((d,i)=>(<div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,height:'100%',justifyContent:'flex-end'}}>
      <span style={{fontSize:8.5,fontFamily:MONO,color:d.v?P.rose:P.faint}}>{d.v||''}</span>
      <div title={d.label+': '+d.v} style={{width:'100%',maxWidth:22,background:d.v?P.rose:P.line2,borderRadius:'3px 3px 0 0',height:(d.v/max*100)+'%',minHeight:3}}/>
      <span style={{fontSize:8,color:P.faint}}>{d.label}</span>
    </div>))}
  </div>);
}
function QCSpark({ind,months,w=92,h=24}){
  months = months || MONTHS;
  const vals=months.map(m=>monthRaw(ind,m[0])); const nums=vals.filter(v=>v!=null);
  if(!nums.length) return <span style={{color:P.faint,fontSize:10,fontFamily:MONO}}>—</span>;
  const mn=Math.min(...nums), mx=Math.max(...nums), rng=(mx-mn)||1;
  const pts=vals.map((v,i)=>({x:(i/(months.length-1))*w, y: v==null?null:(h-2-((v-mn)/rng)*(h-4))}));
  const path=pts.filter(p=>p.y!=null).map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
  const breach=months.some(m=>monthStatus(ind,m[0])==='breach'); const col=breach?P.rose:P.green;
  return (<svg width={w} height={h}><path d={path} fill="none" stroke={col} strokeWidth="1.5"/>{pts.map((p,i)=>p.y!=null&&<circle key={i} cx={p.x} cy={p.y} r="1.5" fill={col}/>)}</svg>);
}
/* ============================================================================
   QC REPORT BUILDER — the Reports view. A statistics-Report-Builder (reports.jsx)
   clone powered by QUALITY data. REPLACES the old QCReports. Both mount sites
   (QualityView, QualityConsole) keep working via the QCReports alias at the end.
   NOTE: chart components + PALETTE live in other per-file IIFEs, so they are
   consumed via window.* (bare names do NOT resolve across build-renderer bundling).
   ============================================================================ */
const QC_PAGE_SIZES={A4:[700,1.414],A3:[815,1.414],Letter:[700,1.294]};
/* Paginated preview: render the report page once (hidden) to MEASURE its height, then tile it
   into N fixed A4 sheets. Each sheet clips to A4 and shows one usable-page slice via translateY,
   so tall departments break across real A4 pages on screen (matches the sliced PDF export). */
function QCPagedPreview({pageW, pageMinH, children}){
  const ref=React.useRef(null);
  const [starts,setStarts]=React.useState([0]);
  const [foot,setFoot]=React.useState(null);           // [top,bottom] of .pdf-foot in content coords
  const usableH=Math.max(240, pageMinH-56);            // A4 minus top+bottom padding (28+28)
  React.useLayoutEffect(()=>{
    const root=ref.current; if(!root) return;
    const H=root.scrollHeight, rootTop=root.getBoundingClientRect().top;
    // Atomic blocks that must never be split across a page: charts, tables, and anything
    // marked page-break-inside:avoid (incident cards, KPI/definition/CAPA blocks, etc.).
    const atoms=[]; const push=el=>{ const r=el.getBoundingClientRect(); const t=r.top-rootTop, b=r.bottom-rootTop; if(r.height>4 && r.height<=usableH) atoms.push([t,b]); };
    // .pdf-foot + .qc-band included: the footer band ('Page n of N') and section headers
    // are small plain divs the old scan didn't protect, so a break could land mid-footer.
    root.querySelectorAll('svg,table,tr,.pdf-foot,.qc-band').forEach(push);
    root.querySelectorAll('*').forEach(el=>{ const s=el.getAttribute('style'); if(s && s.indexOf('break-inside')>=0) push(el); });
    // page-footer band — the last sheet pins it to the sheet bottom instead of letting it flow
    const fEl=root.querySelector('.pdf-foot'); let f=null;
    if(fEl){ const r=fEl.getBoundingClientRect(); if(r.height>0 && r.height<=usableH) f=[r.top-rootTop, r.bottom-rootTop]; }
    const st=[0]; let s=0, guard=0;
    while(s+usableH < H-2 && guard++<80){
      let brk=s+usableH;                                  // default: fill the page
      atoms.forEach(([t,b])=>{ if(t>s+8 && brk>t && brk<b) brk=Math.min(brk,t); }); // pull break up to a block top
      if(brk<=s+8) brk=s+usableH;                         // block taller than a page -> hard cut
      st.push(brk); s=brk;
    }
    if(st.length!==starts.length || st.some((v,i)=>Math.abs(v-(starts[i]||0))>2)) setStarts(st);
    if((f?1:0)!==(foot?1:0) || (f&&foot&&(Math.abs(f[0]-foot[0])>2||Math.abs(f[1]-foot[1])>2))) setFoot(f);
  });
  const frame={background:'#fff',borderRadius:4,boxShadow:'0 4px 18px rgba(0,0,0,.12)',width:pageW,height:pageMinH,boxSizing:'border-box',padding:'28px 30px',margin:'0 auto 18px',overflow:'hidden',position:'relative'};
  const n=starts.length;
  return (
    <div>
      {/* hidden measurer at the same content width as a sheet */}
      <div ref={ref} aria-hidden="true" style={{position:'absolute',left:-99999,top:0,visibility:'hidden',pointerEvents:'none',width:pageW,boxSizing:'border-box',padding:'0 30px'}}>{children}</div>
      {starts.map((s0,k)=>{
        const last=k===n-1;
        // The last sheet clips the in-flow footer OUT of the content window and re-renders
        // it pinned to the sheet bottom, so it never floats mid-page after short content.
        const pin=last && foot && foot[0]>=s0-2;
        const footH=pin?Math.max(0,foot[1]-foot[0]):0;
        const cut=last?(pin?foot[0]:s0+usableH):starts[k+1];
        // Exact-window clip per sheet: the frame-level clip alone let content bleed into the
        // 28px paddings, so everything between a pulled-up break and the fill line rendered
        // on BOTH the bottom of one sheet and the top of the next (duplicated sections).
        const mainH=Math.max(0, Math.min(cut-s0, usableH-footH));
        return (
          <div key={k} style={frame}>
            <div style={{overflow:'hidden',height:mainH}}>
              <div style={{transform:'translateY('+(-s0)+'px)'}}>{children}</div>
            </div>
            {pin&&<div style={{position:'absolute',left:30,right:30,bottom:28,overflow:'hidden',height:footH}}>
              <div style={{transform:'translateY('+(-foot[0])+'px)'}}>{children}</div>
            </div>}
            {n>1&&<div style={{position:'absolute',right:9,bottom:5,fontSize:9,color:'#aeb7c2',fontFamily:MONO}}>{(k+1)+' / '+n}</div>}
          </div>
        );
      })}
    </div>
  );
}
const QC_CHART_STYLE_LABEL={bar3d:'3D Bars',bar:'Bar',line:'Line',area:'Area + Benchmark',combo:'Bar + Line',grouped:'Grouped',stacked:'Stacked',pct:'100% Stacked',horizontal:'Horizontal',donut:'Composition'};
const QC_REPORT_STYLES=[['bar3d','3D'],['bar','Bar'],['line','Line'],['area','Area'],['combo','Bar+Line'],['grouped','Grouped'],['stacked','Stacked'],['pct','100%'],['horizontal','Horizontal'],['donut','Donut']];

/* Report templates — each is a full `sections` preset plus the report type it forces.
   Booleans are stored 1/0 here purely for brevity; applyTemplate coerces to real
   booleans (!!) before writing them into `sections` state (never 1/0 in state). */
const QC_TEMPLATES = {
  board:   { label:'Board Report',        type:'summary',
    sec:{execSummary:1,kpis:1,chart:1,breachDonut:1,table:1,incidents:0,indicatorDetail:0,
         ragHeatmap:1,deptRanking:1,benchmarkCompare:0,indTrend:0,
         incidentAppendix:0,standardsRefs:0,
         cover:1,toc:1,periodCompare:1,watermark:1,signatures:1} },
  nabh:    { label:'NABH/JCI Accreditation', type:'detail',
    sec:{execSummary:1,kpis:1,chart:1,breachDonut:0,table:1,incidents:1,indicatorDetail:1,
         ragHeatmap:1,deptRanking:0,benchmarkCompare:1,indTrend:1,
         incidentAppendix:1,standardsRefs:1,
         cover:1,toc:1,periodCompare:0,watermark:1,signatures:1} },
  exec:    { label:'Executive Summary',   type:'summary',
    sec:{execSummary:1,kpis:1,chart:0,breachDonut:0,table:0,incidents:0,indicatorDetail:0,
         ragHeatmap:1,deptRanking:1,benchmarkCompare:0,indTrend:0,
         incidentAppendix:0,standardsRefs:0,
         cover:1,toc:0,periodCompare:1,watermark:1,signatures:1} },
  incident:{ label:'Incident-CAPA',       type:'summary',
    sec:{execSummary:1,kpis:0,chart:0,breachDonut:1,table:0,incidents:1,indicatorDetail:0,
         ragHeatmap:0,deptRanking:0,benchmarkCompare:0,indTrend:0,
         incidentAppendix:1,standardsRefs:1,
         cover:1,toc:1,periodCompare:0,watermark:1,signatures:1} },
  full:    { label:'Full Detailed',       type:'detail',
    sec:{execSummary:1,kpis:1,chart:1,breachDonut:1,table:1,incidents:1,indicatorDetail:1,
         ragHeatmap:1,deptRanking:1,benchmarkCompare:1,indTrend:1,
         incidentAppendix:1,standardsRefs:1,
         cover:1,toc:1,periodCompare:1,watermark:1,signatures:1} },
};

/* palette cycle (window.PALETTE from charts.jsx; local fallback so a missing global never throws) */
const QC_PAL = (typeof window!=='undefined' && window.PALETTE) || ['#0b66d0','#0f9b8e','#e08a1e','#6a52d4','#d23a52','#2bb3a3','#8a93a3','#4f8df7','#1f9d57','#c2486f'];
function qcTone(d){ const k=(d&&d.key)||''; return QC_PAL[(k.charCodeAt(0)||0)%QC_PAL.length]; }

/* One value per month over the given axis, month fallback -> quarter (seed is quarter-only). */
function qcMonthVals(ind, months){
  months = months || MONTHS;
  return months.map(m=>qcCellVal(ind,m));
}
/* Rows shaped for the window.* charts: {mon, mfull, q, val, has, bench}. */
function qcChartRows(ind, months){
  months = months || MONTHS;
  const bench=(ind.benchmarkValue==null||ind.benchmarkValue==='')?null:Number(ind.benchmarkValue);
  const vals=qcMonthVals(ind, months);
  return months.map((m,i)=>{ const v=vals[i]; return {mon:m[1].split(' ')[0], mfull:m[1], q:m[2], val:v==null?0:v, has:v!=null, bench}; });
}
/* Representative indicator for a department: worst-performing with data, else first with data, else [0].
   `months` = the REPORT's axis — without it this judged "has data"/"worst" against the
   current calendar year, so past-year reports charted the wrong indicator. */
function qcLeadIndicator(d, months){
  const withData=(d.indicators||[]).filter(i=>hasData(i, months));
  if(!withData.length) return (d.indicators||[])[0]||null;
  return withData.slice().sort((a,b)=>countBreaches(b, months)-countBreaches(a, months))[0];
}
/* Per-department derived status (QCDashboard L352-355, verbatim logic). */
function qcDeptStatus(d, months){
  const st=deptStat(d, months); const brRate=(st.ok+st.breach)?st.breach/(st.ok+st.breach):0;
  const status=brRate>0.16?'Needs Improvement':brRate>0.06?'Good':'Excellent';
  return {status, color:statusColorFor(status), st};
}
/* Up-to-6 indicators with data ON THE GIVEN AXIS, shaped as chart series ({id,key,label,color}). */
function qcIndSeries(d, months){
  return (d.indicators||[]).filter(i=>hasData(i, months)).slice(0,6)
    .map((ind,i)=>({id:'i'+i, key:'i'+i, label:ind.name, color:QC_PAL[i%QC_PAL.length]}));
}
/* One row per month, one column per (up-to-6) indicator — for grouped/stacked/pct charts. */
function qcDeptCompareRows(d, months){
  months = months || MONTHS;
  const inds=(d.indicators||[]).filter(i=>hasData(i, months)).slice(0,6);
  return months.map((m,mi)=>{ const row={mon:m[1].split(' ')[0]};
    inds.forEach((ind,i)=>{ row['i'+i]=qcMonthVals(ind, months)[mi]||0; }); return row; });
}
/* Breach composition per indicator (donut slices) over the given report axis. */
function qcDonutData(d, months){
  return (d.indicators||[]).map((ind,i)=>({label:ind.name, value:countBreaches(ind, months), color:QC_PAL[i%QC_PAL.length]})).filter(x=>x.value>0);
}
/* Status composition (on-benchmark / breach / not-reported indicator-months) — always has
   slices, so a pie can render even for a zero-defect (no-breach) department. */
function qcStatusComp(d, months){
  const st=deptStat(d, months);
  return [
    {label:'On benchmark', value:st.ok||0, color:'#2fb56a'},
    {label:'Breaches', value:st.breach||0, color:'#e2445c'},
    {label:'Not reported', value:st.na||0, color:'#c3ccd8'},
  ].filter(x=>x.value>0);
}
/* Chart dispatcher — every element uses window.* (cross-IIFE) + flat for print. */
function qcChartEl(d, style, ind, tone, months){
  months = months || MONTHS;
  if(!ind) return <div style={{height:150,display:'grid',placeItems:'center',color:P.faint,fontSize:12}}>No data</div>;
  const rows=qcChartRows(ind, months); const bench=rows.length?rows[0].bench:null;
  const W=window;
  if(style==='bar')  return W.BarChart({data:rows, x:'mon', y:'val', height:195, color:tone, flat:true});
  if(style==='line') return W.LineChart({data:rows, x:'mon', y:'val', height:195, color:tone, area:false, flat:true});
  if(style==='area') return bench!=null ? W.AreaTargetChart({data:rows, x:'mon', y:'val', target:bench, height:195, color:tone, flat:true})
                                        : W.LineChart({data:rows, x:'mon', y:'val', height:195, color:tone, area:true, flat:true});
  if(style==='combo') return W.ComboChart({data:rows, x:'mon', barKey:'val', lineKey:'bench', barColor:tone, lineColor:P.amber, barLabel:ind.name, lineLabel:'Benchmark', height:210, flat:true});
  if(style==='grouped'){ const sr=qcIndSeries(d, months); return sr.length>1 ? W.GroupedBar({data:qcDeptCompareRows(d, months), x:'mon', series:sr, height:210}) : W.BarChart({data:rows, x:'mon', y:'val', height:195, color:tone, flat:true}); }
  if(style==='stacked'){ const sr=qcIndSeries(d, months); return sr.length>1 ? W.StackedBar({data:qcDeptCompareRows(d, months), x:'mon', series:sr, height:210}) : W.BarChart({data:rows, x:'mon', y:'val', height:195, color:tone, flat:true}); }
  if(style==='pct'){ const sr=qcIndSeries(d, months); return sr.length>1 ? W.StackedPctBar({data:qcDeptCompareRows(d, months), x:'mon', series:sr, height:210, flat:true}) : W.BarChart({data:rows, x:'mon', y:'val', height:195, color:tone, flat:true}); }
  if(style==='horizontal'){ const vals=qcMonthVals(ind, months); return W.HBar({rows:months.map((m,i)=>({label:m[1], value:vals[i]||0, color:tone})), height:Math.max(150,months.length*22)}); }
  if(style==='donut'){ const dd=qcDonutData(d, months); const pie=dd.length>1?dd:qcStatusComp(d, months);
      return <div style={{display:'grid',placeItems:'center',minHeight:205}}>{W.Donut({data:pie, size:188, centerValue:pie.reduce((s,x)=>s+x.value,0), centerLabel:dd.length>1?'Breaches':'Ind-months', flat:true})}</div>; }
  // bar3d + default — multi:true colors each MONTH separately (matches the stats reports)
  return W.Bar3D({data:rows, x:'mon', y:'val', height:205, color:tone, multi:true, flat:true});
}

/* Department-level KPI cards (Summary page + Compare rows) — mirrors QCDashboard L313-318. */
function qcDeptKpis(d, months){
  const st=deptStat(d, months);
  const inds=(d.indicators||[]);
  const breaches=st.breach;
  const reported=(st.ok+st.breach)>0;
  let latest='—', latestStatus='na';
  for(let i=months.length-1;i>=0;i--){ const m=months[i];
    const rep=inds.some(ind=>monthStatus(ind,m[0])!=='na');
    if(rep){ latest=m[1]; latestStatus=inds.some(ind=>monthStatus(ind,m[0])==='breach')?'breach':'ok'; break; } }
  // A fully-unreported period must not read as a triumphant "100% · 0 breaches".
  if(!reported) return [
    ['Zero-Defect %', '—',                 P.faint, 'no data reported this period'],
    ['Breaches',      '—',                 P.faint, 'no data reported this period'],
    ['Indicators',    String(inds.length), P.violet, 'reporting quality KPIs'],
    ['Latest',        '—',                 P.faint, 'no reported month in this period'],
  ];
  return [
    ['Zero-Defect %', st.rate+'%',         st.rate>=90?P.green:st.rate>=70?P.amber:P.rose, st.ok+' on benchmark · '+breaches+' breaches'],
    ['Breaches',      String(breaches),    breaches>0?P.rose:P.green, 'indicator-months off benchmark'],
    ['Indicators',    String(inds.length), P.violet, 'reporting quality KPIs'],
    ['Latest',        latest.split(' ')[0]+' '+(latestStatus==='breach'?'✕':latestStatus==='ok'?'✓':'·'), statusColorFor(latestStatus==='breach'?'Needs Improvement':latestStatus==='ok'?'Excellent':''), 'most recent reported month'],
  ];
}
/* Indicator-level KPI cards (Detailed page) — LATEST / TOTAL|AVG / PEAK|WORST / BREACHES. */
function qcIndKpis(ind, months){
  // Display axis: per-month values with quarter fill (for Latest). Aggregation uses a
  // DEDUPED series — a quarter rollup covers 3 months and must be totalled/averaged once,
  // and only for quarters with no monthly entries (else Q1=2 reported "YTD Total 6").
  const vals=months.map(m=>qcCellVal(ind,m));
  const qHasMonth={}; months.forEach(m=>{ if(monthRaw(ind,m[0])!=null) qHasMonth[fyOfKey(m[0])+':'+m[2]]=true; });
  const qUsed=new Set();
  const agg=[]; months.forEach(m=>{
    const mv=monthRaw(ind,m[0]);
    if(mv!=null){ agg.push(mv); return; }
    const qk=fyOfKey(m[0])+':'+m[2];
    if(qHasMonth[qk]||qUsed.has(qk)) return;
    const qv=qtrRaw(ind,m[2],fyOfKey(m[0]));
    if(qv!=null){ qUsed.add(qk); agg.push(qv); }
  });
  let lastIdx=-1; for(let i=vals.length-1;i>=0;i--){ if(vals[i]!=null){ lastIdx=i; break; } }
  const latest = lastIdx<0?null:vals[lastIdx];
  const total  = agg.reduce((s,v)=>s+v,0);
  const higher = ind.goalDirection==='higher_is_better';
  const peak   = agg.length ? (higher?Math.min.apply(null,agg):Math.max.apply(null,agg)) : null;
  const avg    = agg.length ? total/agg.length : null;
  const event  = isEventIndicator(ind);
  const isRateF= ['pct','rate100','rate1000','avg'].indexOf(ind.formula)>=0 || isPctInd(ind);
  const cards=[['Latest', latest==null?'—':fmtVal(ind,latest), statusColorFor(qStatus(ind,latest)==='breach'?'Poor':qStatus(ind,latest)==='ok'?'Excellent':''), benchExpr(ind)]];
  if(event && !isRateF){ cards.push(['YTD Total', fmtVal(ind,total), P.blue, 'summed over period']); cards.push(['Peak (worst)', peak==null?'—':fmtVal(ind,peak), P.amber, 'worst month']); }
  else if(event){
    // Rate-formula event indicator (e.g. falls per 1000 patient-days): summing monthly
    // RATES is meaningless — total the recorded event NUMERATORS instead.
    let ev=0, hasEv=false; months.forEach(m=>{ const n=ind.mNum&&ind.mNum[m[0]]; if(n!=null&&n!==''){ ev+=Number(n)||0; hasEv=true; } });
    cards.push(['Total events', hasEv?String(ev):'—', P.blue, hasEv?'numerator sum over period':'no event counts recorded']);
    cards.push(['Peak (worst)', peak==null?'—':fmtVal(ind,peak), P.amber, 'worst month']);
  }
  else     { cards.push(['Average', avg==null?'—':fmtVal(ind,avg), P.blue, 'mean over period']); cards.push(['Worst', peak==null?'—':fmtVal(ind,peak), P.amber, higher?'lowest month':'highest month']); }
  cards.push(['Breaches', String(countBreaches(ind, months)), countBreaches(ind, months)>0?P.rose:P.green, 'months off benchmark']);
  return cards;
}

/* ---- Year-wise status heatmap (indicator × month), legend + auto incident block ---- */
function qcHeatColors(s){
  if(s==='breach') return {bg:P.rose, col:'#fff'};
  if(s==='ok')     return {bg:'#e7f6ed', col:P.green};
  return {bg:'#f1f4f8', col:P.faint};
}
// Year-wise aggregate of ONE indicator over a set of report months, for the
// indicator × department heatmap matrix. Count/direct → SUM (total incidence);
// rate/% → annual rate (Σnum/Σden, else average of reported months). Status is
// "breach" if ANY month breached, else "ok" if any reported, else "na".
function qcAnnualCell(ind, months){
  const rate = ['pct','rate100','rate1000','avg'].indexOf(ind.formula) >= 0 || isPctInd(ind);
  let anyRep=false, anyBreach=false, sum=0, num=0, den=0, valSum=0, nRep=0;
  const axis = months||MONTHS;
  // A quarter rollup covers 3 months: it must contribute ONCE per quarter, and ONLY for
  // quarters with no monthly entries at all — otherwise a quarter-only "Q1 = 5" summed
  // once per gap month reported 15, and partially-reported quarters double-counted.
  const qHasMonth = {}; axis.forEach(m=>{ if(monthRaw(ind, m[0])!=null) qHasMonth[fyOfKey(m[0])+':'+m[2]] = true; });
  const qUsed = new Set();
  axis.forEach(m=>{
    let v = monthRaw(ind, m[0]);
    if(v==null){
      const qk = fyOfKey(m[0])+':'+m[2];
      if(qHasMonth[qk] || qUsed.has(qk)) return;
      v = qtrRaw(ind, m[2], fyOfKey(m[0]));
      if(v==null || v==='') return;
      qUsed.add(qk);
    }
    if(v==null || v==='') return;
    anyRep=true; if(qStatus(ind, v)==='breach') anyBreach=true;
    if(rate){ nRep++; valSum += Number(v)||0;
      const n = ind.mNum && ind.mNum[m[0]], d = ind.mDen && ind.mDen[m[0]];
      if(n!=null && n!=='' && d!=null && d!=='') { num += Number(n)||0; den += Number(d)||0; }
    } else sum += Number(v)||0;
  });
  if(!anyRep) return { rep:false, status:'na', value:null, count:0, isRate:rate, num:0, den:0 };
  const value = rate
    ? (den>0 ? window.qiFormulaCompute(ind.formula||'pct', num, den) : (nRep ? Math.round(valSum/nRep*100)/100 : 0))
    : sum;
  // num/den exposed so callers can pool a period rate across departments (Σnum/Σden).
  return { rep:true, status: anyBreach?'breach':'ok', value, count: rate?0:sum, isRate:rate, num, den };
}
function QCHeatGrid({d, months}){
  months = months || MONTHS;
  const inds=(d.indicators||[]);
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse',width:'100%',maxWidth:'100%',tableLayout:'fixed'}}>
        <thead><tr>
          <th style={{width:160,textAlign:'left',padding:'6px 8px',fontSize:9,color:P.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:'.3px',borderBottom:'1px solid '+P.line}}>Indicator</th>
          {months.map(m=>{ const p=m[0].split('-'); return <th key={m[0]} style={{padding:'6px 2px',fontSize:8.5,color:P.muted,fontWeight:700,textAlign:'center',borderBottom:'1px solid '+P.line}}><div>{p[0]}</div><div style={{fontWeight:400,fontSize:'.82em',opacity:.55}}>{"'"+p[1]}</div></th>; })}
        </tr></thead>
        <tbody>{inds.length===0
          ? <tr><td colSpan={months.length+1} style={{padding:14,textAlign:'center',color:P.faint,fontSize:11}}>No indicators assigned.</td></tr>
          : inds.map(ind=>(
          <tr key={ind.id}>
            <td style={{padding:'3px 8px',textAlign:'left',fontWeight:600,color:P.ink,fontSize:9.5}}>{ind.name} <span style={{color:P.faint,fontWeight:400}}>{ind.goalDirection==='higher_is_better'?'↑':'↓'}</span></td>
            {months.map(m=>{ const v=qcCellVal(ind,m); const s=qStatus(ind,v); const c=qcHeatColors(s);
              return <td key={m[0]} style={{padding:'3px 2px',textAlign:'center'}}><span title={ind.name+' · '+m[1]+' · '+(s==='na'?'not reported':s==='breach'?'breach':'on benchmark')} style={{display:'inline-grid',placeItems:'center',minWidth:22,height:24,borderRadius:5,background:c.bg,color:c.col,fontFamily:MONO,fontWeight:700,fontSize:9.5}}>{s==='na'?'·':fmtVal(ind,v)}</span></td>;
            })}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
function QCHeatLegend(){
  const item=(bg,txt)=>(<span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,color:P.muted}}><span style={{width:13,height:13,borderRadius:3,background:bg,border:'1px solid '+P.line2}}/>{txt}</span>);
  return <div style={{display:'flex',gap:16,flexWrap:'wrap',margin:'2px 0 8px'}}>{item('#e7f6ed','on benchmark')}{item(P.rose,'breach')}{item('#f1f4f8','not reported')}</div>;
}
// Auto-included occurred-incident details for a department (filtered to the period).
/* Full occurred-incident detail card — renders the COMPLETE incident record (every field
   captured in Incident Reports: identifiers + dates + narrative) so NO detail is dropped
   anywhere the report lists incidents. Pure/prop-driven: r = {ind, dept, month, x}. */
function QCIncidentCard({r, showDept, showMonth=true}){
  const x=r.x||{};
  const meta=[x.patientName, x.uhid&&('UHID '+x.uhid), [x.age,x.gender].filter(Boolean).join('/'),
              x.incidentDate&&('Incident '+x.incidentDate), x.admissionDate&&('Adm '+x.admissionDate), x.procedureDate&&('Proc '+x.procedureDate),
              x.victimName&&('Victim '+x.victimName), x.victimId&&('Victim ID '+x.victimId)].filter(Boolean).join(' · ');
  const line=(lbl,v)=> (v!=null&&v!=='')? <div style={{fontSize:10,color:P.ink2,lineHeight:1.5,marginTop:2}}><b style={{color:P.ink}}>{lbl}:</b> {v}</div> : null;
  return (
    <div style={{border:'1px solid #f1c6cd',borderRadius:8,padding:'9px 11px',marginBottom:8,background:'#fffafb',pageBreakInside:'avoid'}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'baseline',marginBottom:meta?4:2}}>
        <b style={{fontSize:11.5,color:P.ink}}>{r.ind}</b>
        {showDept&&r.dept&&<span style={{fontSize:10,color:P.blue,fontWeight:600}}>{r.dept}</span>}
        {showMonth&&r.month&&<span style={{fontSize:10,color:P.rose,fontWeight:600}}>{r.month}</span>}
      </div>
      {meta&&<div style={{fontSize:10,color:P.muted,marginBottom:4}}>{meta}</div>}
      {line('Diagnosis', x.diagnosis)}
      {line('Incident details', x.details)}
      {line('Finding / root cause', x.finding)}
      {line('Corrective action', x.corrective)}
      {line('Preventive action', x.preventive)}
      {line('Remark', x.remark)}
    </div>
  );
}

function QCIncidentBlock({d, months}){
  const inc = qcIncidentsOf(d).filter(r=>qcIncInPeriod(r,months));
  if(!inc.length) return null;
  return (
    <div style={{marginTop:14}}>
      <div style={{fontSize:9.5,fontWeight:700,color:P.rose,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Occurred incident details ({inc.length}) — auto-included</div>
      {inc.map((r,i)=><QCIncidentCard key={i} r={r}/>)}
    </div>
  );
}

/* ============================================================================
   EXTENDED REPORT SECTIONS — pure, prop-driven components + aggregate helpers.
   Every one takes its data explicitly (months / chosen depts) and reads no
   builder state, so the SAME element renders byte-identically in the on-screen
   preview and in the ReactDOM.createPortal PDF root.
   ============================================================================ */

/* Baseline window for period-comparison: the equally-long span immediately
   BEFORE the report period ('prev'), or the same span one year earlier ('yoy',
   which for our single 12-month FY axis collapses to the whole prior FY — we
   approximate it by the first-half vs the period, so a shorter selection still
   yields a comparison). Returns a months[] slice (subset of MONTHS) or []. */
function qcBaselineMonths(pMonths, mode){
  if(!pMonths.length) return [];
  // FY-agnostic: derive the axis from the report period's own keys (not the module MONTHS),
  // so the baseline tracks whatever fiscal year the Report Builder is currently showing.
  const fy=fyOfKey(pMonths[0][0]); if(fy==null) return [];
  const axis=fyMonthsFor(fy); const keys=axis.map(r=>r[0]);
  const idx=pMonths.map(m=>keys.indexOf(m[0])).filter(i=>i>=0);
  if(!idx.length) return [];
  const lo=Math.min(...idx), n=pMonths.length;
  const tag=r=>[r[0],r[1],''];
  if(mode==='yoy'){
    // exactly one fiscal year earlier, same positions within the year
    return fyMonthsFor(fy-1).slice(lo, lo+n).map(tag);
  }
  // 'prev': the equally-long window immediately before the period, CROSSING the year
  // boundary into fy-1 when needed. Truncating at January meant a Q1/H1 period got NO
  // baseline and a Feb–Jun period got a 1-month one — the count deltas were then
  // window-length artifacts, not performance changes.
  const axis24=[...fyMonthsFor(fy-1), ...axis];
  const lo24=lo+12;
  return axis24.slice(lo24-n, lo24).map(tag);
}
/* Trend arrow glyph + colour for a delta, respecting goal direction.
   higherBetter=true → up is good (green). Returns {glyph,color,txt}. */
function qcTrendArrow(delta, higherBetter){
  if(delta==null || Math.abs(delta)<1e-9) return {glyph:'→', color:P.muted, txt:'no change'};
  const up=delta>0;
  const good = higherBetter ? up : !up;
  return {glyph: up?'▲':'▼', color: good?P.green:P.rose, txt:(up?'+':'')+ (Math.round(delta*100)/100)};
}
/* Aggregate zero-defect rate + breach count across a set of departments over months.
   `reported` distinguishes a REAL 100% from the vacuous 100% of an all-unreported set. */
function qcAggStat(chosen, months){
  let ok=0, breach=0, na=0, inds=0;
  chosen.forEach(d=>{ inds+=(d.indicators||[]).length; const s=deptStat(d, months); ok+=s.ok; breach+=s.breach; na+=s.na; });
  const rate=(ok+breach)?Math.round(ok*100/(ok+breach)):100;
  return {ok, breach, na, inds, rate, depts:chosen.length, reported:(ok+breach)>0};
}
/* Departments ranked best→worst by zero-defect rate (tie-break: fewer breaches).
   Departments with NOTHING reported for the period are flagged and sorted to the
   bottom — previously their default 100% ranked them #1 ahead of real performers. */
function qcRankRows(chosen, months){
  return chosen.map(d=>{ const s=qcDeptStatus(d, months); const reported=(s.st.ok+s.st.breach)>0;
    return {d, rate:s.st.rate, breaches:s.st.breach, status:reported?s.status:'No data', color:reported?s.color:P.faint, reported}; })
    .sort((a,b)=> (b.reported?1:0)-(a.reported?1:0) || b.rate-a.rate || a.breaches-b.breaches);
}
/* Every (dept,indicator) that carries a benchmark value + its latest reported
   value, for the benchmark-vs-actual comparison. */
function qcBenchRows(chosen, months){
  const out=[];
  chosen.forEach(d=>(d.indicators||[]).forEach(ind=>{
    const bv=ind.benchmarkValue; if(bv==null||bv==='') return;
    let latest=null; for(let i=months.length-1;i>=0;i--){ const v=qcCellVal(ind,months[i]); if(v!=null){ latest=v; break; } }
    if(latest==null) return;
    out.push({dept:d.name, ind, name:ind.name, bench:Number(bv), actual:latest, status:qStatus(ind,latest)});
  }));
  return out;
}

/* -------- Watermark overlay (print-safe, absolute) -------- */
function QCWatermark({text}){
  return <div className="qc-watermark" aria-hidden="true">{text||'CONFIDENTIAL'}</div>;
}

/* -------- Auto executive summary (prose from aggregates) -------- */
function QCExecSummary({chosen, months, rangeLabel}){
  const agg=qcAggStat(chosen, months);
  const rank=qcRankRows(chosen, months);
  // best/worst are judged ONLY among departments that actually reported — an
  // unreported department's default 100% must never win praise or blame.
  const rep=rank.filter(r=>r.reported);
  const best=rep[0], worst=rep[rep.length-1];
  const noData=rank.length-rep.length;
  const breaching=rank.filter(r=>r.breaches>0);
  const tone = !agg.reported?P.muted:agg.rate>=90?P.green:agg.rate>=70?P.amber:P.rose;
  const verdict = agg.rate>=90?'strong compliance':agg.rate>=70?'moderate compliance with pockets of risk':'compliance below target with material risk';
  return (
    <div style={{marginBottom:16,border:'1px solid '+P.line,borderLeft:'4px solid '+tone,borderRadius:9,padding:'12px 15px',background:P.panel2,pageBreakInside:'avoid'}}>
      <div style={{fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Executive summary</div>
      <div style={{fontSize:11.5,color:P.ink2,lineHeight:1.6}}>
        {!agg.reported
          ? <>Across <b>{agg.depts}</b> department{agg.depts!==1?'s':''} and <b>{agg.inds}</b> quality indicators, <b>no data was reported for {rangeLabel}</b> — the figures below reflect an unreported period, not performance.</>
          : <>Across <b>{agg.depts}</b> department{agg.depts!==1?'s':''} and <b>{agg.inds}</b> quality indicators for <b>{rangeLabel}</b>, the hospital achieved an aggregate zero-defect rate of <b style={{color:tone}}>{agg.rate}%</b> ({agg.ok} indicator-months on benchmark, <b style={{color:agg.breach?P.rose:P.green}}>{agg.breach}</b> breach{agg.breach!==1?'es':''}), reflecting <b>{verdict}</b>.</>}
        {best&&(best.breaches<((worst&&worst.breaches)||0)||best.rate>((worst&&worst.rate)||0)||rep.length===1)&&<> The strongest performer was <b>{best.d.name}</b> ({best.rate}% zero-defect{best.breaches?', '+best.breaches+' breach'+(best.breaches!==1?'es':''):''}).</>}
        {worst&&worst!==best&&(worst.breaches>0||worst.rate<best.rate)&&<> The area needing most attention was <b>{worst.d.name}</b> ({worst.rate}% zero-defect, {worst.breaches} breach{worst.breaches!==1?'es':''}).</>}
        {breaching.length>0
          ? <> {breaching.length} department{breaching.length!==1?'s are':' is'} carrying open breaches, tracked for corrective &amp; preventive action.</>
          : (agg.reported && <> No department is currently carrying a breach for the reporting period.</>)}
        {noData>0&&<> <b>{noData}</b> selected department{noData!==1?'s':''} reported no data for this period.</>}
      </div>
    </div>
  );
}

/* -------- Period comparison block (period vs baseline, with trend arrows) -------- */
function QCPeriodCompare({chosen, months, baseMonths, baselineLabel}){
  const cur=qcAggStat(chosen, months), base=qcAggStat(chosen, baseMonths);
  const rows=[
    ['Zero-defect rate', cur.rate, base.rate, '%', true],
    ['Breaches',         cur.breach, base.breach, '', false],
    ['On-benchmark months', cur.ok, base.ok, '', true],
  ];
  return (
    <div style={{marginBottom:16,pageBreakInside:'avoid'}}>
      <div style={{fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Period comparison · vs {baselineLabel}</div>
      {/* An all-unreported baseline defaults to 100%/0 breaches — comparing against it
          fabricates a "deterioration". Say the baseline has no data instead. */}
      {(!baseMonths.length || !base.reported)
        ? <div style={{fontSize:11,color:P.faint}}>{!baseMonths.length?'No prior period available for the selected range.':'No data was reported for the baseline period ('+baselineLabel+') — comparison not applicable.'}</div>
        : (
      <table style={{borderCollapse:'collapse',width:'100%',fontSize:11}}>
        <thead><tr style={{background:P.panel2}}>
          {['Metric','This period','Baseline','Change'].map((h,i)=>
            <th key={h} style={{textAlign:i?'center':'left',padding:'6px 9px',fontSize:9.5,color:P.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:.3,borderBottom:'1px solid '+P.line}}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map(([lbl,c,b,suffix,higher])=>{ const a=qcTrendArrow(c-b, higher);
          return (
          <tr key={lbl} style={{borderBottom:'1px solid '+P.line2}}>
            <td style={{padding:'6px 9px',fontWeight:600,color:P.ink}}>{lbl}</td>
            <td style={{padding:'6px 9px',textAlign:'center',fontFamily:MONO,color:P.ink}}>{c}{suffix}</td>
            <td style={{padding:'6px 9px',textAlign:'center',fontFamily:MONO,color:P.muted}}>{b}{suffix}</td>
            <td style={{padding:'6px 9px',textAlign:'center',fontFamily:MONO,fontWeight:700,color:a.color}}>{a.glyph} {a.txt}{suffix&&a.txt!=='no change'?suffix:''}</td>
          </tr>); })}</tbody>
      </table>
      )}
    </div>
  );
}

/* -------- RAG (Red/Amber/Green) heatmap — dept × status counts -------- */
function QCRagHeatmap({chosen, months}){
  const rows=chosen.map(d=>{ const st=deptStat(d, months); const tot=st.ok+st.breach; const rate=tot?Math.round(st.ok*100/tot):100;
    // No reported months ≠ Green 100% — show an explicit grey "No data" row.
    const rag = !tot?'N':rate>=90?'G':rate>=70?'A':'R';
    return {d, ok:st.ok, breach:st.breach, na:st.na, rate, rag, reported:tot>0}; });
  const cell={G:{bg:'#e7f6ed',col:P.green,t:'Green'},A:{bg:'#fdf3e3',col:P.amber,t:'Amber'},R:{bg:'#fbe9ec',col:P.rose,t:'Red'},N:{bg:'#f1f4f8',col:P.faint,t:'No data'}};
  return (
    <div style={{marginBottom:16,pageBreakInside:'avoid'}}>
      <div style={{fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>RAG status heatmap</div>
      <table style={{borderCollapse:'collapse',width:'100%',fontSize:11}}>
        <thead><tr style={{background:P.panel2}}>
          {['Department','On benchmark','Breaches','Not reported','Zero-defect','RAG'].map((h,i)=>
            <th key={h} style={{textAlign:i?'center':'left',padding:'6px 9px',fontSize:9.5,color:P.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:.3,borderBottom:'1px solid '+P.line}}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map(r=>{ const c=cell[r.rag];
          return (
          <tr key={r.d.key} style={{borderBottom:'1px solid '+P.line2}}>
            <td style={{padding:'6px 9px',fontWeight:600,color:P.ink}}>{r.d.name}</td>
            <td style={{padding:'6px 9px',textAlign:'center',fontFamily:MONO,color:P.green}}>{r.ok}</td>
            <td style={{padding:'6px 9px',textAlign:'center',fontFamily:MONO,color:r.breach?P.rose:P.ink2}}>{r.breach}</td>
            <td style={{padding:'6px 9px',textAlign:'center',fontFamily:MONO,color:P.faint}}>{r.na}</td>
            <td style={{padding:'6px 9px',textAlign:'center',fontFamily:MONO,fontWeight:700,color:c.col}}>{r.reported?r.rate+'%':'—'}</td>
            <td style={{padding:'6px 9px',textAlign:'center'}}><span style={{display:'inline-grid',placeItems:'center',minWidth:54,padding:'3px 8px',borderRadius:20,background:c.bg,color:c.col,fontWeight:700,fontSize:10.5}}>{c.t}</span></td>
          </tr>); })}</tbody>
      </table>
    </div>
  );
}

/* -------- Department ranking (ordered bar) -------- */
function QCDeptRanking({chosen, months}){
  const rows=qcRankRows(chosen, months);
  const max=100;
  return (
    <div style={{marginBottom:16,pageBreakInside:'avoid'}}>
      <div style={{fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Department ranking · zero-defect %</div>
      <div style={{display:'flex',flexDirection:'column',gap:6}}>
        {rows.map((r,i)=>(
          <div key={r.d.key} style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{width:16,textAlign:'right',fontFamily:MONO,fontSize:10,color:P.faint}}>{r.reported?i+1:'·'}</span>
            <span style={{width:130,fontSize:10.5,color:P.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.d.name}</span>
            <div style={{flex:1,background:P.line2,borderRadius:5,height:16,overflow:'hidden'}}>
              <div style={{width:(r.reported?(r.rate/max*100):0)+'%',height:'100%',background:r.color,borderRadius:5}}/>
            </div>
            <span style={{width:44,textAlign:'right',fontFamily:MONO,fontSize:10.5,fontWeight:700,color:r.color}}>{r.reported?r.rate+'%':'—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------- Benchmark vs actual comparison -------- */
function QCBenchmarkCompare({chosen, months}){
  const allRows=qcBenchRows(chosen, months);
  const rows=allRows.slice(0,26);
  if(!rows.length) return (
    <div style={{marginBottom:16}}>
      <div style={{fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Benchmark vs actual</div>
      <div style={{fontSize:11,color:P.faint}}>No benchmarked indicators with reported values in this period.</div>
    </div>
  );
  return (
    <div style={{marginBottom:16,pageBreakInside:'avoid'}}>
      <div style={{fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Benchmark vs actual · latest reported</div>
      <table className="qc-rpt-tbl" style={{borderCollapse:'collapse',width:'100%',fontSize:10}}>
        <thead><tr style={{background:P.panel2}}>
          {['Department','Indicator','Benchmark','Actual','Status'].map((h,i)=>
            <th key={h} style={{textAlign:i>=2?'center':'left',padding:'5px 8px',fontSize:9,color:P.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:.3,borderBottom:'1px solid '+P.line}}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map((r,i)=>{ const col=r.status==='breach'?P.rose:r.status==='ok'?P.green:P.faint;
          return (
          <tr key={i} style={{borderBottom:'1px solid '+P.line2}}>
            <td style={{padding:'4px 8px',color:P.ink2}}>{r.dept}</td>
            <td style={{padding:'4px 8px',fontWeight:600,color:P.ink}}>{r.name} <span style={{color:P.faint,fontWeight:400}}>{r.ind.goalDirection==='higher_is_better'?'↑':'↓'}</span></td>
            <td style={{padding:'4px 8px',textAlign:'center',fontFamily:MONO,color:P.ink2}}>{benchExpr(r.ind)}</td>
            <td style={{padding:'4px 8px',textAlign:'center',fontFamily:MONO,fontWeight:700,color:col}}>{fmtVal(r.ind,r.actual)}</td>
            <td style={{padding:'4px 8px',textAlign:'center'}}><span style={{color:col,fontWeight:700,fontSize:10}}>{r.status==='breach'?'Breach':r.status==='ok'?'On target':'—'}</span></td>
          </tr>); })}
          {allRows.length>rows.length&&<tr><td colSpan={5} style={{padding:'6px 8px',textAlign:'center',fontSize:9.5,color:P.faint,fontStyle:'italic'}}>…and {allRows.length-rows.length} more benchmarked indicator{allRows.length-rows.length!==1?'s':''} not shown (first 26 listed)</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* -------- Indicator trend lines (sparkline grid) -------- */
function QCIndTrend({d, months}){
  const inds=(d.indicators||[]).filter(i=>hasData(i, months)).slice(0,12);
  if(!inds.length) return null;
  return (
    <div style={{marginTop:14,pageBreakInside:'avoid'}}>
      <div style={{fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Indicator trend lines</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'6px 18px'}}>
        {inds.map(ind=>{ const vals=qcMonthVals(ind, months); const nums=vals.filter(v=>v!=null);
          const mn=nums.length?Math.min(...nums):0, mx=nums.length?Math.max(...nums):1, rng=(mx-mn)||1;
          const w=150,h=30; const step=months.length>1?(w/(months.length-1)):0;
          const pts=vals.map((v,i)=>({x:i*step, y:v==null?null:(h-2-((v-mn)/rng)*(h-4))}));
          const path=pts.filter(p=>p.y!=null).map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
          const breach=months.some(m=>monthStatus(ind,m[0])==='breach'); const col=breach?P.rose:P.green;
          return (
            <div key={ind.id} style={{display:'flex',alignItems:'center',gap:8,borderBottom:'1px solid '+P.line2,padding:'3px 0'}}>
              <span style={{flex:1,fontSize:10,color:P.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ind.name}</span>
              <svg width={w} height={h} style={{flexShrink:0}}>{path&&<path d={path} fill="none" stroke={col} strokeWidth="1.5"/>}{pts.map((p,i)=>p.y!=null&&<circle key={i} cx={p.x} cy={p.y} r="1.4" fill={col}/>)}</svg>
            </div>
          ); })}
      </div>
    </div>
  );
}

/* -------- Signature block -------- */
function QCSignatureBlock({sig, orgName}){
  const cell=(role,name)=>(
    <div style={{flex:1,minWidth:0}}>
      <div style={{borderBottom:'1px solid '+P.ink2,height:34}}/>
      <div style={{fontSize:11,fontWeight:700,color:P.ink,marginTop:4}}>{name||' '}</div>
      <div style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:.3}}>{role}</div>
    </div>
  );
  return (
    <div style={{marginTop:26,pageBreakInside:'avoid'}}>
      <div style={{fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.4,marginBottom:12}}>Authorisation · {orgName}</div>
      <div style={{display:'flex',gap:30}}>
        {cell('Prepared by', sig.prepared)}
        {cell('Checked by', sig.reviewed)}
        {cell('Approved by', sig.approved)}
      </div>
    </div>
  );
}

/* Read the CAPA status map from the same localStorage key the Action Plans view
   owns (unico_capa_v1). Keyed by dept.key+'/'+ind.id, default 'Open'. */
function qcCapaMap(){ try{ return JSON.parse(localStorage.getItem('unico_capa_v1'))||{}; }catch(e){ return {}; } }

/* Hand-hygiene indicators for the HH report: percentage-typed only (a count/rate1000
   indicator's monthRaw is not a compliance % and must not be averaged in). Falls back
   to the rest of the hospital — surfacing the hospital-wide 'Overall Hospital' record —
   when the SELECTED departments' HH indicators carry no data ON THE REPORT AXIS. The
   fallback must key off reported DATA, not indicator existence: dept-level HH indicators
   exist (empty) in several areas while the only reported record is hospital-wide, so an
   existence test rendered an all-dashes report and never reached the fallback. Shared by
   the page-list memo AND HHPage so the page count can never disagree with the bodies. */
function qcHHOf(chosen, depts, months){
  const isHH=ind=>/hand\s*hygiene/i.test((ind&&ind.name)||'') && (ind.formula==='pct'||ind.formula==='direct'||isPctInd(ind));
  const hh=[]; (chosen||[]).forEach(d=>(d.indicators||[]).forEach(ind=>{ if(isHH(ind)) hh.push({d,ind}); }));
  if(!hh.some(h=>hasData(h.ind, months))){
    const seen=new Set(hh.map(h=>h.ind));
    (depts||[]).forEach(d=>(d.indicators||[]).forEach(ind=>{ if(isHH(ind) && !seen.has(ind) && hasData(ind, months)) hh.push({d,ind}); }));
  }
  return hh;
}

function QCReportBuilder({depts}){
  const allKeys = depts.map(d=>d.key);
  const [reportType,setReportType] = useState('summary');
  const [period,setPeriod]         = useState({mode:'all'});
  const [chartStyles,setChartStyles]= useState(['bar3d']);
  const [hdrTitle,setHdrTitle]     = useState('Quality Indicator Report');
  const [hdrSub,setHdrSub]         = useState('');
  const [orgName,setOrgName]       = useState('UNICO HOSPITALS PLC');
  const [showLogo,setShowLogo]     = useState(true);
  const [confidential,setConfidential]= useState(true);
  const [footerNote,setFooterNote] = useState('');
  const [pageSize,setPageSize]     = useState('A4');
  const [orient,setOrient]         = useState('portrait');
  const [selectedDepts,setSelectedDepts]= useState(allKeys.slice(0,4));
  const [pageIdx,setPageIdx]       = useState(0);
  const [exporting,setExporting]   = useState(false);
  const [note,setNote]             = useState(null);
  const [pendingExport,setPendingExport] = useState(null); // one-click report: {fmt} to run after a render tick
  // Dynamic fiscal year (Jun–May). Opens on the most recent year that HAS data, so freshly
  // entered current-year data (e.g. Jun 2026) shows immediately; the FY picker below pages back.
  const [fy,setFy]                 = useState(()=>defaultFy(depts));

  /* ---- section toggles + templates (advanced-extensions foundation) ---- */
  const [sections,setSections]=useState({
    // existing page bodies, now gated
    execSummary:true, kpis:true, chart:true, breachDonut:true, table:true, incidents:true, indicatorDetail:true,
    // advanced charts
    ragHeatmap:false, deptRanking:false, benchmarkCompare:false, indTrend:false,
    // appendix + refs
    incidentAppendix:false, standardsRefs:false,
    // structure/polish
    cover:false, toc:false, periodCompare:false, watermark:false, signatures:false,
  });
  const [activeTemplate,setActiveTemplate]=useState('custom');
  const [compareBaseline,setCompareBaseline]=useState('prev'); // 'prev' | 'yoy'
  // Signature names — loaded from the SHARED saved set (window.unicoSig, also used by
  // the Patient Statistics report builders) and auto-saved on every edit.
  const [sig,setSig]=useState(()=> (window.unicoSig?window.unicoSig.load():{prepared:'',reviewed:'',approved:''}));
  useEffect(()=>{ if(window.unicoSig) window.unicoSig.save(sig); },[sig]);
  // custom indicator selection — keys are "deptKey::indId"; narrows every page + export at once
  const [indMode,setIndMode]=useState('all');            // 'all' | 'custom'
  const [indSel,setIndSel]=useState(()=>new Set());
  const [indQ,setIndQ]=useState('');
  const toggleInd=(k)=>setIndSel(s=>{ const n=new Set(s); n.has(k)?n.delete(k):n.add(k); return n; });
  const setManyInd=(keys,on)=>setIndSel(s=>{ const n=new Set(s); keys.forEach(k=>on?n.add(k):n.delete(k)); return n; });
  // saved report formats — reusable presets persisted to localStorage (same pattern as CAPA)
  const [presets,setPresets]=useState(()=>{ try{ return JSON.parse(localStorage.getItem('unico_qc_report_presets_v1'))||[]; }catch(e){ return []; } });
  useEffect(()=>{ try{ localStorage.setItem('unico_qc_report_presets_v1',JSON.stringify(presets)); }catch(e){} },[presets]);
  const [presetSel,setPresetSel]=useState('');
  const [presetName,setPresetName]=useState('');
  // Flip one toggle; a manual change means the config is no longer a named preset.
  const setSec=(k,v)=>{ setSections(s=>({...s,[k]:v})); setActiveTemplate('custom'); };
  // Apply a full preset (coercing the 1/0 shorthand to real booleans) + its report type.
  // Templates cover the WHOLE selection: also lift a leftover Custom indicator filter —
  // a hidden 6-indicator narrowing made "Board Report" show 3 departments after the
  // user had selected all 18 (indSel stays intact for switching back to Custom).
  const applyTemplate=(id)=>{ const t=QC_TEMPLATES[id]; if(!t) return;
    setSections(s=>{ const o={...s}; Object.keys(t.sec).forEach(k=>o[k]=!!t.sec[k]); return o; });
    setIndMode('all');
    setReportType(t.type); setPageIdx(0); setActiveTemplate(id); };
  // ---- saved report formats: capture/restore EVERY control incl. indicator selection ----
  const snapshot=()=>({fy,reportType,period,chartStyles,hdrTitle,hdrSub,orgName,showLogo,confidential,footerNote,pageSize,orient,selectedDepts,sections,compareBaseline,sig,indMode,indSel:[...indSel]});
  const applySnapshot=(c)=>{ if(!c) return;
    // Restore the reporting YEAR first (it was silently dropped before, so a preset loaded
    // in a later year rendered that year's data — and a saved custom period's year-suffixed
    // from/to keys failed to resolve against the wrong axis and fell back to the full year).
    setFy(Number.isFinite(c.fy)?c.fy:defaultFy(depts));
    setReportType(c.reportType||'summary'); setPeriod(c.period||{mode:'all'}); setChartStyles((c.chartStyles&&c.chartStyles.length)?c.chartStyles:['bar3d']);
    setHdrTitle(c.hdrTitle||''); setHdrSub(c.hdrSub||''); setOrgName(c.orgName||'UNICO HOSPITALS PLC'); setShowLogo(c.showLogo!==false); setConfidential(c.confidential!==false); setFooterNote(c.footerNote||'');
    setPageSize(c.pageSize||'A4'); setOrient(c.orient||'portrait'); setSelectedDepts(Array.isArray(c.selectedDepts)?c.selectedDepts:allKeys.slice(0,4));
    setSections(s=>({...s,...(c.sections||{})})); setCompareBaseline(c.compareBaseline||'prev');
    // A preset only overrides the signatures when it actually SAVED names — otherwise the
    // shared auto-saved set (window.unicoSig) would be wiped by loading an older format.
    setSig(s=>{ const cs=c.sig||{}; return (cs.prepared||cs.reviewed||cs.approved)?{prepared:cs.prepared||'',reviewed:cs.reviewed||'',approved:cs.approved||''}:s; });
    setIndMode(c.indMode||'all'); setIndSel(new Set(c.indSel||[])); setActiveTemplate('custom'); setPageIdx(0); };
  const saveFormat=()=>{ const name=presetName.trim(); if(!name){ setNote({ok:false,text:'Type a name for this format first.'}); return; }
    setPresets(ps=>[...ps.filter(p=>p.name!==name),{name,config:snapshot()}]); setPresetSel(name); setPresetName(''); setNote({ok:true,text:'Saved format "'+name+'". Reload it any time from Saved formats.'}); };
  const loadFormat=(name)=>{ if(!name){ setPresetSel(''); return; } const p=presets.find(x=>x.name===name); if(p){ applySnapshot(p.config); setPresetSel(name); setNote({ok:true,text:'Loaded format "'+name+'".'}); } };
  const delFormat=(name)=>{ setPresets(ps=>ps.filter(p=>p.name!==name)); if(presetSel===name) setPresetSel(''); };

  const toggleStyle=s=>setChartStyles(a=>a.includes(s)?(a.length>1?a.filter(x=>x!==s):a):[...a,s]);
  const toggleDept =k=>setSelectedDepts(s=>s.includes(k)?s.filter(x=>x!==k):[...s,k]);
  const chosenRaw=depts.filter(d=>selectedDepts.includes(d.key));
  // Custom indicator selection: narrow each dept's indicators (and drop depts left empty).
  // EVERY downstream page + export reads d.indicators off 'chosen', so this one lever applies everywhere.
  const chosen = indMode==='custom'
    ? chosenRaw.map(d=>({...d,indicators:(d.indicators||[]).filter(i=>indSel.has(d.key+'::'+i.id))})).filter(d=>d.indicators.length)
    : chosenRaw;
  const indItems = chosenRaw.flatMap(d=>(d.indicators||[]).map(i=>({d,i,key:d.key+'::'+i.id})));
  const indQnorm = indQ.trim().toLowerCase();
  const indShown = indQnorm ? indItems.filter(it=>(it.i.name||'').toLowerCase().includes(indQnorm)||(it.d.name||'').toLowerCase().includes(indQnorm)) : indItems;

  /* Fiscal-year axis for THIS report — shadows the module-level MONTHS so every period
     computation, label and picker below (pMonths, rangeLabel, the reporting-period selects)
     tracks the selected FY. fyMonthsFor() returns [key,label,'Mon']; we re-tag the 3rd
     element with Q1..Q4 so the m[2]===Q quarter filter keeps working unchanged. */
  const QTAG=['Q1','Q1','Q1','Q2','Q2','Q2','Q3','Q3','Q3','Q4','Q4','Q4'];
  const MONTHS = fyMonthsFor(fy).map((r,i)=>[r[0],r[1],QTAG[i]]);
  // short spans for the period-picker option labels, e.g. 'Jun–Aug 25', 'Dec–May 26'
  const spanLabel=(i,j)=>{ const a=MONTHS[i][1].split(' '), b=MONTHS[j][1].split(' '); return a[0]+'–'+b[0]+' '+b[1].slice(2); };
  const qSpan=Q=>{ const first=QTAG.indexOf(Q), last=QTAG.lastIndexOf(Q); return first<0?Q:spanLabel(first,last); };

  /* period -> months (12-entry FY axis, filtered) */
  const pMonths=(()=>{
    const q=Q=>MONTHS.filter(m=>m[2]===Q);
    if(period.mode==='q1')    return q('Q1');
    if(period.mode==='q2')    return q('Q2');
    if(period.mode==='q3')    return q('Q3');
    if(period.mode==='q4')    return q('Q4');
    if(period.mode==='h1')    return MONTHS.slice(0,6);
    if(period.mode==='h2')    return MONTHS.slice(6);
    if(period.mode==='last3') return MONTHS.slice(-3);
    if(period.mode==='custom'){ const a=MONTHS.findIndex(m=>m[0]===period.from), b=MONTHS.findIndex(m=>m[0]===period.to);
      if(a>=0&&b>=0){ const lo=Math.min(a,b),hi=Math.max(a,b); return MONTHS.slice(lo,hi+1); } return MONTHS; }
    return MONTHS;
  })();
  const rangeLabel = pMonths.length ? (pMonths[0][1]+' – '+pMonths[pMonths.length-1][1]) : fyLabelOf(fy);

  /* baseline window for the period-comparison section (prev span / one year prior) */
  const baseMonths = qcBaselineMonths(pMonths, compareBaseline);
  const baselineLabel = compareBaseline==='yoy' ? 'same period last year'
    : (baseMonths.length ? (baseMonths[0][1].split(' ')[0]+'–'+baseMonths[baseMonths.length-1][1]) : 'prior period');

  /* sheet sizing (identical to stats §4.1) */
  const [base,ratio]=QC_PAGE_SIZES[pageSize];
  const portrait=orient==='portrait';
  const pageW=portrait?base:Math.round(base*ratio);
  const pageMinH=portrait?Math.round(base*ratio):base;

  /* flat page-list — Detailed: one page per (dept × indicator); Summary: per dept; Compare: single.
     The report-type branch produces `base`; then toggle-driven structural pages (cover/TOC
     at the front, appendix/refs at the end) wrap it, so they flow into preview + PDF alike. */
  const pages = React.useMemo(()=>{
    let base;
    if(reportType==='compare') base = chosen.length ? [{kind:'compare'}] : [];
    else if(reportType==='detail')
      base = chosen.flatMap(d=>{
        // Filter against the REPORT's axis (pMonths) — the bare hasData(i) default is the
        // current calendar year, which silently dropped indicator pages (and corrupted the
        // TOC) whenever the selected report year differed from today's.
        const inds=(d.indicators||[]).filter(i=>hasData(i, pMonths));
        // A dept with NOTHING reported gets ONE honest empty page (dept header, month
        // table of all its indicators, which-year hint) — it used to emit a near-identical
        // "no data" sheet per indicator, which read as a run of duplicated pages.
        return (inds.length?inds:[null]).map(ind=>({kind:'detail', dept:d, ind}));
      });
    else if(reportType==='heatmap') base = chosen.length ? [{kind:'heatmap'}] : [];
    else if(reportType==='handhygiene'){
      // Overview page whenever a department is selected (HHPage shows a helpful empty-state
      // if none report hand hygiene); add a breakdown page only when staff-group or ≥2 dept
      // HH indicators exist. qcHHOf is the SAME finder HHPage renders from (pct-typed,
      // hospital-wide fallback), so the page list always matches the page bodies.
      const hh=qcHHOf(chosen, depts, pMonths);
      base = chosen.length ? [{kind:'hh', part:'overview'}] : [];
      if(hh.length){
        const hasGroups = hh.some(h=>{ const g=h.ind.mGroups||{}; return Object.keys(g).some(k=>g[k]&&Object.keys(g[k]).length); });
        // dept-wise audit rows stored on the submission month (mDeptBreakdown) also fill
        // the breakdown page — the hospital-wide record alone can carry per-dept data.
        const hasDeptBd = hh.some(h=>{ const b=h.ind.mDeptBreakdown||{}; return Object.keys(b).some(k=>Array.isArray(b[k])&&b[k].length); });
        const deptCount = new Set(hh.map(h=>h.d.key)).size;
        if(hasGroups || hasDeptBd || deptCount>1) base.push({kind:'hh', part:'breakdown'});
      }
    }
    // Guard month pages on a real selection (parity with compare/heatmap) so the
    // pager can't report N month pages while the body shows "select a department".
    else if(reportType==='monthly') base = chosen.length ? pMonths.map(m=>({kind:'monthly', month:m})) : [];
    else base = chosen.map(d=>({kind:'summary', dept:d}));
    if(!base.length) return base; // nothing selected — no structural pages either
    const cover=[]; if(sections.cover) cover.push({kind:'cover'});
    const extra=[]; if(sections.incidentAppendix) extra.push({kind:'appendix'}); if(sections.standardsRefs) extra.push({kind:'refs'});
    const content=[...base, ...extra];
    // Table of Contents — PAGINATED so a long index (Detailed = one page per indicator) never
    // overflows a single sheet; each TOC page lists a slice of the whole document.
    let toc=[];
    if(sections.toc){ const TOC_PER=30; let nToc=1; for(let k=0;k<4;k++){ nToc=Math.max(1,Math.ceil((cover.length+nToc+content.length)/TOC_PER)); } toc=Array.from({length:nToc},(_,i)=>({kind:'toc',tocPart:i,tocPer:TOC_PER})); }
    return [...cover, ...toc, ...content];
  },[chosen,reportType,selectedDepts,pMonths,sections,indMode,indSel]);
  const pageCount=Math.max(1,pages.length);
  const pi=Math.min(pageIdx,pageCount-1);
  const cur=pages[pi];
  // The "lead" content page (first page that isn't a structural cover/TOC/appendix/refs)
  // is where the hospital-level aggregate sections + signatures render once.
  const structuralKinds={cover:1,toc:1,appendix:1,refs:1};
  const leadIdx=pages.findIndex(pg=>!structuralKinds[pg.kind]);

  useEffect(()=>{ setPageIdx(0); },[reportType, selectedDepts.length]);

  /* ---- shared inline style helpers (quality-styled clone of stats §3) ---- */
  const fieldLabel=t=><div style={{fontSize:11.5,fontWeight:600,color:P.ink2,marginBottom:7}}>{t}</div>;
  const sel2={padding:'9px 11px',border:'1px solid '+P.line,borderRadius:7,fontSize:13,fontFamily:'inherit',background:'#fff'};
  const pill=(on)=>({display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:20,fontSize:11.5,fontWeight:600,cursor:'pointer',border:'1px solid '+(on?P.blue:P.line),background:on?'#eef8fc':'#fff',color:on?P.blue700:P.muted});
  const Tick=()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>;
  const DownIc=()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 19h16"/></svg>;
  const DocIc=({c})=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c||P.blue} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h9l5 5v15H6zM15 2v5h5M9 13h7M9 17h7"></path></svg>;
  const expBtn={display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',border:'1px solid '+P.line,borderRadius:7,background:'#fff',color:P.ink2,fontSize:12,fontWeight:600,cursor:'pointer'};
  const uSub={fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.4,margin:'8px 0 2px'};

  /* ---- branded page fragments ---- */
  const Header=()=>(
    <div className="qc-band" style={{display:'flex',alignItems:'center',gap:12,borderBottom:'2px solid '+P.blue,paddingBottom:14}}>
      {showLogo&&<img src="unico/logo.svg" alt="UNICO Healthcare" style={{height:38}}/>}
      <div>
        <div style={{fontSize:14,fontWeight:700,color:P.ink}}>{hdrTitle||'Quality Report'}</div>
        <div style={{fontSize:10.5,color:P.muted,letterSpacing:.4,textTransform:'uppercase',marginTop:2}}>{(hdrSub?hdrSub+' · ':'')+rangeLabel}</div>
      </div>
      <span style={{flex:1}}/>
      <div style={{textAlign:'right',fontSize:10,color:P.faint}}>Generated<br/><b style={{fontFamily:MONO,color:P.ink2}}>{new Date().toLocaleDateString()}</b></div>
    </div>
  );
  const Footer=({n,total})=>(
    <div className="pdf-foot" style={{borderTop:'1px solid '+P.line,paddingTop:8,fontSize:9.5,color:P.faint,display:'flex'}}>
      <span>{orgName}</span><span style={{flex:1}}/>
      <span style={{fontFamily:MONO}}>Page {n} of {total}</span><span style={{flex:1}}/>
      <span>{(footerNote?footerNote+' · ':'')+(confidential?'Confidential · ':'')+pageSize+' '+orient}</span>
    </div>
  );

  const KpiCards=({cards,tone})=>(
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
      {cards.map((c,i)=>(
        <div key={i} style={{background:P.panel2,borderRadius:7,padding:'9px 11px',borderLeft:'3px solid '+tone}}>
          <div style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:.3}}>{c[0]}</div>
          <div style={{fontFamily:MONO,fontSize:18,fontWeight:600,color:c[2]||P.ink,lineHeight:1.15,margin:'2px 0'}}>{c[1]}</div>
          {c[3]&&<div style={{fontSize:9,color:P.faint,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c[3]}</div>}
        </div>
      ))}
    </div>
  );

  /* month-wise table cell */
  const MonthCell=({ind,m})=>{
    const v=qcCellVal(ind,m);
    const s=qStatus(ind,v);
    const col=s==='breach'?P.rose:s==='ok'?P.green:P.faint;
    const bg =s==='breach'?'#fbe9ec':s==='ok'?'#e7f6ed':'#f4f6f9';
    return <td style={{textAlign:'center',padding:'3px 1px'}}><span style={{display:'inline-block',minWidth:20,padding:'2px 2px',borderRadius:5,background:bg,color:col,fontFamily:MONO,fontWeight:600,fontSize:9}}>{s==='na'?'·':fmtVal(ind,v)}</span></td>;
  };
  const thc={textAlign:'center',padding:'5px 1px',fontSize:8.5,color:P.muted,fontWeight:700,borderBottom:'1px solid '+P.line,background:P.panel2};
  const thl={textAlign:'left',padding:'7px 6px',fontSize:10,textTransform:'uppercase',letterSpacing:'.2px',color:P.muted,fontWeight:700,borderBottom:'1px solid '+P.line,background:P.panel2};

  const MonthTable=({d,detailInd})=>{
    const rows=detailInd?[detailInd]:(d.indicators||[]);
    return (
      <table className="qc-rpt-tbl" style={{borderCollapse:'collapse',width:'100%',maxWidth:'100%',tableLayout:'fixed',marginTop:14,fontSize:detailInd?10:10.5}}>
        <thead><tr style={{background:P.panel2}}>
          <th style={{...thl,width:120}}>Indicator</th>
          <th style={{...thl,textTransform:'none',fontSize:8.5,width:56}}>Benchmark</th>
          {pMonths.map(m=>{ const p=m[0].split('-'); return <th key={m[0]} style={{...thc,width:33}}><div>{p[0]}</div><div style={{fontWeight:400,fontSize:'.82em',opacity:.6}}>{"'"+p[1]}</div></th>; })}
          <th style={{...thc,width:48}}>Trend</th>
        </tr></thead>
        <tbody>{rows.map(ind=>(
          <tr key={ind.id} style={{borderBottom:'1px solid '+P.line2}}>
            <td style={{padding:'6px 6px',textAlign:'left',fontWeight:600,color:P.ink,fontSize:9.5}}>{ind.name} <span style={{color:P.faint,fontWeight:400}}>{ind.goalDirection==='higher_is_better'?'↑':'↓'}</span></td>
            <td style={{padding:'6px 4px',textAlign:'left',fontFamily:MONO,fontSize:8.5,color:P.ink2}}>{benchExpr(ind)}</td>
            {pMonths.map(m=><MonthCell key={m[0]} ind={ind} m={m}/>)}
            <td style={{textAlign:'center',padding:'4px 2px'}}><QCSpark ind={ind} months={MONTHS} w={52} h={20}/></td>
          </tr>
        ))}</tbody>
      </table>
    );
  };

  /* Detailed: formula/definition block + optional incident sub-table */
  const IndicatorDetail=({d,ind})=>{
    const code=stdMatch(ind.name); const g=guideOf(code);
    // Scope incidents to the REPORT PERIOD (like every other incident section) — without
    // the month filter, events from other years leaked into e.g. a Q1-2026 report.
    const incs = isEventIndicator(ind) ? qcIncidentsOf(d).filter(r=>r.ind===ind.name && qcIncInPeriod(r,pMonths)) : [];
    return (
      <div style={{marginTop:14}}>
        <div style={{background:P.panel2,border:'1px solid '+P.line,borderRadius:9,padding:'11px 14px',fontSize:11.5,color:P.ink2}}>
          <div style={{fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Definition &amp; formula</div>
          <div style={{fontFamily:MONO,fontSize:11,color:P.ink,marginBottom:5}}>{formulaText(ind)}</div>
          {ind.numeratorDef&&<div><b>Numerator:</b> {ind.numeratorDef}</div>}
          {ind.denominatorDef&&<div><b>Denominator:</b> {ind.denominatorDef}</div>}
          {(g&&g.rationale)&&<div style={{marginTop:5,color:P.muted}}>{g.rationale}</div>}
          <div style={{marginTop:5,color:P.muted}}>Benchmark <b style={{color:P.ink2}}>{benchExpr(ind)}</b>{code?(' · '+(HQI_SECN[code[0]]||'')+' ('+code+')'):(' · '+catOf(ind.name))}</div>
        </div>
        {incs.length>0&&(
          <div style={{marginTop:12}}>
            <div style={{fontSize:9.5,fontWeight:700,color:P.rose,textTransform:'uppercase',letterSpacing:.4,marginBottom:5}}>Incident details ({incs.length})</div>
            {incs.map((r,i)=><QCIncidentCard key={i} r={r}/>)}
          </div>
        )}
      </div>
    );
  };

  function DeptPage({page,n,total,lead}){
    // Defensive: structural pages (cover/toc/appendix/refs) carry no `.dept`.
    // Never dereference an undefined department — degrade to null instead of crashing.
    if(!page || !page.dept) return null;
    const d=page.dept; const tone=qcTone(d);
    const {status,color,st}=qcDeptStatus(d, pMonths);
    // A dept with nothing reported must show "No data", not an earned-looking "Excellent".
    const reported=(st.ok+st.breach)>0;
    const chipStatus=reported?status:'No data', chipColor=reported?color:P.faint;
    const detailed=page.kind==='detail';
    const chartInd=detailed?page.ind:qcLeadIndicator(d, pMonths);
    const leadInd=qcLeadIndicator(d, pMonths);
    const code=leadInd?stdMatch(leadInd.name):null;
    const secLabel=code?(HQI_SECN[code[0]]||code):(leadInd?catOf(leadInd.name):'Quality');
    // A detail page with no indicator (empty-dept placeholder) shows the dept-level
    // "no data" KPI cards instead of a blank card strip.
    const cards=detailed?(chartInd?qcIndKpis(chartInd, pMonths):qcDeptKpis(d, pMonths)):qcDeptKpis(d, pMonths);
    const dd=qcDonutData(d, pMonths);
    return (
      <div className="qc-rpage" style={{position:'relative'}}>
        {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
        <Header/>
        <div style={{marginTop:18}}>
          {/* hospital-level aggregate sections appear once, on the first content page */}
          {lead&&sections.execSummary&&<QCExecSummary chosen={chosen} months={pMonths} rangeLabel={rangeLabel}/>}
          {lead&&sections.periodCompare&&<QCPeriodCompare chosen={chosen} months={pMonths} baseMonths={baseMonths} baselineLabel={baselineLabel}/>}
          {lead&&sections.ragHeatmap&&<QCRagHeatmap chosen={chosen} months={pMonths}/>}
          {lead&&sections.deptRanking&&<QCDeptRanking chosen={chosen} months={pMonths}/>}
          {lead&&sections.benchmarkCompare&&<QCBenchmarkCompare chosen={chosen} months={pMonths}/>}
          <div className="qc-band" style={{display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
            <span style={{width:30,height:30,borderRadius:8,background:tone+'1c',display:'grid',placeItems:'center',flexShrink:0}}><DocIc c={tone}/></span>
            <div style={{fontWeight:700,fontSize:15,color:P.ink}}>{d.name}{detailed&&page.ind?(' · '+page.ind.name):''}</div>
            <span className="tag">{secLabel}</span>
            <span style={{flex:1}}/>
            <span style={{background:chipColor+'1c',color:chipColor,padding:'3px 10px',borderRadius:20,fontWeight:700,fontSize:11.5}}>{chipStatus}</span>
          </div>
          {sections.kpis&&<KpiCards cards={cards} tone={tone}/>}
          {/* Render the selected chart(s) whenever the lead indicator has ANY reported month
              (zero-defect data still charts — flat bars against the benchmark). When nothing
              is chartable, do NOT render the status-heatmap fallback if the month table is on
              — two near-identical dot grids on one page read as a duplicated table. Instead
              say where the data actually lives (other reporting years). */}
          {sections.chart&&(() => {
            const chartable = chartInd && qcChartRows(chartInd, pMonths).some(r=>r.has);
            if(!chartable){
              const otherYears=[...dataFySet([d])].filter(y=>y!==fy).sort((a,b)=>b-a);
              return (
                <div style={{margin:'4px 0 8px'}}>
                  <div style={uSub}>{chartInd?'No reported values to chart for '+rangeLabel:'No data'}</div>
                  {!reported&&otherYears.length>0&&<div style={{fontSize:11,color:'#9a6b00',fontWeight:600,background:'#fdf7ea',border:'1px solid #f3ddb5',borderRadius:7,padding:'6px 10px',margin:'4px 0 6px'}}>This department has recorded data in {otherYears.map(fyLabelOf).join(', ')} — switch the reporting year above to include it.</div>}
                  {!sections.table&&<><QCHeatLegend/><QCHeatGrid d={d} months={pMonths}/></>}
                </div>
              );
            }
            return chartStyles.map((cs)=>(
              <div key={cs} style={{margin:'4px 0 8px'}}>
                {chartStyles.length>1&&<div style={uSub}>{QC_CHART_STYLE_LABEL[cs]||cs}</div>}
                {qcChartEl(d, cs, chartInd, tone, pMonths)}
              </div>
            ));
          })()}
          {sections.breachDonut&&!chartStyles.includes('donut')&&(()=>{ const pie=dd.length>1?dd:qcStatusComp(d, pMonths); if(!pie.length) return null;
            return (
            <div style={{display:'flex',alignItems:'center',gap:10,background:P.panel2,borderRadius:9,padding:'10px 14px',marginTop:6}}>
              <div style={{fontSize:10.5,color:P.muted,textTransform:'uppercase',letterSpacing:.3,fontWeight:600,width:88}}>{dd.length>1?'Breach composition':'Status mix'}</div>
              {window.Donut({data:pie, size:104, thickness:20, flat:true})}
            </div>
          );})()}
          {sections.table&&<MonthTable d={d} detailInd={detailed?page.ind:null}/>}
          {sections.indTrend&&<QCIndTrend d={d} months={pMonths}/>}
          {sections.indicatorDetail&&detailed&&page.ind&&<IndicatorDetail d={d} ind={page.ind}/>}
          {sections.incidents&&!detailed&&<QCIncidentBlock d={d} months={pMonths}/>}
          {lead&&sections.signatures&&<QCSignatureBlock sig={sig} orgName={orgName}/>}
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  /* Year-wise indicator × DEPARTMENT matrix — the NQI-style board sheet: indicators
     down the rows, departments across the columns, plus Total-incidence & Benchmark
     columns. One page for all selected departments, with the year's incident details. */
  function HeatmapPage({page,n,total,lead}){
    // Union of indicator names across the chosen departments, in first-seen order.
    // Matched on a NORMALISED name (trim/collapse spaces, case-fold): departments that
    // spelt the same indicator with different case/spacing produced two half-empty rows
    // (a duplicate row AND missing cells) instead of one complete row.
    // '(hospital)' suffix folds too: the hospital-wide record is named "Hand Hygiene
    // Compliance (Hospital)" — without the fold, the Overall Hospital column showed '—'
    // on the shared row while a duplicate one-cell "(Hospital)" row appeared below.
    const normN=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase().replace(/\s*\(hospital\)$/,'');
    const names=[]; const seen=new Set();
    chosen.forEach(d=>(d.indicators||[]).forEach(ind=>{ const k=normN(ind.name); if(!seen.has(k)){ seen.add(k); names.push(ind.name); } }));
    const findInd=(d,name)=>{ const k=normN(name); return (d.indicators||[]).find(i=>normN(i.name)===k); };
    const incs=[]; chosen.forEach(d=>qcIncidentsOf(d).forEach(r=>{ if(qcIncInPeriod(r,pMonths)) incs.push({dept:d.name, ind:r.ind, x:r.x, month:r.month}); }));
    const line=(l,v)=> v? <div style={{fontSize:10,color:P.ink2,lineHeight:1.5}}><b style={{color:P.ink}}>{l}:</b> {v}</div>:null;
    return (
      <div className="qc-rpage" style={{position:'relative'}}>
        {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
        <Header/>
        <div style={{marginTop:18}}>
          {lead&&sections.execSummary&&<QCExecSummary chosen={chosen} months={pMonths} rangeLabel={rangeLabel}/>}
          {lead&&sections.periodCompare&&<QCPeriodCompare chosen={chosen} months={pMonths} baseMonths={baseMonths} baselineLabel={baselineLabel}/>}
          {lead&&sections.ragHeatmap&&<QCRagHeatmap chosen={chosen} months={pMonths}/>}
          {lead&&sections.deptRanking&&<QCDeptRanking chosen={chosen} months={pMonths}/>}
          {lead&&sections.benchmarkCompare&&<QCBenchmarkCompare chosen={chosen} months={pMonths}/>}
          <div className="qc-band" style={{display:'flex',alignItems:'center',gap:9,marginBottom:10}}>
            <span style={{width:30,height:30,borderRadius:8,background:P.blue+'1c',display:'grid',placeItems:'center',flexShrink:0}}><DocIc c={P.blue}/></span>
            <div style={{fontWeight:700,fontSize:15,color:P.ink}}>Indicator × Department heatmap · {rangeLabel}</div>
            <span style={{flex:1}}/><span className="tag">{chosen.length} dept · {names.length} indicators</span>
          </div>
          <QCHeatLegend/>
          {/* Dept columns get very narrow at high counts (fixed layout splits the leftover
              width evenly): headers render VERTICALLY (they used to paint over each other),
              pills shrink to their column, and the tooltip carries the full detail. */}
          <div style={{overflowX:'auto'}}>
            {(()=>{ const dense=chosen.length>10, vertHead=chosen.length>6;
            const pill=(c,i,name)=>(
              <td key={i} style={{textAlign:'center',padding:'3px 1px'}}>
                <span title={name+' · '+chosen[i].name+' · '+(c.a.status==='na'?'not reported':fmtVal(c.ind,c.a.value)+' · '+(c.a.status==='breach'?'breach':'on benchmark'))}
                  style={{display:'block',margin:'0 auto',maxWidth:'100%',height:20,lineHeight:'20px',borderRadius:4,background:qcHeatColors(c.a.status).bg,color:qcHeatColors(c.a.status).col,fontFamily:MONO,fontWeight:700,fontSize:dense?7.5:9.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {c.a.status==='na'?'·':fmtVal(c.ind,c.a.value)}
                </span>
              </td>);
            return (
            <table style={{borderCollapse:'collapse',width:'100%',maxWidth:'100%',tableLayout:'fixed',fontSize:9.5}}>
              <thead><tr>
                <th style={{...thl,width:dense?110:130}}>Quality Indicator</th>
                <th style={{...thc,width:36}}>Total</th>
                <th style={{...thl,width:dense?56:62,textTransform:'none'}}>Benchmark</th>
                {chosen.map(d=>
                  <th key={d.key} title={d.name} style={{...thc,padding:'4px 1px',height:vertHead?66:undefined,verticalAlign:'bottom'}}>
                    {vertHead
                      // rotate() instead of writing-mode: html2canvas (the web PDF exporter)
                      // cannot rasterize vertical writing-mode text — it came out garbled in
                      // the downloaded PDF. A plain -90° transform renders identically on
                      // screen AND in the capture.
                      ? <div style={{height:60,position:'relative',margin:'0 auto'}}><div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%) rotate(-90deg)',width:58,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'left',fontSize:dense?7.5:8.5,lineHeight:1.1}}>{d.name}</div></div>
                      : d.name}
                  </th>)}
              </tr></thead>
              <tbody>{names.length===0
                ? <tr><td colSpan={chosen.length+3} style={{padding:14,textAlign:'center',color:P.faint}}>No indicators for the selected departments.</td></tr>
                : names.map(name=>{
                let tot=0, anyCount=false, num=0, den=0, anyRate=false, rateInd=null;
                const benchSet=new Set(); let bench='';
                const cells=chosen.map(d=>{ const ind=findInd(d,name); if(!ind) return {none:true};
                  // Prefer a REAL benchmark (the first dept's 'No benchmark' used to mask
                  // everyone else's); flag when departments use different targets.
                  const be=benchExpr(ind); if(be && be!=='No benchmark'){ benchSet.add(be); if(!bench) bench=be; }
                  const a=qcAnnualCell(ind, pMonths);
                  if(a.rep && !a.isRate){ anyCount=true; tot+=a.count; }
                  if(a.rep && a.isRate){ anyRate=true; num+=a.num||0; den+=a.den||0; if(!rateInd) rateInd=ind; }
                  return {ind,a}; });
                // Total: counts sum; pure-rate rows show the POOLED period value (Σnum/Σden
                // across departments) instead of the meaningless dash they used to.
                let totTxt='—', totColor=P.ink2;
                if(anyCount){ totTxt=String(tot); totColor=tot>0?P.rose:P.ink2; }
                else if(anyRate && den>0 && rateInd){ const pooled=window.qiFormulaCompute(rateInd.formula||'pct', num, den); if(pooled!=null){ totTxt=fmtVal(rateInd,pooled); totColor=P.ink2; } }
                return (
                  <tr key={name} style={{borderBottom:'1px solid '+P.line2}}>
                    <td style={{padding:'5px 8px',textAlign:'left',fontWeight:600,color:P.ink,wordBreak:'break-word'}}>{name}</td>
                    <td title={anyCount?'total incidence over the period':'pooled period value (Σnum/Σden across departments)'} style={{textAlign:'center',fontFamily:MONO,fontWeight:700,fontSize:dense?8:9.5,color:totColor}}>{totTxt}</td>
                    <td style={{padding:'4px 8px',color:P.ink2,fontSize:9}}>{bench?(bench+(benchSet.size>1?' ·varies':'')):'No benchmark'}</td>
                    {cells.map((c,i)=> c.none
                      ? <td key={i} style={{textAlign:'center',color:P.faint,fontSize:9}}>—</td>
                      : pill(c,i,name))}
                  </tr>
                );
              })}</tbody>
            </table>
            ); })()}
          </div>
          {sections.incidents&&incs.length>0 && (
            <div style={{marginTop:14}}>
              <div style={{fontSize:9.5,fontWeight:700,color:P.rose,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Occurred incident details · {rangeLabel} ({incs.length})</div>
              {incs.map((r,i)=><QCIncidentCard key={i} r={r} showDept/>)}
            </div>
          )}
          {lead&&sections.signatures&&<QCSignatureBlock sig={sig} orgName={orgName}/>}
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  /* Month-wise, ALL-department matrix (indicator × department) — like the NQI Excel
     monthly sheets — one page per month, with that month's incident details. */
  function MonthlyPage({page,n,total,lead}){
    const m=page.month;
    // Normalised-name union — same duplicate-row / missing-cell guard as HeatmapPage
    // (including the '(hospital)' suffix fold for the hospital-wide HH record).
    const normN=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase().replace(/\s*\(hospital\)$/,'');
    const names=[]; const seen=new Set();
    chosen.forEach(d=>(d.indicators||[]).forEach(ind=>{ const k=normN(ind.name); if(!seen.has(k)){ seen.add(k); names.push(ind.name); } }));
    const findInd=(d,name)=>{ const k=normN(name); return (d.indicators||[]).find(i=>normN(i.name)===k); };
    const incs=[]; chosen.forEach(d=>qcIncidentsOf(d).forEach(r=>{ if(r.month===m[1]) incs.push({dept:d.name, ind:r.ind, x:r.x}); }));
    const line=(l,v)=> v? <div style={{fontSize:10,color:P.ink2,lineHeight:1.5}}><b style={{color:P.ink}}>{l}:</b> {v}</div>:null;
    return (
      <div className="qc-rpage" style={{position:'relative'}}>
        {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
        <Header/>
        <div style={{marginTop:18}}>
          {lead&&sections.execSummary&&<QCExecSummary chosen={chosen} months={pMonths} rangeLabel={rangeLabel}/>}
          {lead&&sections.periodCompare&&<QCPeriodCompare chosen={chosen} months={pMonths} baseMonths={baseMonths} baselineLabel={baselineLabel}/>}
          {lead&&sections.ragHeatmap&&<QCRagHeatmap chosen={chosen} months={pMonths}/>}
          {lead&&sections.deptRanking&&<QCDeptRanking chosen={chosen} months={pMonths}/>}
          {lead&&sections.benchmarkCompare&&<QCBenchmarkCompare chosen={chosen} months={pMonths}/>}
          <div className="qc-band" style={{display:'flex',alignItems:'center',gap:9,marginBottom:10}}>
            <span style={{width:30,height:30,borderRadius:8,background:P.blue+'1c',display:'grid',placeItems:'center',flexShrink:0}}><DocIc c={P.blue}/></span>
            <div style={{fontWeight:700,fontSize:15,color:P.ink}}>Nursing Quality Indicators · {m[1]}</div>
            <span style={{flex:1}}/><span className="tag">{chosen.length} dept · {names.length} indicators</span>
          </div>
          <QCHeatLegend/>
          <div style={{overflowX:'auto'}}>
            {(()=>{ const dense=chosen.length>10, vertHead=chosen.length>6;
            return (
            <table style={{borderCollapse:'collapse',width:'100%',maxWidth:'100%',tableLayout:'fixed',fontSize:9.5}}>
              <thead><tr>
                <th style={{...thl,width:dense?104:118}}>Quality Indicator</th>
                <th style={{...thc,width:42,color:P.ink2}}>Total Incidence</th>
                <th style={{...thl,width:dense?58:66,textTransform:'none'}}>Benchmark</th>
                {chosen.map(d=>
                  <th key={d.key} title={d.name} style={{...thc,padding:'4px 1px',height:vertHead?66:undefined,verticalAlign:'bottom'}}>
                    {vertHead
                      // rotate() instead of writing-mode: html2canvas (the web PDF exporter)
                      // cannot rasterize vertical writing-mode text — it came out garbled in
                      // the downloaded PDF. A plain -90° transform renders identically on
                      // screen AND in the capture.
                      ? <div style={{height:60,position:'relative',margin:'0 auto'}}><div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%) rotate(-90deg)',width:58,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'left',fontSize:dense?7.5:8.5,lineHeight:1.1}}>{d.name}</div></div>
                      : d.name}
                  </th>)}
              </tr></thead>
              <tbody>{names.length===0
                ? <tr><td colSpan={chosen.length+3} style={{padding:14,textAlign:'center',color:P.faint}}>No indicators for the selected departments.</td></tr>
                : names.map(name=>{
                // Counts sum across departments; rate/% rows pool Σnum/Σden for THIS month
                // (summing rates across departments was a meaningless red number, and pct
                // rows printed a bogus "0").
                let tot=0, anyCount=false, num=0, den=0, anyRate=false, rateInd=null;
                const benchSet=new Set(); let bench='';
                const cells=chosen.map(d=>{ const ind=findInd(d,name); if(!ind) return {none:true};
                  const be=benchExpr(ind); if(be && be!=='No benchmark'){ benchSet.add(be); if(!bench) bench=be; }
                  const v=qcCellVal(ind,m); const s=qStatus(ind,v);
                  const isRate=['pct','rate100','rate1000','avg'].indexOf(ind.formula)>=0 || isPctInd(ind);
                  if(v!=null){
                    if(!isRate){ anyCount=true; tot+=Number(v)||0; }
                    else { anyRate=true; if(!rateInd) rateInd=ind;
                      const n=ind.mNum&&ind.mNum[m[0]], dd=ind.mDen&&ind.mDen[m[0]];
                      if(n!=null&&n!==''&&dd!=null&&dd!==''){ num+=Number(n)||0; den+=Number(dd)||0; } }
                  }
                  return {ind,v,s}; });
                let totTxt='—', totColor=P.ink2;
                if(anyCount){ totTxt=String(tot); totColor=tot>0?P.rose:P.ink2; }
                else if(anyRate && den>0 && rateInd){ const pooled=window.qiFormulaCompute(rateInd.formula||'pct', num, den); if(pooled!=null) totTxt=fmtVal(rateInd,pooled); }
                return (
                  <tr key={name} style={{borderBottom:'1px solid '+P.line2}}>
                    <td style={{padding:'5px 8px',textAlign:'left',fontWeight:600,color:P.ink,wordBreak:'break-word'}}>{name}</td>
                    <td title={anyCount?'total incidence this month':'pooled value this month (Σnum/Σden across departments)'} style={{textAlign:'center',fontFamily:MONO,fontWeight:700,fontSize:dense?8:9.5,color:totColor}}>{totTxt}</td>
                    <td style={{padding:'4px 8px',color:P.ink2,fontSize:9}}>{bench?(bench+(benchSet.size>1?' ·varies':'')):'No benchmark'}</td>
                    {cells.map((c,i)=> c.none
                      ? <td key={i} style={{textAlign:'center',color:P.faint,fontSize:9}}>—</td>
                      : <td key={i} style={{textAlign:'center',padding:'3px 1px'}}><span title={name+' · '+chosen[i].name+' · '+(c.s==='na'?'not reported':fmtVal(c.ind,c.v)+' · '+(c.s==='breach'?'breach':'on benchmark'))} style={{display:'block',margin:'0 auto',maxWidth:'100%',height:20,lineHeight:'20px',borderRadius:4,background:qcHeatColors(c.s).bg,color:qcHeatColors(c.s).col,fontFamily:MONO,fontWeight:700,fontSize:dense?7.5:9.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.s==='na'?'·':fmtVal(c.ind,c.v)}</span></td>)}
                  </tr>
                );
              })}</tbody>
            </table>
            ); })()}
          </div>
          {sections.incidents&&incs.length>0 && (
            <div style={{marginTop:14}}>
              <div style={{fontSize:9.5,fontWeight:700,color:P.rose,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Occurred incident details in {m[1]} ({incs.length})</div>
              {incs.map((r,i)=><QCIncidentCard key={i} r={r} showDept showMonth={false}/>)}
            </div>
          )}
          {lead&&sections.signatures&&<QCSignatureBlock sig={sig} orgName={orgName}/>}
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  function ComparePage({n,total}){
    const rows=chosen.map(d=>{ const s=qcDeptStatus(d, pMonths); return {d, st:s.st, status:s.status, color:s.color, breaches:s.st.breach, rate:s.st.rate, inds:(d.indicators||[]).length}; });
    const hbar=rows.map(r=>({label:r.d.name, value:r.rate, color:r.color})).sort((a,b)=>b.value-a.value);
    // ComparePage is always the single base page, so it is inherently the lead sheet.
    return (
      <div className="qc-rpage" style={{position:'relative'}}>
        {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
        <Header/>
        <div style={{marginTop:18}}>
          {sections.execSummary&&<QCExecSummary chosen={chosen} months={pMonths} rangeLabel={rangeLabel}/>}
          {sections.periodCompare&&<QCPeriodCompare chosen={chosen} months={pMonths} baseMonths={baseMonths} baselineLabel={baselineLabel}/>}
          {sections.ragHeatmap&&<QCRagHeatmap chosen={chosen} months={pMonths}/>}
          {sections.benchmarkCompare&&<QCBenchmarkCompare chosen={chosen} months={pMonths}/>}
          <div className="qc-band" style={{fontWeight:700,fontSize:15,marginBottom:12,color:P.ink}}>Cross-department comparison · {chosen.length} departments</div>
          {sections.deptRanking
            ? <div style={{marginBottom:16}}><QCDeptRanking chosen={chosen} months={pMonths}/></div>
            : <div style={{marginBottom:16}}>{window.HBar({rows:hbar, height:Math.max(160,rows.length*30)})}</div>}
          <table className="qc-rpt-tbl" style={{borderCollapse:'collapse',width:'100%',fontSize:11.5}}>
            <thead><tr style={{background:P.panel2}}>
              {['Department','Section / Focus','Indicators','Zero-Defect %','Breaches','Status'].map((h,i)=>
                <th key={h} style={{...(i===0?thl:thc),textAlign:i===0?'left':(i>=2?'center':'left'),textTransform:'none',fontSize:10}}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map(r=>{ const lead=qcLeadIndicator(r.d, pMonths); const code=lead?stdMatch(lead.name):null; const sec=code?(HQI_SECN[code[0]]||code):(lead?catOf(lead.name):'—');
              return (
              <tr key={r.d.key} style={{borderBottom:'1px solid '+P.line2}}>
                <td style={{padding:'7px 10px',fontWeight:600,color:P.ink}}>{r.d.name}</td>
                <td style={{padding:'7px 10px',color:P.ink2}}>{sec}</td>
                <td style={{padding:'7px 10px',textAlign:'center',fontFamily:MONO}}>{r.inds}</td>
                <td style={{padding:'7px 10px',textAlign:'center',fontFamily:MONO,fontWeight:600,color:r.rate>=90?P.green:r.rate>=70?P.amber:P.rose}}>{r.rate}%</td>
                <td style={{padding:'7px 10px',textAlign:'center',fontFamily:MONO,color:r.breaches>0?P.rose:P.green}}>{r.breaches}</td>
                <td style={{padding:'7px 10px',textAlign:'center'}}><span style={{background:r.color+'1c',color:r.color,padding:'3px 10px',borderRadius:20,fontWeight:700,fontSize:11}}>{r.status}</span></td>
              </tr>); })}</tbody>
          </table>
          {sections.signatures&&<QCSignatureBlock sig={sig} orgName={orgName}/>}
        </div>
        <Footer n={n||1} total={total||1}/>
      </div>
    );
  }

  /* ---- structural pages (cover / TOC / appendix / refs) — toggle-driven ---- */
  function CoverPage({n,total}){
    const agg=qcAggStat(chosen, pMonths);
    const tone=!agg.reported?P.faint:agg.rate>=90?P.green:agg.rate>=70?P.amber:P.rose;
    // When the Custom indicator filter narrows the report, SAY so on the cover —
    // "3 departments" after selecting all 18 looked like a broken, non-dynamic page.
    const narrowed=indMode==='custom'&&chosenRaw.length!==chosen.length;
    return (
      <div className="qc-rpage" style={{position:'relative'}}>
        {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'60px 20px 30px'}}>
          {showLogo&&<img src="unico/logo.svg" alt="UNICO Healthcare" style={{height:66,marginBottom:26}}/>}
          <div style={{fontSize:13,fontWeight:700,color:P.blue,textTransform:'uppercase',letterSpacing:1.5}}>{orgName}</div>
          <h1 style={{fontSize:32,fontWeight:700,color:P.ink,margin:'14px 0 6px',letterSpacing:'-.5px'}}>{hdrTitle||'Quality Indicator Report'}</h1>
          {hdrSub&&<div style={{fontSize:14,color:P.muted}}>{hdrSub}</div>}
          <div style={{fontSize:14,color:P.ink2,marginTop:10,fontWeight:600}}>{rangeLabel}</div>
          <div style={{display:'flex',gap:26,marginTop:34}}>
            {[['Departments',String(agg.depts),P.blue],['Indicators',String(agg.inds),P.violet],['Zero-defect',agg.reported?agg.rate+'%':'—',tone],['Breaches',agg.reported?String(agg.breach):'—',!agg.reported?P.faint:agg.breach?P.rose:P.green]].map(c=>(
              <div key={c[0]} style={{textAlign:'center'}}>
                <div style={{fontFamily:MONO,fontSize:26,fontWeight:700,color:c[2]}}>{c[1]}</div>
                <div style={{fontSize:9.5,color:P.muted,textTransform:'uppercase',letterSpacing:.4,marginTop:2}}>{c[0]}</div>
              </div>
            ))}
          </div>
          {!agg.reported&&<div style={{marginTop:14,fontSize:11,color:P.faint}}>No data was reported for this period.</div>}
          {narrowed&&<div style={{marginTop:14,fontSize:10.5,color:P.amber,fontWeight:600,border:'1px solid #f3ddb5',background:'#fdf7ea',borderRadius:6,padding:'5px 12px'}}>Custom indicator selection active — {chosen.length} of {chosenRaw.length} selected departments included. Switch Indicators to “All” for the full report.</div>}
          {confidential&&<div style={{marginTop:34,fontSize:10.5,color:P.rose,fontWeight:700,textTransform:'uppercase',letterSpacing:1,border:'1px solid #f1c6cd',borderRadius:6,padding:'6px 14px'}}>Confidential — for authorised recipients only</div>}
          <div style={{fontSize:10,color:P.faint,marginTop:20}}>Generated {new Date().toLocaleDateString()}</div>
        </div>
        {sections.signatures&&<div style={{padding:'0 8px'}}><QCSignatureBlock sig={sig} orgName={orgName}/></div>}
        <Footer n={n} total={total}/>
      </div>
    );
  }

  /* human-readable label for each generated page — drives the TOC entries. */
  const pageTitle=(pg)=>{
    if(pg.kind==='cover')   return 'Cover';
    if(pg.kind==='toc')     return 'Table of Contents';
    if(pg.kind==='appendix')return 'Appendix — Incidents & CAPA';
    if(pg.kind==='refs')    return 'References — Standards & Benchmarks';
    if(pg.kind==='compare') return 'Cross-department comparison';
    if(pg.kind==='heatmap') return 'Indicator × Department heatmap';
    if(pg.kind==='hh')      return 'Hand Hygiene Compliance'+(pg.part==='breakdown'?' · breakdown':' · overview');
    if(pg.kind==='monthly') return (pg.month?pg.month[1]:'')+' · monthly status';
    if(pg.kind==='detail')  return (pg.dept?pg.dept.name:'')+(pg.ind?(' · '+pg.ind.name):'');
    return (pg.dept?pg.dept.name:'Department')+' · summary';
  };
  function TocPage({page,n,total}){
    const per=(page&&page.tocPer)||30; const start=((page&&page.tocPart)||0)*per; const slice=pages.slice(start,start+per);
    return (
      <div className="qc-rpage" style={{position:'relative'}}>
        {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
        <Header/>
        <div style={{marginTop:18}}>
          <div className="qc-band" style={{fontWeight:700,fontSize:16,color:P.ink,marginBottom:14}}>Table of Contents{start?' (continued)':''}</div>
          <div style={{display:'flex',flexDirection:'column'}}>
            {slice.map((pg,j)=>{ const idx=start+j; return (
              <div key={idx} style={{display:'flex',alignItems:'baseline',gap:8,padding:'5px 0',borderBottom:'1px dotted '+P.line2}}>
                <span style={{fontSize:11.5,color:P.ink2,fontWeight:pg.kind==='cover'||pg.kind==='toc'?700:500}}>{pageTitle(pg)}</span>
                <span style={{flex:1,borderBottom:'1px dotted '+P.line,margin:'0 4px 3px'}}/>
                <span style={{fontFamily:MONO,fontSize:11,color:P.muted}}>{idx+1}</span>
              </div>
            ); })}
          </div>
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  function AppendixPage({n,total}){
    const capa=qcCapaMap();
    const incs=[]; chosen.forEach(d=>qcIncidentsOf(d).forEach(r=>{ if(qcIncInPeriod(r,pMonths)) incs.push({dept:d.name, ind:r.ind, month:r.month, x:r.x}); }));
    // CAPA rows: replicate the Action Plans eligibility (last-quarter breach OR ≥3 breaches).
    const plans=[]; chosen.forEach(d=>(d.indicators||[]).forEach(ind=>{
      let lastQ=null; QORDER.forEach(Q=>{ if(qtrRaw(ind,Q,fy)!=null) lastQ=Q; });
      const lastBreach=lastQ!=null && qtrStatus(ind,lastQ,fy)==='breach'; const nB=countBreaches(ind, MONTHS);
      if(!(lastBreach||nB>=3)) return;
      plans.push({dept:d.name, ind:ind.name, breaches:nB, status:capa[d.key+'/'+ind.id]||'Open'}); }));
    const stCol=s=>s==='Closed'?P.green:s==='In Progress'?P.amber:P.rose;
    const line=(l,v)=> v? <div style={{fontSize:10,color:P.ink2,lineHeight:1.5}}><b style={{color:P.ink}}>{l}:</b> {v}</div>:null;
    return (
      <div className="qc-rpage" style={{position:'relative'}}>
        {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
        <Header/>
        <div style={{marginTop:18}}>
          <div className="qc-band" style={{fontWeight:700,fontSize:16,color:P.ink,marginBottom:12}}>Appendix — Incidents &amp; CAPA · {rangeLabel}</div>
          <div style={{fontSize:9.5,fontWeight:700,color:P.violet,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Corrective &amp; preventive action plans ({plans.length})</div>
          {plans.length===0
            ? <div style={{fontSize:11,color:P.green,marginBottom:14}}>No indicators in breach — no open action plans.</div>
            : (
            <table className="qc-rpt-tbl" style={{borderCollapse:'collapse',width:'100%',fontSize:10,marginBottom:16}}>
              <thead><tr style={{background:P.panel2}}>
                {['Department','Indicator','Breaches','CAPA status'].map((h,i)=>
                  <th key={h} style={{textAlign:i>=2?'center':'left',padding:'5px 8px',fontSize:9,color:P.muted,fontWeight:700,textTransform:'uppercase',letterSpacing:.3,borderBottom:'1px solid '+P.line}}>{h}</th>)}
              </tr></thead>
              <tbody>{plans.map((p,i)=>(
                <tr key={i} style={{borderBottom:'1px solid '+P.line2}}>
                  <td style={{padding:'4px 8px',color:P.ink2}}>{p.dept}</td>
                  <td style={{padding:'4px 8px',fontWeight:600,color:P.ink}}>{p.ind}</td>
                  <td style={{padding:'4px 8px',textAlign:'center',fontFamily:MONO,color:p.breaches?P.rose:P.ink2}}>{p.breaches}</td>
                  <td style={{padding:'4px 8px',textAlign:'center'}}><span style={{color:stCol(p.status),fontWeight:700,fontSize:10}}>{p.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          )}
          <div style={{fontSize:9.5,fontWeight:700,color:P.rose,textTransform:'uppercase',letterSpacing:.4,marginBottom:6}}>Occurred incident details ({incs.length})</div>
          {incs.length===0
            ? <div style={{fontSize:11,color:P.muted}}>No logged incidents in the reporting period.</div>
            : incs.map((r,i)=><QCIncidentCard key={i} r={r} showDept/>)}
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  function RefsPage({n,total}){
    // Collect the standard codes actually used by the selected departments' indicators.
    const seen=new Set(); const rows=[];
    const STD=(typeof HQI_STANDARDS!=='undefined'&&HQI_STANDARDS)||[];
    chosen.forEach(d=>(d.indicators||[]).forEach(ind=>{ const code=stdMatch(ind.name); if(code&&!seen.has(code)){ seen.add(code); const s=STD.find(x=>x.code===code); if(s) rows.push(s); } }));
    rows.sort((a,b)=>a.code.localeCompare(b.code));
    const bySec={}; rows.forEach(r=>{ (bySec[r.sec]=bySec[r.sec]||[]).push(r); });
    return (
      <div className="qc-rpage" style={{position:'relative'}}>
        {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
        <Header/>
        <div style={{marginTop:18}}>
          <div className="qc-band" style={{fontWeight:700,fontSize:16,color:P.ink,marginBottom:12}}>References — Standards &amp; Benchmarks</div>
          {rows.length===0
            ? <div style={{fontSize:11,color:P.muted}}>No mapped accreditation standards for the selected indicators.</div>
            : Object.keys(bySec).sort().map(sec=>(
              <div key={sec} style={{marginBottom:12}}>
                <div style={{fontSize:10,fontWeight:700,color:P.blue,textTransform:'uppercase',letterSpacing:.4,marginBottom:5}}>{sec} · {HQI_SECN[sec]||sec}</div>
                <table style={{borderCollapse:'collapse',width:'100%',fontSize:10}}>
                  <tbody>{bySec[sec].map(s=>(
                    <tr key={s.code} style={{borderBottom:'1px solid '+P.line2,verticalAlign:'top'}}>
                      <td style={{padding:'4px 8px',fontFamily:MONO,fontWeight:700,color:P.ink,whiteSpace:'nowrap'}}>{s.code}</td>
                      <td style={{padding:'4px 8px',fontWeight:600,color:P.ink}}>{s.name}<div style={{fontSize:9,color:P.muted,fontWeight:400}}>Benchmark {s.bench} · {s.expr}</div></td>
                      <td style={{padding:'4px 8px',color:P.muted,fontSize:9.5,whiteSpace:'nowrap'}}>{s.ref}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  /* ---- Hand Hygiene Compliance report (WHO) — page kind 'hh': overview + breakdown.
     Aggregates the selected departments' hand-hygiene indicators; monthly compliance vs the
     ≥ benchmark, staff-group (Nurse/Doctor/PCA/Other) and by-department breakdown. Reuses the
     builder chrome (Header/Footer/KpiCards) and the console's monthRaw/qStatus math. */
  function HHPage({page,n,total,lead}){
    const part=page.part||'overview';
    // Percentage-typed HH indicators of the selected departments, with the hospital-wide
    // fallback — the SAME qcHHOf the page-list memo counts, so list and body agree.
    const hh=qcHHOf(chosen, depts, pMonths);
    if(!hh.length) return (
      <div className="qc-rpage" style={{position:'relative'}}>
        {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
        <Header/>
        <div style={{marginTop:60,textAlign:'center'}}>
          <div style={{fontSize:16,fontWeight:700,color:P.ink,marginBottom:8}}>Hand Hygiene Compliance</div>
          <div style={{fontSize:12,color:P.muted,maxWidth:460,margin:'0 auto'}}>No hand hygiene data was found in the selected departments or in the hospital-wide (Overall Hospital) records for {fyLabelOf(fy)}. Record hand hygiene in Quality Data — or switch the fiscal year above — then regenerate.</div>
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
    const reportedCount=ind=>pMonths.reduce((s,m)=>s+(monthRaw(ind,m[0])!=null?1:0),0);
    let primary=hh.find(h=>/overall|hospital/i.test((h.d.name||'')+' '+(h.ind.name||'')));
    if(!primary) primary=hh.slice().sort((a,b)=>reportedCount(b.ind)-reportedCount(a.ind))[0];
    const pind=primary.ind;
    const bench=(pind.benchmarkValue!=null&&pind.benchmarkValue!=='')?Number(pind.benchmarkValue):90;
    const higher=true; // hand-hygiene compliance is always higher-is-better (WHO ≥ benchmark)
    const whoStat=pct=>pct==null?{label:'—',color:P.faint,bg:'#f4f6f9'}
      :pct>=bench?{label:'Compliant',color:P.green,bg:'#e7f6ed'}
      :pct>=75?{label:'Needs improvement',color:P.amber,bg:'#fff5e6'}
      :{label:'Unacceptable',color:P.rose,bg:'#fbe9ec'};
    // Per-month compliance pooled across ALL selected HH indicators. When every reporting
    // indicator carries numerator+denominator we pool Σnum/Σden (opportunity-weighted, the
    // epidemiologically correct rate); if any reports a direct % (no den) we fall back to an
    // unweighted mean of each indicator's monthly value so none is dropped, and leave num/den
    // null so the table's Compliant/Opportunities columns never show a partial figure.
    const monthAgg=m=>{ let num=0,den=0,ndCount=0,total=0; const comps=[];
      hh.forEach(({ind})=>{ const v=monthRaw(ind,m[0]); if(v==null) return; total++; comps.push(v);
        const nn=ind.mNum&&ind.mNum[m[0]], dd=ind.mDen&&ind.mDen[m[0]];
        if(nn!=null&&nn!==''&&dd!=null&&dd!==''&&Number(dd)>0){ num+=Number(nn); den+=Number(dd); ndCount++; } });
      if(!total) return {value:null,num:null,den:null};
      if(ndCount===total&&den>0) return {value:Math.round(num/den*10000)/100, num, den};
      return {value:Math.round(comps.reduce((s,x)=>s+x,0)/comps.length*100)/100, num:null, den:null};
    };
    const series=pMonths.map(m=>Object.assign({m, label:m[1].split(' ')[0]}, monthAgg(m)));
    const withVal=series.filter(r=>r.value!=null);
    const latest=withVal.length?withVal[withVal.length-1]:null;
    const avg=withVal.length?Math.round(withVal.reduce((s,r)=>s+r.value,0)/withVal.length*10)/10:null;
    const onTarget=withVal.filter(r=>higher?r.value>=bench:r.value<=bench).length;
    const tone=P.green;
    const th={textAlign:'left',padding:'7px 9px',fontSize:9.5,textTransform:'uppercase',letterSpacing:'.3px',color:P.muted,fontWeight:700,borderBottom:'1px solid '+P.line,background:P.panel2};
    const thr={...th,textAlign:'right'};
    const tdc={padding:'5px 9px',fontSize:11,color:P.ink2,borderBottom:'1px solid '+P.line2};
    const tdr={...tdc,textAlign:'right',fontFamily:MONO};

    if(part==='overview'){
      const st=whoStat(latest?latest.value:null);
      const cards=[
        ['Latest'+(latest?(' · '+latest.label):''), latest&&latest.value!=null?latest.value+'%':'—', st.color, st.label],
        ['Average', avg!=null?avg+'%':'—', P.blue, withVal.length+' month'+(withVal.length!==1?'s':'')+' reported'],
        ['Benchmark', (higher?'≥ ':'≤ ')+bench+'%', P.violet, 'WHO compliant target'],
        ['Months on target', onTarget+'/'+withVal.length, (withVal.length&&onTarget===withVal.length)?P.green:P.amber, 'within the period'],
      ];
      const chartRows=withVal.map(r=>({mon:r.label, val:r.value}));
      const chartEl=chartRows.length
        ? (typeof window.AreaTargetChart==='function'
            ? window.AreaTargetChart({data:chartRows, x:'mon', y:'val', target:bench, height:205, color:tone, flat:true})
            : (typeof window.LineChart==='function' ? window.LineChart({data:chartRows, x:'mon', y:'val', height:205, color:tone, area:true, flat:true}) : null))
        : <div style={{padding:'22px 0',display:'grid',placeItems:'center',color:P.faint,fontSize:12}}>No hand-hygiene data in this period</div>;
      return (
        <div className="qc-rpage" style={{position:'relative'}}>
          {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
          <Header/>
          <div style={{marginTop:18}}>
            {/* hospital-level aggregate sections — same lead-page contract as every other
                report type; they were silently missing from Hand Hygiene reports. */}
            {lead&&sections.execSummary&&<QCExecSummary chosen={chosen} months={pMonths} rangeLabel={rangeLabel}/>}
            {lead&&sections.periodCompare&&<QCPeriodCompare chosen={chosen} months={pMonths} baseMonths={baseMonths} baselineLabel={baselineLabel}/>}
            {lead&&sections.ragHeatmap&&<QCRagHeatmap chosen={chosen} months={pMonths}/>}
            {lead&&sections.deptRanking&&<QCDeptRanking chosen={chosen} months={pMonths}/>}
            {lead&&sections.benchmarkCompare&&<QCBenchmarkCompare chosen={chosen} months={pMonths}/>}
            <div className="qc-band" style={{display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
              <span style={{width:30,height:30,borderRadius:8,background:tone+'1c',display:'grid',placeItems:'center',flexShrink:0}}><DocIc c={tone}/></span>
              <div style={{fontWeight:700,fontSize:15,color:P.ink}}>Hand Hygiene Compliance</div>
              <span className="tag">WHO 5 Moments · {primary.d.name}</span>
              <span style={{flex:1}}/>
              <span style={{background:st.color+'1c',color:st.color,padding:'3px 10px',borderRadius:20,fontWeight:700,fontSize:11.5}}>{st.label}</span>
            </div>
            <KpiCards cards={cards} tone={tone}/>
            <div style={{margin:'4px 0 8px'}}>
              <div style={uSub}>Monthly compliance trend (%) · target {higher?'≥':'≤'} {bench}%</div>
              {chartEl}
            </div>
            <table className="qc-rpt-tbl" style={{borderCollapse:'collapse',width:'100%',marginTop:12,fontSize:11}}>
              <thead><tr>
                <th style={th}>Month</th><th style={thr}>Compliant</th><th style={thr}>Opportunities</th><th style={thr}>Compliance</th><th style={{...th,textAlign:'center'}}>Status</th>
              </tr></thead>
              <tbody>{series.map(r=>{ const s=whoStat(r.value); return (
                <tr key={r.m[0]}>
                  <td style={{...tdc,fontWeight:600,color:P.ink}}>{r.m[1]}</td>
                  <td style={tdr}>{r.num!=null?r.num.toLocaleString():'—'}</td>
                  <td style={tdr}>{r.den!=null?r.den.toLocaleString():'—'}</td>
                  <td style={{...tdr,fontWeight:700,color:r.value==null?P.faint:P.ink}}>{r.value!=null?r.value+'%':'—'}</td>
                  <td style={{textAlign:'center',padding:'4px 6px'}}><span style={{display:'inline-block',padding:'2px 8px',borderRadius:20,background:s.bg,color:s.color,fontWeight:700,fontSize:10}}>{s.label}</span></td>
                </tr>); })}</tbody>
            </table>
            {lead&&sections.signatures&&<QCSignatureBlock sig={sig} orgName={orgName}/>}
          </div>
          <Footer n={n} total={total}/>
        </div>
      );
    }
    // breakdown page — staff groups (latest month with group data) + by-department
    const gMonth=(()=>{ for(let i=pMonths.length-1;i>=0;i--){ const mk=pMonths[i][0]; const g=pind.mGroups&&pind.mGroups[mk]; if(g&&Object.keys(g).some(k=>g[k]!=null&&g[k]!=='')) return pMonths[i]; } return null; })();
    const GROUP_KEYS=[['nurse','Nurse'],['doctor','Doctor'],['pca','PCA'],['other','Other']];
    // Department-wise audit rows captured on the SUBMISSION (ind.mDeptBreakdown[month] =
    // [{dept, g:{nurse:{n,d},…}}]) — the only place dept-wise HH lives when the audit is
    // recorded on the hospital-wide indicator; latest reported month on the axis wins.
    const bdSrc=(()=>{ for(let i=pMonths.length-1;i>=0;i--){ const mk=pMonths[i][0];
      for(const h of hh){ const b=h.ind.mDeptBreakdown&&h.ind.mDeptBreakdown[mk]; if(Array.isArray(b)&&b.length) return {month:pMonths[i], rows:b}; } }
      return null; })();
    const bdTot=g=>GROUP_KEYS.reduce((a,[k])=>{ const x=(g||{})[k]||{}; return {n:a.n+(Number(x.n)||0), d:a.d+(Number(x.d)||0)}; },{n:0,d:0});
    const bdRows=bdSrc?bdSrc.rows.map(r=>{ const t=bdTot(r.g); return {label:r.dept||'—', g:r.g||{}, n:t.n, d:t.d, value:t.d>0?Math.round(t.n/t.d*10000)/100:null}; })
      .sort((a,b)=>(b.value==null?-1:b.value)-(a.value==null?-1:a.value)):[];
    let groupRows=gMonth?GROUP_KEYS.map(([k,lbl])=>{ const gN=(pind.mGroups[gMonth[0]]||{}); const gD=(pind.mGroupsDen&&pind.mGroupsDen[gMonth[0]])||{}; const nn=Number(gN[k])||0, dd=Number(gD[k])||0; return {label:lbl,n:nn,d:dd,value:dd>0?Math.round(nn/dd*10000)/100:null}; }).filter(r=>r.d>0||r.n>0):[];
    // No indicator-level staff-group entries? Pool them from the dept-wise audit rows.
    if(!groupRows.length&&bdSrc){
      groupRows=GROUP_KEYS.map(([k,lbl])=>{ let n=0,d=0; bdSrc.rows.forEach(r=>{ const x=(r.g||{})[k]||{}; n+=Number(x.n)||0; d+=Number(x.d)||0; }); return {label:lbl,n,d,value:d>0?Math.round(n/d*10000)/100:null}; }).filter(r=>r.d>0||r.n>0);
    }
    // Group ALL hand-hygiene indicators by department, then take each department's compliance
    // at its latest reported month — pooled Σnum/Σden when every reporting indicator has a
    // denominator, else the mean — so a department with >1 HH indicator isn't misrepresented.
    const deptGroups={}; hh.forEach(h=>{ (deptGroups[h.d.key]=deptGroups[h.d.key]||{name:h.d.name, inds:[]}).inds.push(h.ind); });
    const deptLatest=inds=>{ for(let i=pMonths.length-1;i>=0;i--){ const mk=pMonths[i][0];
      let num=0,den=0,ndCount=0,total=0; const comps=[];
      inds.forEach(ind=>{ const v=monthRaw(ind,mk); if(v==null) return; total++; comps.push(v);
        const nn=ind.mNum&&ind.mNum[mk], dd=ind.mDen&&ind.mDen[mk];
        if(nn!=null&&nn!==''&&dd!=null&&dd!==''&&Number(dd)>0){ num+=Number(nn); den+=Number(dd); ndCount++; } });
      if(total){ const value=(ndCount===total&&den>0)?Math.round(num/den*10000)/100:Math.round(comps.reduce((s,x)=>s+x,0)/comps.length*100)/100; return {month:pMonths[i], value}; } }
      return null; };
    const deptRows=Object.keys(deptGroups).map(k=>{ const g=deptGroups[k]; const dl=deptLatest(g.inds); return dl?{label:(g.name||'').slice(0,20), value:dl.value, month:dl.month[1].split(' ')[0]}:null; }).filter(Boolean).sort((a,b)=>b.value-a.value);
    return (
      <div className="qc-rpage" style={{position:'relative'}}>
        {sections.watermark&&<QCWatermark text={confidential?'CONFIDENTIAL':orgName}/>}
        <Header/>
        <div style={{marginTop:18}}>
          <div className="qc-band" style={{display:'flex',alignItems:'center',gap:9,marginBottom:12}}>
            <span style={{width:30,height:30,borderRadius:8,background:P.blue+'1c',display:'grid',placeItems:'center',flexShrink:0}}><DocIc c={P.blue}/></span>
            <div style={{fontWeight:700,fontSize:15,color:P.ink}}>Hand Hygiene — breakdown{bdSrc?(' · '+bdSrc.month[1]):gMonth?(' · '+gMonth[1]):''}</div>
            <span style={{flex:1}}/><span className="tag">by staff group &amp; department</span>
          </div>
          {groupRows.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={uSub}>Compliance by staff group (%)</div>
              {typeof window.BarChart==='function'&&window.BarChart({data:groupRows.map(r=>({label:r.label,val:r.value||0})), x:'label', y:'val', height:175, color:P.blue, flat:true})}
              <table className="qc-rpt-tbl" style={{borderCollapse:'collapse',width:'100%',marginTop:8,fontSize:11}}>
                <thead><tr><th style={th}>Staff group</th><th style={thr}>Compliant</th><th style={thr}>Opportunities</th><th style={thr}>Compliance</th></tr></thead>
                <tbody>{groupRows.map(r=>{ const s=whoStat(r.value); return (
                  <tr key={r.label}><td style={{...tdc,fontWeight:600,color:P.ink}}>{r.label}</td><td style={tdr}>{r.n.toLocaleString()}</td><td style={tdr}>{r.d.toLocaleString()}</td><td style={{...tdr,fontWeight:700,color:s.color}}>{r.value!=null?r.value+'%':'—'}</td></tr>
                ); })}</tbody>
              </table>
            </div>
          )}
          {bdRows.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={uSub}>Department-wise audit · {bdSrc.month[1]} · compliant / observed moments (WHO 5 Moments)</div>
              <table className="qc-rpt-tbl" style={{borderCollapse:'collapse',width:'100%',marginTop:6,fontSize:10.5}}>
                <thead><tr>
                  <th style={th}>Department</th>
                  {GROUP_KEYS.map(([k,lbl])=><th key={k} style={thr}>{lbl}</th>)}
                  <th style={thr}>Total</th><th style={thr}>Compliance</th><th style={{...th,textAlign:'center'}}>Status</th>
                </tr></thead>
                <tbody>{bdRows.map(r=>{ const s=whoStat(r.value); return (
                  <tr key={r.label}>
                    <td style={{...tdc,fontWeight:600,color:P.ink}}>{r.label}</td>
                    {GROUP_KEYS.map(([k])=>{ const x=r.g[k]||{}; const nn=Number(x.n)||0, dd=Number(x.d)||0; return <td key={k} style={tdr}>{(nn||dd)?nn+'/'+dd:'—'}</td>; })}
                    <td style={{...tdr,fontWeight:600}}>{r.d>0?r.n+'/'+r.d:'—'}</td>
                    <td style={{...tdr,fontWeight:700,color:r.value==null?P.faint:P.ink}}>{r.value!=null?r.value+'%':'—'}</td>
                    <td style={{textAlign:'center',padding:'4px 6px'}}><span style={{display:'inline-block',padding:'2px 8px',borderRadius:20,background:s.bg,color:s.color,fontWeight:700,fontSize:9.5}}>{r.value==null?'Not audited':s.label}</span></td>
                  </tr>); })}</tbody>
              </table>
            </div>
          )}
          {(()=>{ // dept compliance chart — audit breakdown first, per-dept HH indicators as fallback
            const audited=bdRows.filter(r=>r.value!=null);
            const src=audited.length?audited.map(r=>({label:(r.label||'').slice(0,20),val:r.value})):deptRows.map(r=>({label:r.label,val:r.value}));
            return src.length>1&&(
              <div style={{marginBottom:14}}>
                <div style={uSub}>Compliance by department ({audited.length?bdSrc.month[1]:'latest reported month'}, %)</div>
                {typeof window.BarChart==='function'&&window.BarChart({data:src, x:'label', y:'val', height:Math.max(170,src.length*26), color:P.violet, flat:true})}
              </div>
            ); })()}
          <div style={{background:'#eef8fc',border:'1px solid #cfe6f7',borderRadius:9,padding:'10px 13px',fontSize:11,color:P.blue700||P.blue}}>
            <b>Interpretation (WHO):</b> ≥ {bench}% compliant · 75–{bench-1}% needs improvement (re-audit within 2 weeks) · &lt; 75% unacceptable (escalate). Reference: WHO (2009) Guidelines on Hand Hygiene in Health Care.
          </div>
        </div>
        <Footer n={n} total={total}/>
      </div>
    );
  }

  /* ---- print / export ---- */
  const doPrint=()=>{
    // Same guard as every export path: with nothing selected the #pdf-root portal is not
    // mounted, so printing produced completely blank pages.
    if(chosen.length===0){ setNote({ok:false,text:'Select at least one department first.'}); return; }
    try{ document.body.classList.add('pdf-export-mode'); window.print(); }catch(e){} finally{ setTimeout(()=>document.body.classList.remove('pdf-export-mode'),500); } };
  async function doExportPDF(){
    const native=window.unicoNative;
    if(chosen.length===0){ setNote({ok:false,text:'Select at least one department first.'}); return; }
    // Desktop app: keep the superior native (Chromium printToPDF, vector) export.
    if(native&&typeof native.exportPDF==='function'&&!native.isWeb){
      setExporting(true); setNote(null); document.body.classList.add('pdf-export-mode');
      try{ const res=await native.exportPDF({pageSize, landscape:orient==='landscape', defaultName:'UNICO-quality-'+reportType+'-report'});
        if(res&&res.ok) setNote({ok:true,text:res.path?('PDF saved · '+res.path):'PDF ready.'});
        else if(res&&res.error) setNote({ok:false,text:res.error});
      }catch(e){ setNote({ok:false,text:String(e&&e.message||e)}); }
      finally{ document.body.classList.remove('pdf-export-mode'); setExporting(false); }
      return;
    }
    // Web: TRUE one-click download — rasterize every report page (html2canvas) into a jsPDF.
    const H=window.html2canvas, J=window.jspdf&&window.jspdf.jsPDF;
    if(H&&J){
      setExporting(true); setNote(null);
      const stage=document.getElementById('pdf-root'); let els=[], prev=[];
      try{
        if(!stage) throw new Error('render target missing');
        document.body.classList.add('qc-pdfcap');
        els=Array.prototype.slice.call(stage.querySelectorAll('.pdf-page'));
        if(!els.length) throw new Error('nothing to export');
        prev=els.map(el=>el.getAttribute('style')||'');
        // Size each report page to an exact on-screen A4 sheet so one capture = one PDF page.
        // Off-screen: give each page the sheet width (portrait OR landscape) at natural height.
        els.forEach(el=>{ el.style.width=pageW+'px'; el.style.boxSizing='border-box'; el.style.padding='28px 30px'; el.style.background='#fff'; el.style.margin='0'; el.style.height='auto'; el.style.overflow='visible'; });
        try{ if(document.fonts&&document.fonts.ready) await document.fonts.ready; }catch(e){}
        await new Promise(r=>setTimeout(r,80));
        const fmt=pageSize==='A3'?'a3':pageSize==='Letter'?'letter':'a4', ori=orient==='landscape'?'l':'p';
        const doc=new J({orientation:ori,unit:'pt',format:fmt,compress:true});
        const pw=doc.internal.pageSize.getWidth(), ph=doc.internal.pageSize.getHeight();
        let firstPage=true;
        for(let i=0;i<els.length;i++){
          const el=els[i];
          // short page -> fill one sheet (footer pinned to bottom); tall page stays natural and is sliced
          if(el.scrollHeight<=pageMinH){ el.style.height=pageMinH+'px'; el.style.overflow='hidden'; }
          // Content-aware slice guards: record every atom (table row, chart, band, incident
          // card, footer) so sheet boundaries land BETWEEN them — blind fixed-step slicing
          // cut rows and text lines in half, diverging from the on-screen preview.
          const elRect=el.getBoundingClientRect();
          const guardsCss=[];
          el.querySelectorAll('tr,svg,.qc-band,.pdf-foot,[style*="break-inside"]').forEach(a=>{
            const r=a.getBoundingClientRect();
            if(r.height>0) guardsCss.push([r.top-elRect.top, r.bottom-elRect.top]);
          });
          // footer band position — the last slice pins it to the sheet bottom (see below)
          const fEl=el.querySelector('.pdf-foot'); let fCss=null;
          if(fEl){ const fr=fEl.getBoundingClientRect(); if(fr.height>0) fCss=[fr.top-elRect.top, fr.bottom-elRect.top]; }
          const canvas=await H(el,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});
          el.style.height='auto'; el.style.overflow='visible';
          const cW=canvas.width, cH=canvas.height, pxPerPt=cW/pw, pageHpx=Math.round(ph*pxPerPt);
          const k=elRect.height>0?(cH/elRect.height):2;
          const guards=guardsCss.map(g=>[g[0]*k, g[1]*k]).filter(g=>(g[1]-g[0])<pageHpx*0.9);
          const fPx=fCss?[fCss[0]*k, fCss[1]*k]:null;
          const pickEnd=(y0,budget)=>{
            if(cH-y0<=budget) return cH;
            let cut=y0+budget;
            for(let pass=0; pass<8; pass++){
              let moved=false;
              for(const g of guards){
                if(g[0]<cut-1 && g[1]>cut+1){ const c2=Math.floor(g[0]); if(c2>y0+budget*0.35){ cut=c2; moved=true; } }
              }
              if(!moved) break;
            }
            return Math.max(cut, y0+Math.round(budget*0.35));
          };
          const crop=(top,h)=>{ const tmp=document.createElement('canvas'); tmp.width=cW; tmp.height=h; tmp.getContext('2d').drawImage(canvas,0,top,cW,h,0,0,cW,h); return tmp.toDataURL('image/jpeg',0.94); };
          // Snap a guard-chosen cut to a truly-BLANK raster row. Guards are measured on the
          // live DOM but slices are cut from the html2canvas re-render, whose layout drifts a
          // few px over a long page — a "cut at card top" then lands a hair inside the card,
          // stranding its border strip on the previous sheet. The canvas is the ground truth,
          // so a cut on an all-white row can never split a bordered/tinted block. Threshold
          // 252 keeps tinted card interiors (#fffafb) and zebra rows non-blank; if no white
          // row exists nearby (tables, watermark band) the guard cut stands.
          const snapCtx=canvas.getContext('2d',{willReadFrequently:true});
          const rowBlank=(yy)=>{ if(yy<=0||yy>=cH) return false; const d=snapCtx.getImageData(0,yy,cW,1).data;
            for(let i=0;i<d.length;i+=4){ if(d[i]<252||d[i+1]<252||d[i+2]<252) return false; } return true; };
          const snapCut=(cut,y0)=>{
            if(rowBlank(cut)) return cut;
            const up=Math.min(90, cut-(y0+24));           // never snap into/behind the slice start
            for(let dY=1; dY<=90; dY++){
              if(dY<=up && rowBlank(cut-dY)) return cut-dY;      // prefer upward: keep the block whole on the next sheet
              if(dY<=8 && cut+dY<cH-1 && rowBlank(cut+dY)) return cut+dY;
            }
            return cut;
          };
          const padPx=Math.round(28*k), padPt=padPx/pxPerPt;   // sheet margin = the 28px sheet padding, at capture scale
          if(cH<=pageHpx+4){
            // short page captured as exactly one sheet — padding + flex-pinned footer baked in
            if(!firstPage) doc.addPage(fmt,ori); firstPage=false;
            doc.addImage(canvas.toDataURL('image/jpeg',0.94),'JPEG',0,0,pw,Math.min(ph,cH/pxPerPt),undefined,'FAST');
          } else {
            let y=0;
            do{
              // Reserve sheet margins per slice: slice 1 has the 28px top padding baked into
              // the capture, continuation slices get it as a draw offset — content no longer
              // starts at the literal top edge of the page, and the usable-height budget now
              // MATCHES the on-screen preview (sheet minus both pads), so breaks line up.
              const first=y===0, top=first?0:padPt, budget=pageHpx-(first?1:2)*padPx;
              let end=pickEnd(y,budget); if(end<cH) end=snapCut(end,y);
              const sliceH=end-y;
              if(!firstPage) doc.addPage(fmt,ori); firstPage=false;
              // Final slice shorter than a sheet: split it at the footer band and pin the
              // footer to the sheet bottom — flowed as-is it floats mid-page after content.
              if(cH-end<=2 && sliceH<budget-4 && fPx && fPx[0]>=y-2 && fPx[0]<end){
                // snap the footer split too — same DOM→raster drift as the page cuts
                const fTop=Math.max(y,snapCut(Math.floor(fPx[0]),y)), contentH=fTop-y, footH=end-fTop;
                if(contentH>2) doc.addImage(crop(y,contentH),'JPEG',0,top,pw,contentH/pxPerPt,undefined,'FAST');
                if(footH>2) doc.addImage(crop(fTop,footH),'JPEG',0,ph-footH/pxPerPt,pw,footH/pxPerPt,undefined,'FAST');
              } else {
                doc.addImage(crop(y,sliceH),'JPEG',0,top,pw,sliceH/pxPerPt,undefined,'FAST');
              }
              y=end;
            } while(cH-y>2);
          }
        }
        els.forEach((el,i)=>el.setAttribute('style',prev[i])); els=[];
        document.body.classList.remove('qc-pdfcap');
        doc.save('UNICO-quality-'+reportType+'-'+new Date().toISOString().slice(0,10)+'.pdf');
        setNote({ok:true,text:'PDF downloaded ('+(ori==='l'?'landscape':'portrait')+').'});
      }catch(e){
        try{ els.forEach((el,i)=>el.setAttribute('style',prev[i])); }catch(_){}
        document.body.classList.remove('qc-pdfcap');
        setNote({ok:false,text:'Direct PDF failed ('+String(e&&e.message||e)+'); opening Print instead.'});
        try{ document.body.classList.add('pdf-export-mode'); window.print(); setTimeout(()=>document.body.classList.remove('pdf-export-mode'),600); }catch(_){}
      }finally{ setExporting(false); }
      return;
    }
    // Last resort: browser print dialog (choose "Save as PDF").
    setExporting(true); setNote(null); document.body.classList.add('pdf-export-mode');
    try{ window.print(); }catch(e){ setNote({ok:false,text:String(e&&e.message||e)}); }
    finally{ document.body.classList.remove('pdf-export-mode'); setExporting(false); }
  }
  function qcExportBuilder(fmt){
    // Single scope contract for EVERY export path: PDF/Print and Excel/Word/CSV all
    // export exactly the on-screen selection. If nothing is selected we early-return
    // with the same note doExportPDF uses (instead of silently exporting all depts),
    // so the four export families can never disagree about what they emit.
    if(chosen.length===0){ setNote({ok:false,text:'Select at least one department first.'}); return; }
    const scope=chosen;
    const date=new Date().toISOString().slice(0,10);
    const baseName='UNICO-quality-'+reportType+'-'+date;
    if(fmt==='csv'){
      const rows=[['Department','Indicator','Benchmark','Goal'].concat(pMonths.map(m=>m[1]))];
      scope.forEach(d=>(d.indicators||[]).forEach(ind=>rows.push(
        [d.name,ind.name,benchExpr(ind),ind.goalDirection==='higher_is_better'?'higher is better':'lower is better']
        .concat(pMonths.map(m=>{ const v=qcCellVal(ind,m); return qStatus(ind,v)==='na'?'':fmtVal(ind,v); })))));
      rows.push([]); rows.push(['INCIDENT DETAILS']); rows.push(['Department','Indicator','Month','UHID','Patient','Age','Sex','Diagnosis','Details','Finding','Corrective','Preventive']);
      // period-scoped like every report page — the CSV used to dump incidents from ANY year
      scope.forEach(d=>qcIncidentsOf(d).filter(r=>qcIncInPeriod(r,pMonths)).forEach(r=>{ const x=r.x; rows.push([d.name,r.ind,r.month,x.uhid||'',x.patientName||'',x.age||'',x.gender||'',x.diagnosis||'',x.details||'',x.finding||'',x.corrective||'',x.preventive||'']); }));
      return qcDownload('﻿'+rows.map(r=>r.map(c=>'"'+((c==null?'':c)+'').replace(/"/g,'""')+'"').join(',')).join('\r\n'), baseName+'.csv','text/csv;charset=utf-8');
    }
    // Honour the Page setup control (A4 / A3 / Letter + orientation) in the exported
    // Office doc, instead of hardcoding A4 as the inherited stats msExport does.
    const page=pageSize+(orient==='landscape'?' landscape':'');
    const html='<html xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page{size:'+page+';margin:1cm}</style></head><body>'
      +'<h1 style="font-family:Calibri;color:#0072a3;margin:0">'+qcEsc(hdrTitle)+'</h1>'
      +'<div style="font-family:Calibri;color:#555;margin:2px 0 12px">'+qcEsc(orgName)+' · '+qcEsc(rangeLabel)+(confidential?' · Confidential':'')+'</div>'
      // the builder's OWN year + period axis (noTitle: the header above already says it) —
      // qcReportHTML used to recompute defaultFy and export a different year than claimed
      +qcReportHTML(scope, pMonths, fy, {noTitle:true})+'</body></html>';
    if(fmt==='excel') return qcDownload(html, baseName+'.xls','application/vnd.ms-excel');
    if(fmt==='word')  return qcDownload(html, baseName+'.doc','application/msword');
  }

  // ONE-CLICK REPORT: select ALL departments + full fiscal year + a template preset, then export
  // AFTER the off-screen report portal has re-rendered with the new selection (a render tick — not
  // synchronously in the click handler, or it would capture the previous selection).
  // NOTE: setPendingExport(null) must happen INSIDE the timeout — clearing it synchronously
  // re-ran this effect ('pdf' -> null), whose cleanup clearTimeout()ed the very timer it had
  // just scheduled, so the one-click "Generate NQI Report" button silently did NOTHING.
  React.useEffect(()=>{ if(!pendingExport) return; const f=pendingExport;
    const t=setTimeout(()=>{ setPendingExport(null); if(f==='pdf'){ doExportPDF(); } else { qcExportBuilder(f); } }, 90); return ()=>clearTimeout(t); },[pendingExport]);
  const generateFullReport=(fmt,tpl)=>{ setSelectedDepts(allKeys); setIndMode('all'); setPeriod({mode:'all'}); applyTemplate(tpl||'board'); setPendingExport(fmt||'pdf'); };

  const pdfRoot = typeof document!=='undefined' ? document.getElementById('pdf-root') : null;
  const chevStyle={width:28,height:28,borderRadius:7,border:'1px solid '+P.line,background:'#fff',display:'grid',placeItems:'center',color:P.muted,cursor:'pointer'};

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <style>{'.qc-rpage{display:flex;flex-direction:column;flex:1 0 auto}.qc-rpage .pdf-foot{margin-top:auto}@media print{.qc-rpage{display:block}.qc-rpage .pdf-foot{margin-top:12px}}body.qc-pdfcap #pdf-root{display:block !important;position:fixed;left:-11000px;top:0;z-index:-1}'}</style>
      {/* title bar + toolbar */}
      <div style={{display:'flex',alignItems:'center',gap:13,flexWrap:'wrap'}}>
        <div style={{width:40,height:40,borderRadius:11,background:'#eef8fc',color:'#0090ca',display:'grid',placeItems:'center',flexShrink:0}}><DocIc c="#0090ca"/></div>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{margin:0,fontSize:21,fontWeight:700,color:P.ink,letterSpacing:'-.3px'}}>Report Builder</h1>
          <div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Compose and export board-ready quality reports</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          {/* ONE-CLICK: all departments + full fiscal year + a board-ready template, exported in one go. */}
          <button onClick={()=>generateFullReport('pdf','board')} disabled={exporting} title="One click: all departments + full reporting year + Board template -> complete report"
            style={{...expBtn,background:P.green,borderColor:P.green,color:'#fff',fontWeight:700,opacity:exporting?.6:1}}><DownIc/>{exporting?'Generating…':'Generate NQI Report'}</button>
          <select value={activeTemplate} onChange={e=>{ const v=e.target.value; if(v==='custom'){ setActiveTemplate('custom'); } else { applyTemplate(v); } }} title="Report template preset"
            style={{...expBtn,paddingRight:22,cursor:'pointer'}}>
            <option value="custom">Custom preset…</option>
            {Object.keys(QC_TEMPLATES).map(k=><option key={k} value={k}>{QC_TEMPLATES[k].label}</option>)}
          </select>
          <span style={{width:1,height:22,background:P.line,margin:'0 2px'}}/>
          <button onClick={doPrint} disabled={chosen.length===0} style={{...expBtn,opacity:chosen.length===0?.6:1,cursor:chosen.length===0?'default':'pointer'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>Print</button>
          <button onClick={()=>doExportPDF()} disabled={exporting||chosen.length===0} style={{...expBtn,background:P.blue,borderColor:P.blue,color:'#fff',opacity:(exporting||chosen.length===0)?.6:1}}><DownIc/>{exporting?'Exporting…':'Export PDF'}</button>
          {[['excel','Excel'],['word','Word'],['csv','CSV']].map(([f,l])=>
            <button key={f} onClick={()=>qcExportBuilder(f)} disabled={chosen.length===0} style={{...expBtn,opacity:chosen.length===0?.6:1,cursor:chosen.length===0?'default':'pointer'}}><DownIc/>{l}</button>)}
        </div>
      </div>

      {note&&(
        <div onClick={()=>setNote(null)} style={{display:'flex',alignItems:'center',gap:9,padding:'10px 14px',borderRadius:8,fontSize:12.5,fontWeight:600,cursor:'pointer',
          color:note.ok?P.green:P.rose,background:note.ok?'#e7f6ed':'#fbe9ec',border:'1px solid '+(note.ok?'#bfe6cd':'#f1c6cd')}}>
          <span style={{wordBreak:'break-all'}}>{note.text}</span><span style={{flex:1}}/><span style={{fontSize:15}}>✕</span>
        </div>
      )}

      {/* off-screen portal — renders EVERY page for print / export regardless of the pager.
          Driven off the SAME `pages` memo the on-screen pager uses (single source of truth),
          branching per page KIND rather than per report TYPE, so a future multi-page
          comparison automatically flows into the PDF instead of silently dropping pages. */}
      {pdfRoot && chosen.length>0 && ReactDOM.createPortal(
        <div className={"pdf-doc"+(portrait?' portrait':'')}>
          {/* Honour the Page setup control on the WEB print path too. theme.css only
              defines A4 @page rules (rpt-land/rpt-port); this dynamic override makes
              window.print()/PDF respect the chosen A4/A3/Letter + orientation so the
              printed sheet matches the on-screen preview and the Office export. */}
          {/* the .pdf-doc.portrait selector variant must be included too: theme.css's
              'body.pdf-export-mode .pdf-doc.portrait .pdf-page' rule (hardcoded A4) has
              higher specificity and silently overrode A3/Letter PORTRAIT page setups */}
          <style>{'@media print{body.pdf-export-mode .pdf-doc .pdf-page,body.pdf-export-mode .pdf-doc.portrait .pdf-page{page:qc-rpt-sheet}@page qc-rpt-sheet{size:'+pageSize+(portrait?' portrait':' landscape')+';margin:6mm}}'}</style>
          {pages.map((pg,i)=>(
            <section className="pdf-page" key={i}>
              {pg.kind==='cover'
                ? <CoverPage n={i+1} total={pages.length}/>
                : pg.kind==='toc'
                ? <TocPage page={pg} n={i+1} total={pages.length}/>
                : pg.kind==='appendix'
                ? <AppendixPage n={i+1} total={pages.length}/>
                : pg.kind==='refs'
                ? <RefsPage n={i+1} total={pages.length}/>
                : pg.kind==='compare'
                ? <ComparePage n={i+1} total={pages.length}/>
                : pg.kind==='heatmap'
                ? <HeatmapPage page={pg} n={i+1} total={pages.length} lead={i===leadIdx}/>
                : pg.kind==='monthly'
                ? <MonthlyPage page={pg} n={i+1} total={pages.length} lead={i===leadIdx}/>
                : pg.kind==='hh'
                ? <HHPage page={pg} n={i+1} total={pages.length} lead={i===leadIdx}/>
                : <DeptPage page={pg} n={i+1} total={pages.length} lead={i===leadIdx}/>}
            </section>
          ))}
        </div>, pdfRoot)}

      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:16,alignItems:'start'}}>
        {/* configuration */}
        <div style={{background:'#fff',border:'1px solid '+P.line,borderRadius:12}}>
          <div style={{padding:'13px 16px',borderBottom:'1px solid '+P.line2}}><h3 style={{margin:0,fontSize:13.5,fontWeight:600,color:P.ink}}>Configuration</h3></div>
          <div style={{padding:16,display:'flex',flexDirection:'column',gap:16}}>
            {/* ---- saved report formats — reusable custom presets (localStorage) ---- */}
            <div style={{background:'#f4fbfe',border:'1px solid '+P.line,borderRadius:9,padding:'12px 13px'}}>
              {fieldLabel('Saved report formats')}
              <div style={{display:'flex',gap:6}}>
                <select value={presetSel} onChange={e=>loadFormat(e.target.value)} style={{...sel2,flex:1}}>
                  <option value="">{presets.length?'Load a saved format...':'No saved formats yet'}</option>
                  {presets.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <button onClick={()=>presetSel&&delFormat(presetSel)} disabled={!presetSel} title="Delete selected format" style={{...expBtn,opacity:presetSel?1:.45,cursor:presetSel?'pointer':'default'}}>Delete</button>
              </div>
              <div style={{display:'flex',gap:6,marginTop:8}}>
                <input value={presetName} onChange={e=>setPresetName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveFormat();}} placeholder="Name this format..." style={{...sel2,flex:1}}/>
                <button onClick={saveFormat} style={{...expBtn,background:P.blue,borderColor:P.blue,color:'#fff',fontWeight:700}}>Save current</button>
              </div>
              <div style={{fontSize:11,color:P.muted,marginTop:7}}>Stores <b>every</b> setting on this page: type, period, departments, selected indicators, sections, header/footer &amp; page setup, so you can regenerate the exact same custom format next time.</div>
            </div>
            <div>
              {fieldLabel('Template — one-click preset')}
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {Object.keys(QC_TEMPLATES).map(id=>{ const on=activeTemplate===id;
                  return <button key={id} onClick={()=>applyTemplate(id)} style={pill(on)}>{on&&<Tick/>}{QC_TEMPLATES[id].label}</button>; })}
                <button onClick={()=>setActiveTemplate('custom')} style={pill(activeTemplate==='custom')}>{activeTemplate==='custom'&&<Tick/>}Custom</button>
              </div>
              <div style={{fontSize:11,color:P.muted,marginTop:6}}>Applies a full section preset + report type. Toggling any section below switches to <b>Custom</b>.</div>
            </div>
            <div>
              {fieldLabel('Report type')}
              <div className="seg" style={{width:'100%',flexWrap:'wrap'}}>
                {[['summary','Summary'],['detail','Detailed'],['heatmap','Heatmap'],['monthly','Monthly'],['compare','Comparison'],['handhygiene','Hand Hygiene']].map(([id,l])=>(
                  <button key={id} className={reportType===id?'on':''} style={{flex:'1 1 30%',minWidth:0,padding:'7px 4px',fontSize:11.5,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} onClick={()=>{setReportType(id);setPageIdx(0);setActiveTemplate('custom');}}>{l}</button>
                ))}
              </div>
              <div style={{fontSize:11,color:P.muted,marginTop:6}}>
                {reportType==='summary'?'KPI cards + chart per department, one page each.':reportType==='detail'?'Every indicator × month with benchmark & RAG, per department.':reportType==='heatmap'?'Year-wise indicator × DEPARTMENT matrix (all departments on one page, like the NQI sheet), colour-coded by status, with the year’s occurred-incident details.':reportType==='monthly'?'Month-wise, ALL-department matrix (indicator × department) — one page per month, with that month’s occurred-incident details (like the NQI monthly sheet).':reportType==='handhygiene'?'WHO-style Hand Hygiene Compliance report — monthly compliance trend vs the ≥ benchmark, staff-group (Nurse / Doctor / PCA / Other) and by-department breakdown. Uses the selected departments’ hand-hygiene indicators.':'All selected departments on one comparison page.'}
              </div>
            </div>
            <div>
              {fieldLabel('Reporting year')}
              <select value={fy} onChange={e=>{setFy(Number(e.target.value));setPeriod({mode:'all'});setPageIdx(0);}} style={{...sel2,width:'100%'}}>
                {fyOptions(depts).map(y=><option key={y} value={y}>{fyLabelOf(y)}{y===currentFy()?' · current':''}</option>)}
              </select>
              <div style={{fontSize:11,color:P.muted,marginTop:6}}>Reporting year runs Jan–Dec. Switch it to view a different year; every page below follows this selection.</div>
            </div>
            <div>
              {fieldLabel('Reporting period')}
              <select value={period.mode} onChange={e=>setPeriod({mode:e.target.value,from:MONTHS[0][0],to:MONTHS[11][0]})} style={{...sel2,width:'100%'}}>
                <option value="all">Full {fyLabelOf(fy)} ({MONTHS[0][1]} – {MONTHS[11][1]})</option>
                <option value="q1">Q1 · {qSpan('Q1')}</option>
                <option value="q2">Q2 · {qSpan('Q2')}</option>
                <option value="q3">Q3 · {qSpan('Q3')}</option>
                <option value="q4">Q4 · {qSpan('Q4')}</option>
                <option value="h1">First half ({spanLabel(0,5)})</option>
                <option value="h2">Second half ({spanLabel(6,11)})</option>
                <option value="last3">Last 3 months</option>
                <option value="custom">Custom range…</option>
              </select>
              {period.mode==='custom'&&(
                <div style={{display:'flex',gap:8,marginTop:8,alignItems:'center'}}>
                  <select value={period.from} onChange={e=>setPeriod(p=>({...p,from:e.target.value}))} style={{...sel2,flex:1}}>{MONTHS.map(m=><option key={m[0]} value={m[0]}>{m[1]}</option>)}</select>
                  <span style={{fontSize:12,color:P.muted}}>to</span>
                  <select value={period.to} onChange={e=>setPeriod(p=>({...p,to:e.target.value}))} style={{...sel2,flex:1}}>{MONTHS.map(m=><option key={m[0]} value={m[0]}>{m[1]}</option>)}</select>
                </div>
              )}
            </div>
            <div>
              {fieldLabel('Chart styles — pick one or more (each renders per department)')}
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {QC_REPORT_STYLES.map(([id,l])=>{ const on=chartStyles.includes(id);
                  return <button key={id} onClick={()=>toggleStyle(id)} style={pill(on)}>{on&&<Tick/>}{l}</button>; })}
              </div>
            </div>
            <div>
              {fieldLabel('Header & footer editor')}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <input value={hdrTitle} onChange={e=>setHdrTitle(e.target.value)} placeholder="Report title (header)" style={{...sel2,width:'100%'}}/>
                <input value={hdrSub} onChange={e=>setHdrSub(e.target.value)} placeholder="Subtitle (optional)" style={{...sel2,width:'100%'}}/>
                <input value={orgName} onChange={e=>setOrgName(e.target.value)} placeholder="Footer — hospital / org name" style={{...sel2,width:'100%'}}/>
                <input value={footerNote} onChange={e=>setFooterNote(e.target.value)} placeholder="Footer note (optional)" style={{...sel2,width:'100%'}}/>
                <div style={{display:'flex',gap:16}}>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:P.ink2}}><input type="checkbox" checked={showLogo} onChange={e=>setShowLogo(e.target.checked)}/>Show logo</label>
                  <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:P.ink2}}><input type="checkbox" checked={confidential} onChange={e=>setConfidential(e.target.checked)}/>Confidential mark</label>
                </div>
              </div>
            </div>
            <div>
              {fieldLabel('Page setup')}
              <div style={{display:'flex',gap:8}}>
                <select value={pageSize} onChange={e=>setPageSize(e.target.value)} style={{...sel2,flex:1}}><option>A4</option><option>A3</option><option>Letter</option></select>
                <div className="seg">
                  {[['portrait','Portrait'],['landscape','Landscape']].map(([id,l])=>(
                    <button key={id} className={orient===id?'on':''} onClick={()=>setOrient(id)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div style={{fontSize:11.5,fontWeight:600,color:P.ink2,marginBottom:7,display:'flex'}}>Departments<span style={{flex:1}}/>
                <button onClick={()=>setSelectedDepts(selectedDepts.length===depts.length?[]:allKeys)} style={{border:0,background:'none',color:P.blue,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                  {selectedDepts.length===depts.length?'Clear all':'Select all'}</button>
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {depts.map(d=>{ const on=selectedDepts.includes(d.key);
                  return <button key={d.key} onClick={()=>toggleDept(d.key)} style={{...pill(on),maxWidth:170,overflow:'hidden'}}>{on&&<Tick/>}<span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</span></button>; })}
              </div>
            </div>

            {/* ---- custom indicator selection — narrows every page & export ---- */}
            <div>
              <div style={{fontSize:11.5,fontWeight:600,color:P.ink2,marginBottom:7,display:'flex',alignItems:'center'}}>Indicators
                <span style={{flex:1}}/>
                <div className="seg" style={{fontSize:10}}>
                  {[['all','All'],['custom','Custom']].map(([id,l])=>(
                    <button key={id} className={indMode===id?'on':''} style={{padding:'4px 10px'}} onClick={()=>setIndMode(id)}>{l}</button>
                  ))}
                </div>
              </div>
              {indMode==='all'
                ? <div style={{fontSize:11,color:P.muted}}>All indicators of the selected departments are included. Switch to <b>Custom</b> to choose specific indicators.</div>
                : <div>
                    <input value={indQ} onChange={e=>setIndQ(e.target.value)} placeholder="Search indicators..." style={{...sel2,width:'100%',marginBottom:6}}/>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                      <span style={{fontSize:11,color:P.muted}}><b style={{color:P.ink}}>{indSel.size}</b> selected</span><span style={{flex:1}}/>
                      <button onClick={()=>setManyInd(indShown.map(x=>x.key),true)} style={{border:0,background:'none',color:P.blue,fontSize:11,fontWeight:600,cursor:'pointer'}}>Select shown</button>
                      <button onClick={()=>setManyInd(indShown.map(x=>x.key),false)} style={{border:0,background:'none',color:P.muted,fontSize:11,fontWeight:600,cursor:'pointer'}}>Clear shown</button>
                    </div>
                    <div style={{maxHeight:230,overflowY:'auto',border:'1px solid '+P.line2,borderRadius:8,padding:'6px 8px'}}>
                      {chosenRaw.length===0 ? <div style={{fontSize:11,color:P.faint,padding:8}}>Select at least one department above first.</div>
                       : indShown.length===0 ? <div style={{fontSize:11,color:P.faint,padding:8}}>No indicators match your search.</div>
                       : chosenRaw.map(d=>{ const items=indShown.filter(x=>x.d.key===d.key); if(!items.length) return null;
                          return (<div key={d.key} style={{marginBottom:6}}>
                            <div style={uSub}>{d.name}</div>
                            {items.map(({i,key})=>(
                              <label key={key} style={{display:'flex',alignItems:'center',gap:7,fontSize:11.5,color:P.ink2,padding:'2px 0',cursor:'pointer'}}>
                                <input type="checkbox" checked={indSel.has(key)} onChange={()=>toggleInd(key)}/>
                                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.name}</span>
                              </label>
                            ))}
                          </div>);
                        })}
                    </div>
                    <div style={{fontSize:11,color:P.muted,marginTop:6}}>Only the ticked indicators appear in the preview, PDF, Excel, Word &amp; CSV. Departments with none ticked are omitted.</div>
                  </div>}
            </div>

            {/* ---- section toggles — every content block respects its flag ---- */}
            <div>
              {fieldLabel('Report sections')}
              {[['Content',[['execSummary','Executive summary'],['kpis','KPI cards'],['chart','Charts'],['breachDonut','Breach donut'],['table','Month table'],['incidents','Incident details'],['indicatorDetail','Indicator detail (detailed type)']]],
                ['Analytics',[['ragHeatmap','RAG heatmap'],['deptRanking','Department ranking'],['benchmarkCompare','Benchmark vs actual'],['indTrend','Indicator trend lines'],['periodCompare','Period comparison']]],
                ['Structure',[['cover','Cover page'],['toc','Table of contents'],['incidentAppendix','Incident & CAPA appendix'],['standardsRefs','Standards references'],['watermark','Watermark'],['signatures','Signature block']]]
              ].map(([grp,items])=>(
                <div key={grp} style={{marginBottom:8}}>
                  <div style={uSub}>{grp}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 10px',marginTop:4}}>
                    {items.map(([k,l])=>(
                      <label key={k} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:P.ink2,cursor:'pointer'}}>
                        <input type="checkbox" checked={!!sections[k]} onChange={e=>setSec(k,e.target.checked)}/>
                        <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {sections.periodCompare&&(
              <div>
                {fieldLabel('Comparison baseline')}
                <div className="seg" style={{width:'100%'}}>
                  {[['prev','Previous period'],['yoy','Year-over-year']].map(([id,l])=>(
                    <button key={id} className={compareBaseline===id?'on':''} style={{flex:1,padding:'7px 4px'}} onClick={()=>setCompareBaseline(id)}>{l}</button>
                  ))}
                </div>
              </div>
            )}

            {sections.signatures&&(
              <div>
                {fieldLabel('Signatures')}
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <input value={sig.prepared} onChange={e=>setSig(s=>({...s,prepared:e.target.value}))} placeholder="Prepared by (name)" style={{...sel2,width:'100%'}}/>
                  <input value={sig.reviewed} onChange={e=>setSig(s=>({...s,reviewed:e.target.value}))} placeholder="Checked by (name)" style={{...sel2,width:'100%'}}/>
                  <input value={sig.approved} onChange={e=>setSig(s=>({...s,approved:e.target.value}))} placeholder="Approved by (name)" style={{...sel2,width:'100%'}}/>
                </div>
              </div>
            )}

            <div style={{background:P.panel2,border:'1px solid '+P.line,borderRadius:8,padding:'11px 13px',fontSize:12,color:P.muted}}>
              <b style={{color:P.ink}}>{chosen.length}</b> departments · <b style={{color:P.ink}}>{reportType}</b> · {pageSize} {orient} · {pMonths.length} month{pMonths.length!==1?'s':''}
            </div>
          </div>
        </div>

        {/* live preview */}
        <div style={{background:'#fff',border:'1px solid '+P.line,borderRadius:12,padding:0,overflow:'hidden'}}>
          <div className="card-h" style={{background:P.panel2}}>
            <h3 style={{margin:0,fontSize:13.5,fontWeight:600,color:P.ink}}>Live Preview</h3>
            <span className="sub" style={{fontSize:11.5,color:P.muted}}>{pageSize} · {orient}</span>
            <span style={{flex:1}}/>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <button style={{...chevStyle,opacity:pi<=0?.4:1,cursor:pi<=0?'default':'pointer'}} disabled={pi<=0} onClick={()=>setPageIdx(p=>Math.max(0,p-1))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{transform:'rotate(180deg)'}}><path d="M9 18l6-6-6-6"/></svg></button>
              <span style={{fontFamily:MONO,fontSize:11.5,fontWeight:600,color:P.ink2}}>Page {pi+1} of {pageCount}</span>
              <button style={{...chevStyle,opacity:pi>=pageCount-1?.4:1,cursor:pi>=pageCount-1?'default':'pointer'}} disabled={pi>=pageCount-1} onClick={()=>setPageIdx(p=>Math.min(pageCount-1,p+1))}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
            </div>
          </div>
          <div style={{padding:26,background:'#eef1f5',overflowX:'auto'}}>
            {(chosen.length===0 || !cur)
              ? <div style={{background:'#fff',borderRadius:4,boxShadow:'0 4px 18px rgba(0,0,0,.12)',padding:'28px 30px',width:pageW,minHeight:pageMinH,boxSizing:'border-box',margin:'0 auto'}}>
                  <div style={{textAlign:'center',color:P.faint,padding:'60px 0'}}>{chosen.length===0?(indMode==='custom'?'Tick at least one indicator (Custom mode), or switch Indicators back to All.':'Select at least one department.'):'Nothing to preview.'}</div>
                </div>
              : <QCPagedPreview key={pi+'|'+reportType+'|'+pageSize+'|'+orient+'|'+chosen.length+'|'+pMonths.length+'|'+indSel.size} pageW={pageW} pageMinH={pageMinH}>
                  {cur.kind==='cover' ? <CoverPage n={pi+1} total={pageCount}/>
                    : cur.kind==='toc' ? <TocPage page={cur} n={pi+1} total={pageCount}/>
                    : cur.kind==='appendix' ? <AppendixPage n={pi+1} total={pageCount}/>
                    : cur.kind==='refs' ? <RefsPage n={pi+1} total={pageCount}/>
                    : cur.kind==='compare' ? <ComparePage n={pi+1} total={pageCount}/>
                    : cur.kind==='heatmap' ? <HeatmapPage page={cur} n={pi+1} total={pageCount} lead={pi===leadIdx}/>
                    : cur.kind==='monthly' ? <MonthlyPage page={cur} n={pi+1} total={pageCount} lead={pi===leadIdx}/>
                    : cur.kind==='hh' ? <HHPage page={cur} n={pi+1} total={pageCount} lead={pi===leadIdx}/>
                    : <DeptPage page={cur} n={pi+1} total={pageCount} lead={pi===leadIdx}/>}
                </QCPagedPreview>}
          </div>
        </div>
      </div>
    </div>
  );
}
function QCReports({depts}){ return <QCReportBuilder depts={depts}/>; }

/* ===== part: mod-incidents.jsx ===== */
function QCIncidents({depts,Q}){
  const [dept,setDept]=useState('all');
  const [sel,setSel]=useState(null);
  const [fy,setFy]=useState(()=>defaultFy(depts));
  const MONTHS=fyAxis(fy);

  const list=useMemo(()=>{
    const out=[];
    (depts||[]).forEach(d=>{
      if(dept!=='all' && d.key!==dept) return;
      (d.indicators||[]).forEach(ind=>{
        // A month is listed when it BREACHES the benchmark OR has a logged incident
        // report — an approved incident on an on-benchmark reading (e.g. one fall at
        // 2.6 vs ≤ 3.3, or an NSI with no computable rate) must still appear here.
        const monthIncs = mk => (ind.incidents&&Array.isArray(ind.incidents[mk]))?ind.incidents[mk].filter(x=>x&&Object.values(x).some(v=>v)):[];
        const hasMonthly = MONTHS.some(m=>monthRaw(ind,m[0])!=null || monthIncs(m[0]).length);
        if(hasMonthly){
          MONTHS.forEach(m=>{
            const breach = monthStatus(ind,m[0])==='breach';
            const incs = monthIncs(m[0]);
            if(breach || incs.length){
              out.push({
                dept:d.name,
                deptKey:d.key,
                ind:ind.name,
                cat:ind.category,
                period:'month',
                month:m[1],
                value:fmtVal(ind,monthRaw(ind,m[0])),
                bench:benchExpr(ind),
                breach:breach,
                incCount:incs.length,
                indObj:ind,
                monthKey:m[0],
                deptObj:d
              });
            }
          });
        } else {
          // Fallback: the shipped data stores values per QUARTER with no monthly
          // breakdown, so surface quarter-level breaches instead — otherwise seeded
          // breaches (e.g. NICU ETT Q2 = 8.3) would never appear.
          QORDER.forEach(q=>{
            if(qtrStatus(ind,q,fy)==='breach'){
              out.push({
                dept:d.name,
                deptKey:d.key,
                ind:ind.name,
                cat:ind.category,
                period:'quarter',
                month:qtrLabelOf(q),
                value:fmtVal(ind,qtrRaw(ind,q,fy)),
                bench:benchExpr(ind),
                breach:true,
                incCount:0,
                indObj:ind,
                quarter:q,
                monthKey:q,
                deptObj:d
              });
            }
          });
        }
      });
    });
    return out;
  },[depts,dept,fy]);

  const rows=list.slice(0,150);
  const empty=list.length===0;
  const options=[{key:'all',label:'All departments'}].concat((depts||[]).map(d=>({key:d.key,label:d.name})));

  if(sel){
    return <IncidentReport rec={sel} onBack={()=>setSel(null)} Q={Q}/>;
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:13,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{width:40,height:40,borderRadius:11,background:'#fbe9ec',color:P.rose,display:'grid',placeItems:'center',flexShrink:0}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2 6 4-14 2 8h6"></path></svg>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <h1 style={{margin:0,fontSize:21,fontWeight:700,color:P.ink,letterSpacing:'-.3px'}}>Incident Reports</h1>
          <div style={{fontSize:12.5,color:P.muted,marginTop:2}}><b style={{color:P.rose}}>{list.length}</b> benchmark breaches &amp; logged incidents in {fyLabelOf(fy)} — each needs review</div>
        </div>
        <QCFyPicker fy={fy} setFy={setFy} depts={depts}/>
        <select value={dept} onChange={e=>setDept(e.target.value)} style={{padding:'8px 11px',border:'1px solid '+P.line,borderRadius:8,fontSize:12.5,fontWeight:600,background:'#fff',color:P.ink,outline:'none'}}>
          {options.map(o=>(<option key={o.key} value={o.key}>{o.label}</option>))}
        </select>
      </div>

      {empty && (
        <div style={{background:'#fff',border:'1px solid '+P.line,borderRadius:12,padding:50,textAlign:'center',color:P.green,fontWeight:600}}>✓ No breaches or logged incidents in scope — all reported indicators on benchmark.</div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:9}}>
        {rows.map((x,i)=>(
          <div key={x.deptKey+'|'+x.ind+'|'+x.month+'|'+i} onClick={()=>setSel(x)} onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 3px 10px rgba(20,32,46,.12)';e.currentTarget.style.borderColor=P.rose;}} onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 1px 2px rgba(20,32,46,.05)';e.currentTarget.style.borderColor=P.line;}} style={{cursor:'pointer',background:'#fff',border:'1px solid '+P.line,borderLeft:'3px solid '+(x.breach?P.rose:'#e0a300'),borderRadius:10,boxShadow:'0 1px 2px rgba(20,32,46,.05)',padding:'12px 15px',display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',transition:'box-shadow .12s,border-color .12s'}}>
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
              <div style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:x.breach?P.rose:P.ink2}}>{x.value}</div>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10,color:P.faint,textTransform:'uppercase',letterSpacing:'.3px'}}>Benchmark</div>
              <div style={{fontFamily:MONO,fontSize:12,fontWeight:600,color:P.blue700}}>{x.bench}</div>
            </div>
            {x.breach
              ? <span style={{fontSize:10.5,fontWeight:600,color:P.rose,background:'#fbe9ec',padding:'3px 10px',borderRadius:20}}>Breach{x.incCount?(' · '+x.incCount+' incident'+(x.incCount>1?'s':'')):''}</span>
              : <span style={{fontSize:10.5,fontWeight:600,color:'#9a6b00',background:'#fff4e0',padding:'3px 10px',borderRadius:20}}>{x.incCount+' incident'+(x.incCount>1?'s':'')+' logged'}</span>}
            <span style={{fontSize:11.5,fontWeight:600,color:P.blue,whiteSpace:'nowrap'}}>View report ›</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Detailed, printable-looking incident report ("page") for a single breach.
   Layout adapts to the indicator TYPE: event indicators (Count) get an incident
   register with per-patient CAPA cards; percentage/rate indicators get a
   compliance-gap analysis. Reuses the file's shared helpers/globals only. ---- */
function IncidentReport({rec,onBack,Q}){
  // Read the indicator LIVE from the store (when available) so admin edits made on
  // this page reflect immediately; fall back to the frozen rec snapshot otherwise.
  const liveDep = (Q && Array.isArray(Q.depts)) ? Q.depts.find(d => d.key === rec.deptKey) : null;
  const liveInd = liveDep ? (liveDep.indicators || []).find(i => i.id === rec.indObj.id) : null;
  const ind = liveInd || rec.indObj;
  const dep = liveDep || rec.deptObj;
  const [editing, setEditing] = useState(false);
  const gd = guideOf(stdMatch(rec.ind)) || {};
  const meas = measureOf(ind.formula);
  // A rec may be month-keyed (rec.period==='month') or quarter-keyed (rec.period==='quarter'),
  // the latter when the data has no monthly breakdown. `periodWord` labels the copy.
  const isQtr = rec.period==='quarter';
  const periodWord = isQtr ? 'quarter' : 'month';
  const remark = isQtr
    ? ((ind.quarterRemarks && ind.quarterRemarks[rec.quarter]) || '')
    : ((ind.monthRemarks && ind.monthRemarks[rec.monthKey]) || '');

  const card = {background:'#fff',border:'1px solid '+P.line,borderRadius:12,boxShadow:'0 1px 2px rgba(20,32,46,.05)',padding:'16px 18px'};
  const lbl = {fontSize:10,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4};
  const secTitle = {fontSize:14,fontWeight:700,color:P.ink,margin:'0 0 12px',letterSpacing:'-.2px'};

  const defRow = (label,value,mono)=>(
    <div style={{display:'flex',flexDirection:'column',gap:2,minWidth:0}}>
      <div style={lbl}>{label}</div>
      <div style={{fontSize:12.5,color:P.ink2,lineHeight:1.5,fontFamily:mono?MONO:'inherit',wordBreak:'break-word'}}>{value}</div>
    </div>
  );

  // Trend cells — 12 months normally, or 4 quarters when the rec is quarter-keyed
  // (quarter-only data has no monthly series to plot).
  const trend = isQtr
    ? QORDER.map(q=>{
        const raw = qtrRaw(ind,q);
        return { key:q, short:q, val:fmtVal(ind,raw), status:qtrStatus(ind,q), here:q===rec.quarter };
      })
    : fyAxis(fyOfKey(rec.monthKey)!=null?fyOfKey(rec.monthKey):currentFy()).map(m=>{
        const raw = monthRaw(ind,m[0]);
        return { key:m[0], short:m[1].split(' ')[0], val:fmtVal(ind,raw), status:monthStatus(ind,m[0]), here:m[0]===rec.monthKey };
      });
  const cellBg = s => s==='breach' ? '#fbe9ec' : s==='ok' ? '#e7f6ed' : '#eef1f5';
  const cellFg = s => s==='breach' ? P.rose : s==='ok' ? P.green : P.faint;

  // breach-period statistics (total + trailing consecutive up to & incl. this period)
  let totalBreach = 0;
  trend.forEach(t=>{ if(t.status==='breach') totalBreach++; });
  let consecutive = 0;
  const hereIdx = trend.findIndex(t=>t.here);
  for(let j=(hereIdx<0?trend.length-1:hereIdx); j>=0; j--){ if(trend[j].status==='breach') consecutive++; else break; }

  const isEvent = isEventIndicator(ind);

  // compliance-analysis numbers (for pct / rate indicators)
  const rawNow = Number(isQtr ? qtrRaw(ind,rec.quarter) : monthRaw(ind,rec.monthKey));
  const benchNum = Number(ind.benchmarkValue);
  const hasGap = !isEvent && isFinite(rawNow) && ind.benchmarkValue!=null && ind.benchmarkValue!=='' && isFinite(benchNum);
  const gap = hasGap ? (Math.round((rawNow-benchNum)*100)/100) : null;
  const unitWord = rateUnitWord(ind);
  const higher = ind.goalDirection==='higher_is_better';
  const gapDir = gap==null ? '' : (gap<0 ? 'below' : gap>0 ? 'above' : 'at');

  const incidents = (ind.incidents && ind.incidents[isQtr ? rec.quarter : rec.monthKey]) || [];
  const remarkShownInSection = (isEvent && incidents.length===0 && remark) || (!isEvent && remark);

  // Live header value/status (reflects edits). QCIndEdit is month-keyed, so inline
  // editing is offered only for month recs (quarter-only legacy data stays read-only).
  const liveStatus = isQtr ? qtrStatus(ind,rec.quarter) : monthStatus(ind,rec.monthKey);
  const isBreachNow = liveStatus==='breach';
  const liveValue = liveStatus==='na' ? '—' : fmtVal(ind, isQtr ? qtrRaw(ind,rec.quarter) : monthRaw(ind,rec.monthKey));
  const canEdit = qcCanEdit() && !!Q && !isQtr;

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>

      {/* HEADER card */}
      <div style={Object.assign({},card,{borderTop:'3px solid '+(isBreachNow?P.rose:P.green)})}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}}>
          <button onClick={onBack} style={{background:'none',border:'1px solid '+P.line,borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:600,color:P.ink2,cursor:'pointer'}}>← Back to incidents</button>
          {canEdit && (
            <button onClick={()=>setEditing(e=>!e)} title={editing?'Close editor':'Edit this reading & incident report'} style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:6,border:'1px solid #cfe6f4',background:editing?'#0090ca':'#eef8fc',color:editing?'#fff':'#0090ca',padding:'6px 13px',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>
              {editing?'Close editor':'Edit report'}
            </button>
          )}
        </div>
        <div style={{display:'flex',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:220}}>
            <div style={{fontSize:19,fontWeight:700,color:P.ink,letterSpacing:'-.3px'}}>{rec.ind}</div>
            <div style={{fontSize:12.5,color:P.muted,marginTop:4}}>{rec.dept} · {rec.cat} · {meas.name}</div>
            <div style={{fontSize:11.5,color:P.faint,marginTop:2}}>Reporting {periodWord} — {rec.month}</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={lbl}>Recorded value</div>
            <div style={{fontFamily:MONO,fontSize:30,fontWeight:700,color:isBreachNow?P.rose:P.green,lineHeight:1.1}}>{liveValue}</div>
            <div style={{fontSize:11.5,color:P.ink2,marginTop:4}}>Benchmark <span style={{fontFamily:MONO,fontWeight:600,color:P.blue700}}>{benchExpr(ind)}</span></div>
            <span style={{display:'inline-block',marginTop:6,fontSize:10.5,fontWeight:700,color:isBreachNow?P.rose:P.green,background:isBreachNow?'#fbe9ec':'#e7f6ed',padding:'3px 10px',borderRadius:20}}>{isBreachNow?'Breach':liveStatus==='na'?'No reading':'On benchmark'}</span>
          </div>
        </div>
      </div>

      {/* inline admin editor — reuses the same form as the Dashboard drill-down */}
      {canEdit && editing && (
        <QCIndEdit dep={dep} ind={ind} mk={rec.monthKey} mlabel={rec.month} Q={Q} onClose={()=>setEditing(false)}/>
      )}

      {/* Indicator definition */}
      <div style={card}>
        <h3 style={secTitle}>Indicator definition</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:14}}>
          {defRow('Formula',formulaText(ind),true)}
          {defRow('Benchmark',benchExpr(ind),true)}
          {defRow('Goal',higher?'Higher is better':'Lower is better')}
          {defRow('Numerator',ind.numLabel||gd.numDef||'—')}
          {defRow('Denominator',ind.denLabel||gd.denDef||'—')}
          {defRow('Reference',ind.reference||gd.reference||'—')}
        </div>
        {gd.example && (
          <div style={{background:'#eef8fc',border:'1px solid #dceffa',borderRadius:9,padding:'11px 13px',marginTop:14}}>
            <div style={{fontSize:9.5,fontWeight:700,color:P.blue700,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:4}}>Worked example</div>
            <div style={{fontSize:11.5,color:P.blue700,lineHeight:1.55,fontFamily:MONO}}>{gd.example}</div>
          </div>
        )}
      </div>

      {/* trend — 12 months, or 4 quarters when the data is quarter-keyed */}
      <div style={card}>
        <h3 style={secTitle}>{isQtr?'4-quarter trend':'12-month trend'} — {rec.dept}</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat('+(isQtr?4:12)+',1fr)',gap:6}}>
          {trend.map(t=>(
            <div key={t.key} style={{textAlign:'center',padding:'7px 3px',borderRadius:7,background:cellBg(t.status),border:t.here?('2px solid '+P.rose):'1px solid transparent',boxShadow:t.here?'0 0 0 2px rgba(210,58,82,.15)':'none'}}>
              <div style={{fontSize:9.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:'.3px'}}>{t.short}</div>
              <div style={{fontFamily:MONO,fontSize:11.5,fontWeight:700,color:cellFg(t.status),marginTop:3}}>{t.status==='na'?'·':t.val}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:11,color:P.faint,marginTop:10}}>Highlighted cell = the breached {periodWord} under review. {totalBreach} breach{totalBreach===1?'':'es'} across the fiscal year.</div>
      </div>

      {/* TAILORED SECTION — different report system per indicator type */}
      {isEvent ? (
        <div style={card}>
          <h3 style={secTitle}>Incident register — {rec.month}</h3>
          {incidents.length ? (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {incidents.map((inc,ii)=>{
                const patient = [
                  ['UHID',inc.uhid],['Patient name',inc.patientName],
                  ['Age · Gender',[inc.age,inc.gender].filter(Boolean).join(' · ')],
                  ['Date of incident',inc.incidentDate],['Diagnosis',inc.diagnosis],['Date of admission',inc.admissionDate],['Date of procedure',inc.procedureDate]
                ].filter(r=>r[1]!=null && r[1]!=='');
                const capa = [
                  ['Incident details',inc.details],['Finding / observation',inc.finding],
                  ['Corrective action',inc.corrective],['Preventive action',inc.preventive],['Remark',inc.remark]
                ].filter(r=>r[1]!=null && r[1]!=='');
                return (
                  <div key={inc.id||inc.uhid||ii} style={{border:'1px solid '+P.line,borderLeft:'3px solid '+P.rose,borderRadius:10,padding:'13px 15px',background:P.panel2}}>
                    <div style={{fontSize:11,fontWeight:700,color:P.rose,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:9}}>Incident {ii+1}</div>
                    {patient.length>0 && (
                      <div style={{marginBottom:capa.length?12:0}}>
                        <div style={{fontSize:10.5,fontWeight:700,color:P.blue700,marginBottom:7}}>Patient</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10}}>
                          {patient.map(r=>(<div key={r[0]}>{defRow(r[0],r[1])}</div>))}
                        </div>
                      </div>
                    )}
                    {capa.length>0 && (
                      <div>
                        <div style={{fontSize:10.5,fontWeight:700,color:P.violet,marginBottom:7}}>Investigation &amp; CAPA</div>
                        <div style={{display:'flex',flexDirection:'column',gap:9}}>
                          {capa.map(r=>(<div key={r[0]}>{defRow(r[0],r[1])}</div>))}
                        </div>
                      </div>
                    )}
                    {patient.length===0 && capa.length===0 && (
                      <div style={{fontSize:12,color:P.faint,fontStyle:'italic'}}>No detail fields were logged for this incident.</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div style={{background:'#fff7e6',border:'1px solid #f0dcae',borderRadius:9,padding:'12px 14px',fontSize:12.5,color:P.ink2,lineHeight:1.55}}>
                <span style={{fontWeight:700,color:P.amber}}>ⓘ </span>{rec.value} recorded this {periodWord}, but no per-incident detail was logged via Data Collection.
              </div>
              {remark && (
                <div style={{marginTop:12}}>{defRow(isQtr?'Quarter remark':'Month remark',remark)}</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={card}>
          <h3 style={secTitle}>Compliance analysis</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:14}}>
            {defRow(isQtr?'This quarter':'This month',rec.value,true)}
            {defRow('Benchmark',rec.bench,true)}
            {defRow('Gap',gap==null?'—':((gap>0?'+':'')+gap+' '+unitWord),true)}
            {defRow('Consecutive breach '+periodWord+'s',String(consecutive),true)}
          </div>
          {gap!=null && (
            <div style={{background:P.panel2,border:'1px solid '+P.line,borderRadius:9,padding:'12px 14px',marginTop:14,fontSize:12.5,color:P.ink2,lineHeight:1.55}}>
              {rec.value} is {Math.abs(gap)} {unitWord} {gapDir} the {rec.bench} target
              {gapDir==='below'&&higher ? ' — direction of concern for this indicator.' : gapDir==='above'&&!higher ? ' — direction of concern for this indicator.' : '.'}
              {' '}This {periodWord} is part of {consecutive} consecutive breach {periodWord}{consecutive===1?'':'s'} ({totalBreach} in the fiscal year).
            </div>
          )}
          {remark && (
            <div style={{marginTop:14}}>{defRow(isQtr?'Quarter remark':'Month remark',remark)}</div>
          )}
        </div>
      )}

      {/* FOOTER */}
      <div style={{fontSize:11.5,color:P.muted,padding:'0 4px 8px'}}>
        Corrective actions are tracked in Action Plans.
        {remark && !remarkShownInSection ? <span> · {isQtr?'Quarter':'Month'} remark: {remark}</span> : null}
      </div>

    </div>
  );
}

/* ===== part: mod-actionplans.jsx ===== */
function QCActionPlans({depts}){
  const [capa,setCapa]=useState(()=>{try{return JSON.parse(localStorage.getItem('unico_capa_v1'))||{}}catch(e){return{}}});
  useEffect(()=>{try{localStorage.setItem('unico_capa_v1',JSON.stringify(capa))}catch(e){}},[capa]);
  const [fy,setFy]=useState(()=>defaultFy(depts));
  const MONTHS=fyAxis(fy);

  const plans=useMemo(()=>{
    const out=[];
    (depts||[]).forEach(d=>(d.indicators||[]).forEach(ind=>{
      // last reported MONTH in the selected fiscal year + its breach state; if the indicator
      // has no monthly data (legacy quarter-only), fall back to its last reported quarter.
      let lastBreach=false, sawMonthly=false;
      for(let i=MONTHS.length-1;i>=0;i--){ const st=monthStatus(ind,MONTHS[i][0]); if(st!=='na'){ sawMonthly=true; lastBreach=(st==='breach'); break; } }
      if(!sawMonthly){ let lastQ=null; QORDER.forEach(Q=>{ if(qtrRaw(ind,Q,fy)!=null) lastQ=Q; }); lastBreach = lastQ!=null && qtrStatus(ind,lastQ,fy)==='breach'; }
      const nBreach = countBreaches(ind, MONTHS);
      if(!(lastBreach || nBreach>=3)) return; // only current / persistent breaches get a plan
      const key=d.key+'/'+ind.id;
      out.push({
        key, dept:d.name, ind:ind.name, cat:ind.category||catOf(ind.name),
        breaches:nBreach, bench:benchExpr(ind), status:capa[key]||'Open'
      });
    }));
    return out;
  },[depts,capa,fy]);

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
          <div style={{fontSize:12.5,color:P.muted,marginTop:2}}>Corrective &amp; preventive actions for breached indicators · {fyLabelOf(fy)} — click status to advance</div>
        </div>
        <span style={{flex:1}}/>
        <QCFyPicker fy={fy} setFy={setFy} depts={depts}/>
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
  // `depts` = only departments that already report an indicator (used for the grouped
  // Manage listing where empty groups are intentionally hidden). `allDepts` = every
  // department, used wherever we need to ASSIGN/move/scope — otherwise a department
  // with zero indicators is invisible and can never receive its first indicator.
  const allDepts = (Q.depts||[]);
  const depts = allDepts.filter(d=>(d.indicators||[]).length);

  const [view,setView]=useState('manage');            // manage | assign | catalog
  const [assignQ,setAssignQ]=useState('');            // Assign-by-Department indicator search
  const [tab,setTab]=useState('identity');
  const [sel,setSel]=useState(()=> initialDept? {deptKey:initialDept,id:null} : {deptKey:null,id:null});
  const [scope,setScope]=useState('all');
  const [mf,setMf]=useState('all');                   // measure filter: all|Count|Rate|Percentage
  const [sf,setSf]=useState('all');                   // status filter: all|data|breach
  const [copyOpen,setCopyOpen]=useState(false);
  const [copyT,setCopyT]=useState({});
  const [expand,setExpand]=useState('');
  // Fiscal year for the monthly data-entry grid — defaults to the most recent year that has
  // data so current-year values can be entered immediately; the picker pages back to edit
  // history. Shadows the module MONTHS for the grid + its patch handlers only.
  const [entryFy,setEntryFy]=useState(()=>defaultFy(allDepts));
  const MONTHS=fyAxis(entryFy);
  // Scope for DEFINITION edits on a shared indicator: 'one' (default — only this
  // department's copy changes) or 'shared' (sync to every department with this id).
  // Resets to the safe default whenever a different indicator is selected.
  const [editScope,setEditScope]=useState('one');
  useEffect(()=>{ setEditScope('one'); },[sel.deptKey,sel.id]);
  // "Fill all 12 months" convenience value for the month-wise admin headcount editor.
  const [hcAll,setHcAll]=useState('');
  useEffect(()=>{ setHcAll(''); },[sel.deptKey,sel.id,entryFy]);

  const CATS = ['Healthcare-Associated Infection','Infection Prevention','Patient Safety','Clinical Outcomes','Staff Safety','Staff Competency','Activity / Volume','Medication Safety'];
  const FREQ = ['Monthly','Quarterly','Annually','Bi-annually'];
  const FORMULAS = [['direct','Direct value — enter the number as-is'],['count','Count — a running tally (numerator only)'],['avg','Average (mean) — numerator ÷ denominator (e.g. avg length of stay)'],['rate1000','Rate per 1000 — numerator ÷ denominator × 1000'],['rate100','Rate per 100 — numerator ÷ denominator × 100'],['pct','Percentage — numerator ÷ denominator × 100']];
  const DIRS = [['lower_is_better','↓ Lower is better'],['higher_is_better','↑ Higher is better']];
  const FORMULA_HINT = {
    direct:'The value is entered directly each month; no numerator/denominator needed.',
    count:'A simple count (e.g. number of events). Only the numerator is captured.',
    avg:'A mean/average — numerator ÷ denominator with no multiplier (e.g. average length of stay = total patient-hours ÷ number of patients). Quarters roll up as the opportunity-weighted average (Σ numerator ÷ Σ denominator).',
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

  const heatOf = (ind)=> QORDER.map(Qn=>{ const s=qtrStatus(ind,Qn,entryFy); const [bg,fg,sym]=STATUS_CELL[s]; const v=qtrRaw(ind,Qn,entryFy); return { bg,fg,sym, title: Qn+': '+(v==null?'not reported':v)+(s==='breach'?' · breach':s==='ok'?' · on benchmark':'') }; });

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

  const scopeOptions=[{key:'all',label:'All departments'}].concat(allDepts.map(d=>({key:d.key,label:d.name+' · '+(d.indicators||[]).length})));

  // ---- selected indicator (live from store) ----
  const selInd = sel.deptKey && sel.id ? findInd(sel.deptKey,sel.id) : null;
  const selDept = selInd ? (Q.depts||[]).find(d=>d.key===sel.deptKey) : null;

  // ---- edit helpers (ALL through Q) ----
  const patch = (obj)=>{ if(sel.deptKey&&sel.id) Q.patchIndicator(sel.deptKey,sel.id,obj); };
  // COMMON INDICATOR MODULE — now SCOPED. Definition edits used to fan out to EVERY
  // department sharing the indicator id unconditionally, so editing "one" indicator
  // silently rewrote it hospital-wide. Default is now THIS department's copy only;
  // the admin opts into hospital-wide sync per edit session with the editScope toggle
  // in the editor header. (Month VALUES were always per-department via `patch`.)
  const patchShared = (obj)=>{
    if(!sel.id) return;
    const targets = (Q.depts||[]).filter(d=>(d.indicators||[]).some(i=>i.id===sel.id)).map(d=>d.key);
    if(sel.deptKey && targets.indexOf(sel.deptKey)<0) targets.push(sel.deptKey);
    targets.forEach(k=> Q.patchIndicator(k, sel.id, obj));
  };
  const patchDef = (obj)=> (editScope==='shared' ? patchShared(obj) : patch(obj));
  const patchField = (f)=> (e)=> patchDef({[f]:e.target.value});
  const patchMonthVal = (idx)=> (e)=>{ const v=e.target.value; const nv=(v===''?null:Number(v)); const obj={ months:{ [MONTHS[idx][0]]: nv } }; if(selInd && selInd.formula==='count') obj.mNum={ [MONTHS[idx][0]]: nv }; patch(obj); };
  const patchMonthNum = (idx)=> (e)=>{ const v=e.target.value; patch({ mNum:{ [MONTHS[idx][0]]: (v===''?null:Number(v)) } }); };
  const patchMonthDen = (idx)=> (e)=>{ const v=e.target.value; patch({ mDen:{ [MONTHS[idx][0]]: (v===''?null:Number(v)) } }); };
  const patchMonthRemark = (idx)=> (e)=> patch({ monthRemarks:{ [MONTHS[idx][0]]: e.target.value } });

  const onClone = ()=>{ if(!selInd) return; const copy=Object.assign({},selInd,{ id:window.qualitySlug(selInd.name+' copy'), name:selInd.name+' (copy)' }); Q.addIndicator(sel.deptKey,copy); setSel({deptKey:sel.deptKey,id:copy.id}); };
  const onDelete = ()=>{ if(!selInd) return; Q.removeIndicator(sel.deptKey,sel.id); setSel({deptKey:null,id:null}); setCopyOpen(false); setCopyT({}); };
  const onMove = (e)=>{ const nd=e.target.value; if(!selInd||nd===sel.deptKey) return; const moved=Object.assign({},selInd); Q.addIndicator(nd,moved); Q.removeIndicator(sel.deptKey,sel.id); setSel({deptKey:nd,id:moved.id}); };
  const onDoCopy = ()=>{ if(!selInd) return; Object.keys(copyT).forEach(dk=>{ if(copyT[dk]){ const c=Object.assign({},selInd,{ id:window.qualitySlug(selInd.name) }); Q.addIndicator(dk,c); } }); setCopyOpen(false); setCopyT({}); };

  const meas = selInd? measureOf(selInd.formula) : null;
  // every department reporting the SAME indicator id — drives the edit-scope banner
  const sharedIdDepts = selInd ? (Q.depts||[]).filter(d=>(d.indicators||[]).some(i=>i.id===sel.id)) : [];
  const sharedOthers = sharedIdDepts.filter(d=>d.key!==sel.deptKey).map(d=>d.name);
  const dirHigh = selInd && selInd.goalDirection==='higher_is_better';
  const benchSet = selInd && selInd.benchmarkValue!=null && selInd.benchmarkValue!=='';
  const needsNum = selInd && selInd.formula!=='direct';
  const needsDen = selInd && (selInd.formula==='rate1000'||selInd.formula==='rate100'||selInd.formula==='pct'||selInd.formula==='avg');

  // ---- assign matrix ----
  // Rows = EVERY catalog indicator (all 96 in the Formula Library / HQI_STANDARDS)
  // so ANY of them can be assigned to ANY department — not only the ones already in
  // use. Existing department indicators are matched to their catalog code via
  // stdMatch(); an indicator matching no standard is kept as its own "custom" row so
  // nothing already assigned disappears.
  const assignShort = (nm)=>{ const s=(nm||'').replace(/\s*(Ward|Department)\s*/g,' ').trim(); return s.length>12 ? s.slice(0,11).trim()+'…' : s; };
  const assignCols = allDepts.map(d=>({key:d.key, short:assignShort(d.name), name:d.name}));
  const stdTemplate = (s)=>{ const ft=s.ft||'direct'; return {
    name:s.name, formula:ft,
    valueType: ft==='pct'?'%':(ft==='rate1000'||ft==='rate100')?'Rate':'Count',
    unit:s.unit||'', numLabel:s.num||'Numerator', denLabel:s.den||'Denominator',
    benchmark:s.bench||'', benchmarkValue:(s.bv==null?'':s.bv),
    goalDirection: s.dir==='high'?'higher_is_better':'lower_is_better',
    reference:s.ref||'', formulaText:s.expr||'', months:{},
  }; };
  const rowsByKey={};
  const stdByName={}; // normalized catalog name -> std row key: a safety net so an in-use
  // indicator whose name IS a catalog indicator but which stdMatch() has no alias for still
  // merges into the one catalog row instead of spawning a duplicate "custom" row.
  ((typeof HQI_STANDARDS!=='undefined'&&HQI_STANDARDS)||[]).forEach(s=>{
    const rk='std:'+s.code;
    rowsByKey[rk]={ key:rk, code:s.code, name:s.name, formula:s.ft||'direct', tmpl:stdTemplate(s), set:new Set() };
    if(!stdByName[norm(s.name)]) stdByName[norm(s.name)]=rk;
  });
  depts.forEach(d=>(d.indicators||[]).forEach(i=>{
    const code=stdMatch(i.name);
    const rk = (code && rowsByKey['std:'+code]) ? 'std:'+code : stdByName[norm(i.name)];
    if(rk){ const row=rowsByKey[rk]; row.set.add(d.key); (row.used||(row.used={}))[i.name]=(row.used[i.name]||0)+1; }
    else { const k='cus:'+norm(i.name); if(!rowsByKey[k]) rowsByKey[k]={ key:k, code:null, name:i.name, formula:i.formula, tmpl:i, set:new Set() }; rowsByKey[k].set.add(d.key); }
  }));
  // A catalog row that is IN USE shows the department's ACTUAL indicator name (what they
  // report under) so "Assign by Department" matches "Manage Indicators" exactly for every
  // indicator; unused catalog rows keep their standard name. Also align the add-template so
  // newly-ticked departments inherit that same in-use name instead of minting a variant.
  Object.values(rowsByKey).forEach(r=>{
    if(r.used){ const best=Object.keys(r.used).sort((a,b)=>r.used[b]-r.used[a])[0]; if(best){ r.name=best; if(r.tmpl) r.tmpl=Object.assign({},r.tmpl,{name:best}); } }
  });
  const assignNames = Object.values(rowsByKey).sort((a,b)=> (a.name||'').localeCompare(b.name||'')); // STABLE alphabetical: ticking a cell no longer reorders rows
  const assignCount = {}; assignCols.forEach(c=>{ assignCount[c.key] = assignNames.reduce((n,r)=> n + (r.set.has(c.key)?1:0), 0); });
  const _aq = assignQ.trim().toLowerCase();
  const assignRows = _aq ? assignNames.filter(r=> (r.name||'').toLowerCase().includes(_aq)) : assignNames;
  const toggleAssign = (rec,dk)=>{
    if(rec.set.has(dk)){
      const d=(Q.depts||[]).find(x=>x.key===dk);
      const inst=d&&(d.indicators||[]).find(x=> (rec.code && stdMatch(x.name)===rec.code) || norm(x.name)===norm(rec.name));
      if(inst) Q.removeIndicator(dk,inst.id);
    } else {
      // If this department's SEED already carries this indicator and a previous unassign
      // hid it (overlay indRemoved), RESTORE the original — re-ticking used to mint an
      // empty twin with a fresh id while all the recorded/approved data stayed hidden on
      // the removed original (Level 10 "submitted but not showing" bug).
      const seedD=(window.QUALITY_SEED||[]).find(x=>x.key===dk);
      const seedInst=seedD&&(seedD.indicators||[]).find(x=> (rec.code && stdMatch(x.name)===rec.code) || norm(x.name)===norm(rec.name));
      if(seedInst){ Q.restoreIndicator(dk,seedInst.id); return; }
      const c=Object.assign({},rec.tmpl,{ id:window.qualitySlug(rec.tmpl.name||rec.name) }); Q.addIndicator(dk,c);
    }
  };

  // ---- catalog / formula library ----
  const STD = (typeof HQI_STANDARDS!=='undefined' && HQI_STANDARDS) || [];
  const useCount={};
  depts.forEach(d=>(d.indicators||[]).forEach(i=>{ const c=stdMatch(i.name); if(c){ (useCount[c]=useCount[c]||new Set()).add(d.key); } }));
  const ql2=(q||'').trim().toLowerCase();
  const catGroups={};
  STD.forEach(s=>{ if(ql2 && !((s.name||'').toLowerCase().includes(ql2)||(s.expr||'').toLowerCase().includes(ql2)||(s.ref||'').toLowerCase().includes(ql2)||(s.code||'').toLowerCase()===ql2)) return; (catGroups[s.sec]=catGroups[s.sec]||[]).push(s); });
  const measTypeC = f=>({pct:'%',rate1000:'Rate',rate100:'Rate',avg:'Rate',count:'Count',direct:'Count'}[f]||'Count');
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

                {/* SHARED indicator — edit-scope control. Edits used to sync hospital-wide
                    with no warning; now the admin chooses per session, default this-dept. */}
                {sharedOthers.length>0 && (
                <div style={{marginTop:9,display:'flex',alignItems:'center',gap:9,flexWrap:'wrap',border:'1px solid '+(editScope==='shared'?'#f0d9a8':'#dde3ec'),background:editScope==='shared'?'#fff8ec':'#f7f9fc',borderRadius:8,padding:'7px 11px'}}>
                  <span title={'Also in: '+sharedOthers.join(', ')} style={{fontSize:11.5,fontWeight:600,color:editScope==='shared'?'#9a6b00':P.ink2}}>
                    Common indicator — also in <b>{sharedOthers.length}</b> other department{sharedOthers.length!==1?'s':''} <span style={{fontWeight:400,color:P.muted}}>({sharedOthers.slice(0,3).join(', ')}{sharedOthers.length>3?' +'+(sharedOthers.length-3)+' more':''})</span>
                  </span>
                  <span style={{flex:1}}/>
                  <span style={{fontSize:10.5,fontWeight:700,color:P.muted,textTransform:'uppercase',letterSpacing:.3}}>Apply edits to</span>
                  {[['one','This department only'],['shared','All '+sharedIdDepts.length+' departments']].map(([id,l])=>{ const on=editScope===id; return (
                    <button key={id} onClick={()=>setEditScope(id)} title={id==='one'?'Changes affect only '+(selDept?selDept.name:'this department')+"'s copy":'Definition changes sync to every department listed (monthly values always stay per-department)'}
                      style={{border:'1px solid '+(on?P.blue:'#dde3ec'),background:on?P.blue:'#fff',color:on?'#fff':P.ink2,padding:'4px 11px',borderRadius:20,fontSize:11,fontWeight:700,cursor:'pointer'}}>{l}</button>
                  ); })}
                  {editScope==='shared'&&<span style={{width:'100%',fontSize:10.5,color:'#9a6b00'}}>Name, formula, benchmark &amp; definition edits now update every department above. Monthly values always stay per-department.</span>}
                </div>
                )}

                {copyOpen && (
                <div style={{marginTop:11,border:'1px solid #dceffa',borderRadius:9,background:'#eef8fc',padding:'11px 13px'}}>
                  <div style={{fontSize:11.5,fontWeight:600,marginBottom:8,color:P.ink}}>Copy this indicator (with its values) to:</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:6}}>
                    {allDepts.filter(d=>d.key!==sel.deptKey).map(d=>(
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
                  {/* Admin-owned denominator, MONTH-WISE: the staff headcount changes month to
                      month, so each month has its own input (the old single value silently
                      overwrote every month). Always hospital-wide via patchShared. */}
                  {needsDen && !!selInd.denAdminOnly && <div style={{display:'flex',flexDirection:'column',gap:7,gridColumn:'1 / -1',background:'#fff4e0',border:'1px solid #f0d9a8',borderRadius:8,padding:'11px 13px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <label style={{fontSize:11.5,fontWeight:700,color:'#9a6b00'}}>{(selInd.denLabel||'Total healthcare workers')} — hospital-wide headcount, month by month <span style={{fontWeight:400,fontSize:10.5,color:'#b07d15'}}>admin-set · applies to every department; collectors see it read-only</span></label>
                      <span style={{flex:1}}/>
                      <QCFyPicker fy={entryFy} setFy={setEntryFy} depts={allDepts} style={{padding:'5px 8px',fontSize:11.5}}/>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(96px,1fr))',gap:7}}>
                      {MONTHS.map(mm=>{ const v=selInd.mDen&&selInd.mDen[mm[0]];
                        return (
                        <div key={mm[0]} style={{display:'flex',flexDirection:'column',gap:3}}>
                          <label style={{fontSize:10,fontWeight:700,color:'#b07d15',fontFamily:MONO}}>{mm[1]}</label>
                          <input type="number" step="any" value={(v==null||v==='')?'':v}
                            onChange={e=>patchShared({mDen:{ [mm[0]]: e.target.value===''?null:Number(e.target.value) }})}
                            placeholder="—" style={{padding:'7px 8px',border:'1px solid #dde3ec',borderRadius:7,fontSize:12.5,fontFamily:MONO,background:'#fff',outline:'none',width:'100%',boxSizing:'border-box'}}/>
                        </div>);
                      })}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                      <input type="number" step="any" value={hcAll} onChange={e=>setHcAll(e.target.value)} placeholder={'Same figure for all 12 months of '+fyLabelOf(entryFy)+'…'}
                        style={{padding:'7px 10px',border:'1px solid #dde3ec',borderRadius:7,fontSize:12.5,fontFamily:MONO,background:'#fff',outline:'none',width:250}}/>
                      <button onClick={()=>{ if(hcAll==='') return; const v=Number(hcAll); patchShared({mDen: MONTHS.reduce((o,mm)=>{o[mm[0]]=v; return o;},{})}); setHcAll(''); }}
                        style={{border:'1px solid #d8a63c',background:'#fff',color:'#9a6b00',padding:'6px 12px',borderRadius:7,fontSize:11.5,fontWeight:700,cursor:'pointer'}}>Fill all months</button>
                      <span style={{fontSize:10.5,color:'#b07d15'}}>Fills every month of {fyLabelOf(entryFy)}; you can then adjust individual months above.</span>
                    </div>
                  </div>}
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
                    <div style={{display:'flex',flexDirection:'column',gap:5}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Benchmark value <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>drives status</span></label><input type="number" value={selInd.benchmarkValue==null?'':selInd.benchmarkValue} onInput={e=>patchDef({benchmarkValue: e.target.value===''?null:Number(e.target.value)})} onChange={e=>patchDef({benchmarkValue: e.target.value===''?null:Number(e.target.value)})} placeholder="e.g. 0 or 90" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,fontFamily:MONO,background:'#fff',outline:'none',textAlign:'right'}}/></div>
                    <div style={{display:'flex',flexDirection:'column',gap:5,gridColumn:'1 / -1'}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Benchmark description <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>free text shown on reports</span></label><input value={selInd.benchmark||''} onInput={patchField('benchmark')} onChange={patchField('benchmark')} placeholder="e.g. 0 (zero defect) · ≥ 90% of moments" style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}/></div>
                  </div>
                </div>
                )}

                {/* VALUES */}
                {tab==='values' && (
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:11}}>
                    <div style={{fontSize:11.5,color:P.muted,flex:1,minWidth:220}}>{needsDen ? ('Enter '+(selInd.numLabel||'numerator')+' ÷ '+(selInd.denLabel||'denominator')+' for each month — the value computes from the formula and rolls up into quarters automatically.') : ('Enter each month’s value ('+MONTHS[0][1]+' – '+MONTHS[11][1]+'). Leave a month blank to mark it not reported; quarters roll up automatically.')}</div>
                    <span style={{fontSize:11,color:P.muted,fontWeight:600,textTransform:'uppercase',letterSpacing:'.3px'}}>Reporting year</span>
                    <QCFyPicker fy={entryFy} setFy={setEntryFy} depts={allDepts} style={{padding:'6px 9px',fontSize:12}}/>
                  </div>
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
                    {QORDER.map(Qn=>{ const v=qtrRaw(selInd,Qn,entryFy); const s=qStatus(selInd,v); const col=s==='breach'?P.rose:s==='ok'?P.green:P.faint; return (
                      <span key={Qn} style={{fontFamily:MONO,fontSize:12,color:P.muted}}>{Qn} <b style={{color:col}}>{v==null?'—':(selInd.formula==='pct'?v+'%':v)}</b></span>
                    ); })}
                    <span style={{fontSize:10.5,color:P.faint}}>· auto-summed from months · feeds the Quarterly Report</span>
                  </div>
                </div>
                )}

                {/* PLACEMENT */}
                {tab==='place' && (
                <div>
                  <div style={{display:'flex',flexDirection:'column',gap:5,maxWidth:280,marginBottom:18}}><label style={{fontSize:11.5,fontWeight:600,color:P.ink2}}>Department <span style={{color:P.faint,fontWeight:400,fontSize:10.5}}>move this indicator</span></label><select value={sel.deptKey} onChange={onMove} style={{padding:'9px 11px',border:'1px solid #dde3ec',borderRadius:8,fontSize:13,background:'#fff',outline:'none'}}>{allDepts.map(d=><option key={d.key} value={d.key}>{d.name}</option>)}</select></div>
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
        <div style={{padding:'13px 16px',borderBottom:'1px solid #e8edf3',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:200}}><div style={{fontSize:13.5,fontWeight:700,color:P.ink}}>Assign by Department</div><div style={{fontSize:11.5,color:P.muted}}>Which department reports which indicator — all {assignNames.length} catalog indicators. Tick a cell to assign / unassign.</div></div>
          <input value={assignQ} onChange={e=>setAssignQ(e.target.value)} placeholder="Search indicator..." style={{padding:'8px 11px',border:'1px solid '+P.line,borderRadius:8,fontSize:12.5,background:'#fff',outline:'none',minWidth:230}}/>
          {_aq && <span style={{fontSize:11.5,color:P.muted,whiteSpace:'nowrap'}}>{assignRows.length} of {assignNames.length}</span>}
        </div>
        {/* Crosshair hover: the hovered ROW tints (incl. the sticky name cell) and the
            hovered COLUMN is shaded by a tall ::after overlay clipped by the scroll box —
            so it is always obvious WHICH indicator × WHICH department a cell belongs to.
            (!important beats the sticky cell's inline #fff background.) */}
        <style>{'.qc-asgn .qa-x{position:relative}'
          +'.qc-asgn .qa-x:hover::after{content:"";position:absolute;left:0;right:0;top:-6000px;bottom:-6000px;background:rgba(0,144,202,.08);pointer-events:none}'
          +'.qc-asgn tbody tr:hover td{background:#f0f8fd}'
          +'.qc-asgn tbody tr:hover td.qa-name{background:#e8f4fb !important;box-shadow:inset 3px 0 0 #0090ca}'}</style>
        <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'calc(100vh - 250px)'}}>
          <table className="qc-asgn" style={{borderCollapse:'collapse',fontSize:12,width:'100%'}}>
            <thead><tr>
              <th style={{textAlign:'left',padding:'10px 14px',fontSize:10.5,textTransform:'uppercase',letterSpacing:'.3px',color:P.muted,fontWeight:700,borderBottom:'1px solid #dde3ec',background:'#eef2f7',position:'sticky',left:0,top:0,zIndex:5,minWidth:230}}>Indicator</th>
              {assignCols.map(c=><th key={c.key} className="qa-x" title={c.name+' — '+assignCount[c.key]+' indicator'+(assignCount[c.key]!==1?'s':'')+' assigned'} style={{padding:'10px 6px',fontSize:10,color:P.muted,fontWeight:700,borderBottom:'1px solid #dde3ec',background:'#eef2f7',textAlign:'center',whiteSpace:'nowrap',position:'sticky',top:0,zIndex:4}}><div>{c.short}</div><div style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,color:P.blue,marginTop:2}}>{assignCount[c.key]}</div></th>)}
            </tr></thead>
            <tbody>
              {assignRows.map(rec=>{ const rmeas=measureOf(rec.formula);
                const inDepts=assignCols.filter(c=>rec.set.has(c.key)).map(c=>c.name);
                return (
              <tr key={rec.key} style={{borderBottom:'1px solid #eef1f5'}}>
                <td className="qa-name" title={inDepts.length?('Assigned to '+inDepts.length+' department'+(inDepts.length!==1?'s':'')+': '+inDepts.join(', ')):'Not assigned to any department yet'}
                  style={{padding:'8px 14px',textAlign:'left',position:'sticky',left:0,background:'#fff',zIndex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:7,height:7,borderRadius:'50%',background:rmeas.color,flexShrink:0}}></span>
                    <span style={{fontWeight:600,color:P.ink,flex:1,minWidth:0}}>{rec.name}</span>
                    {inDepts.length>0
                      ? <span style={{flexShrink:0,fontFamily:MONO,fontSize:9.5,fontWeight:700,color:P.blue700,background:'#eef8fc',border:'1px solid #cfe6f4',borderRadius:999,padding:'1px 7px'}} title={'Assigned to: '+inDepts.join(', ')}>{inDepts.length}</span>
                      : <span style={{flexShrink:0,fontSize:9.5,fontWeight:700,color:'#c2ccd8'}}>—</span>}
                  </div>
                </td>
                {assignCols.map(c=>{ const on=rec.set.has(c.key); return (
                  <td key={c.key} className="qa-x" style={{textAlign:'center',padding:'6px 4px'}}><span onClick={()=>toggleAssign(rec,c.key)} title={rec.name+' × '+c.name+' — '+(on?'assigned · click to unassign':'not assigned · click to assign')} style={{display:'inline-grid',placeItems:'center',width:22,height:22,borderRadius:6,cursor:'pointer',background:on?'#e7f6ed':'#f7f9fc',color:on?'#1f9d57':'#cdd6e2',fontSize:12,fontWeight:700,boxShadow:on?'0 0 0 1px #bfe6cd':'none'}}>{on?'✓':''}</span></td>
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

// Quality rendered INSIDE the global app shell (ui.jsx Sidebar/TopBar) — the 8 views
// live in the global sidebar submenu now, so this renders just the one the route
// selects, with no dedicated console chrome. `view` is a module id; the Admin view
// keeps its own Manage / Assign / Catalog sub-nav.
function QualityView({ view, initialDept, setRoute }){
  const Q = window.useQualityStore();
  const depts = (Q.depts || []).filter(d => d.key && d.indicators && d.indicators.length);
  const [q, setQ] = useState('');
  const v = view || 'dashboard';
  return (
    <div style={{ fontFamily:"'IBM Plex Sans',system-ui,sans-serif", color:P.ink }}>
      {v==='dashboard'   && <QCDashboard depts={depts} Q={Q}/>}
      {v==='scorecard'   && <QCScorecard depts={depts}/>}
      {v==='trends'      && <QCTrends depts={depts}/>}
      {v==='reports'     && <QCReports depts={depts}/>}
      {v==='incidents'   && <QCIncidents depts={depts} Q={Q}/>}
      {v==='actionplans' && <QCActionPlans depts={depts}/>}
      {v==='dataentry'   && <QCDataEntry/>}
      {v==='admin'       && <QCAdmin Q={Q} q={q} onQ={setQ} initialDept={initialDept}/>}
    </div>
  );
}
window.QualityView = QualityView;

function QualityConsole({ onExit, initialView, initialDept, setRoute }){
  const Q = window.useQualityStore();
  const depts = (Q.depts||[]).filter(d => d.key && d.indicators && d.indicators.length);

  const [module, setModule] = useState(initialView || 'dashboard');
  const [gq, setGq] = useState('');
  const [wsOpen, setWsOpen] = useState(false);

  // Switch to another UNICO workspace — leaves the console and hands control back to
  // the app's default shell (which has its own switcher to return here). Mirrors
  // ui.jsx UNICO_MODULES so the console isn't a dead end.
  const WORKSPACES = [
    { id:'stats',   label:'Statistics',         home:'dashboard' },
    { id:'datacol', label:'Data Collection',    home:'dcReview' },
    { id:'staff',   label:'Staff Management',   home:'nurseHome' },
    { id:'quality', label:'Quality Indicators', home:'quality', current:true },
    { id:'users',   label:'User Management',    home:'users' },
  ];
  const goWorkspace = (w) => { setWsOpen(false); if(w.current) return; if(setRoute) setRoute({view:w.home}); else if(onExit) onExit(); };

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
        <div style={{position:'relative',flexShrink:0}}>
          <div
            onClick={()=> setWsOpen(o=>!o)}
            title="Switch workspace"
            style={{display:'flex',alignItems:'center',gap:10,padding:'0 16px',height:56,borderBottom:'1px solid rgba(255,255,255,.07)',cursor:'pointer'}}>
            <div style={{width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,#27a8db,#0072a3)',display:'grid',placeItems:'center',color:'#fff',fontWeight:700,fontSize:15,boxShadow:'0 2px 9px rgba(0,144,202,.5)'}}>U</div>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontWeight:700,color:'#fff',fontSize:14,letterSpacing:'.2px',whiteSpace:'nowrap'}}>UNICO</div>
              <div style={{fontWeight:500,color:'#83909f',fontSize:9.5,letterSpacing:'.7px',textTransform:'uppercase'}}>Hospital Analytics</div>
            </div>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#83909f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,transform:wsOpen?'rotate(180deg)':'none',transition:'transform .15s'}}><path d="M6 9l6 6 6-6"></path></svg>
          </div>
          {wsOpen && (
            <React.Fragment>
              <div onClick={()=> setWsOpen(false)} style={{position:'fixed',inset:0,zIndex:40}}></div>
              <div style={{position:'absolute',top:52,left:12,right:12,zIndex:41,background:'#fff',border:'1px solid '+P.line,borderRadius:10,boxShadow:'0 12px 34px rgba(6,14,26,.45)',padding:6}}>
                <div style={{fontSize:9.5,fontWeight:700,color:P.faint,textTransform:'uppercase',letterSpacing:'.5px',padding:'6px 10px 4px'}}>Switch workspace</div>
                {WORKSPACES.map(w => (
                  <div key={w.id} onClick={()=> goWorkspace(w)}
                    style={{display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:7,cursor:'pointer',fontSize:13,fontWeight:w.current?700:500,color:w.current?P.blue700:P.ink,background:w.current?'#eef8fc':'transparent'}}>
                    <span style={{width:8,height:8,borderRadius:'50%',background:w.current?P.blue:'#cdd6e2',flexShrink:0}}></span>
                    <span style={{flex:1,whiteSpace:'nowrap'}}>{w.label}</span>
                    {w.current && <span style={{fontSize:9.5,color:P.faint}}>current</span>}
                  </div>
                ))}
              </div>
            </React.Fragment>
          )}
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
              <span style={{width:8,height:8,borderRadius:'50%',background:'#3ddc97',boxShadow:'0 0 0 3px rgba(61,220,151,.18)'}}></span>{fyLabelOf(defaultFy(depts))}
            </div>
            <div style={{width:34,height:34,borderRadius:9,background:'linear-gradient(135deg,#3ab5a7,#0090ca)',color:'#fff',display:'grid',placeItems:'center',fontWeight:700,fontSize:13}}>QM</div>
          </div>
        </header>

        {/* content */}
        <div style={{flex:1,overflowY:'auto',padding:'20px 26px 64px'}}>
          {module==='dashboard'   && <QCDashboard depts={depts} Q={Q}/>}
          {module==='scorecard'   && <QCScorecard depts={depts}/>}
          {module==='trends'      && <QCTrends depts={depts}/>}
          {module==='reports'     && <QCReports depts={depts}/>}
          {module==='incidents'   && <QCIncidents depts={depts} Q={Q}/>}
          {module==='actionplans' && <QCActionPlans depts={depts}/>}
          {module==='dataentry'   && <QCDataEntry/>}
          {module==='admin'       && <QCAdmin Q={Q} q={gq} onQ={setGq} initialDept={initialDept}/>}
        </div>
      </div>
    </div>
  );
}

window.QualityConsole = QualityConsole;

/* Self-contained Quality report builder for embedding OUTSIDE the console (e.g. the
   Statistics → Reports module). Fetches its own live quality departments so callers
   don't need the quality store. Same builder the Quality → Reports view uses. */
function QualityReportsPanel(){
  const Q = window.useQualityStore();
  const depts = (Q.depts || []).filter(d => d.key && d.indicators && d.indicators.length);
  return <QCReportBuilder depts={depts}/>;
}
window.QualityReportsPanel = QualityReportsPanel;
window.QCReportBuilder = QCReportBuilder;
