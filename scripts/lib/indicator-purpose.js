/* Why each quality indicator is measured, and why it matters in each department.
 *
 * Three layers, combined by purposeFor() below:
 *   PURPOSE[key]      — why the hospital measures the indicator at all: what it detects,
 *                       why that matters clinically, and what action a breach triggers.
 *   RISK[key]         — the one clause that explains WHO is exposed to the risk. Used to
 *                       build a department-specific sentence.
 *   DEPT_CONTEXT[key] — each department's own risk profile (patients, devices, procedures).
 *   DEPT_PURPOSE      — hand-written overrides for the pairs where the departmental reason
 *                       is genuinely distinct rather than a combination of the two above.
 *
 * Reasoning is grounded in the standards cited on each indicator (CDC/NHSN, WHO, INS,
 * AORN, KDOQI, ACC/AHA, ACOG, NABH). Nothing here asserts a benchmark or a clinical claim
 * that the indicator's own reference does not support.
 */

/* ---- why the indicator exists ---- */
const PURPOSE = {
  'central line associated bloodstream infection clabsi':
    'CLABSI is a largely preventable bloodstream infection that carries high attributable mortality, prolonged intensive care and substantial extra cost. Measuring it per 1 000 central-line days rather than per patient adjusts for how heavily lines are actually used, so a unit is not penalised for caring for sicker patients. A rising rate points directly at insertion technique, hub disinfection, dressing integrity or lines being left in longer than needed, and triggers review of the central-line bundle and daily assessment of line necessity.',
  'catheter associated uti cauti':
    'Urinary catheters are the single largest source of healthcare-associated urinary infection, and most CAUTI is preventable by removing the catheter sooner. Expressing events per 1 000 catheter-days makes the rate sensitive to unnecessary catheter days, which is the main modifiable factor. A breach prompts review of insertion indication, aseptic technique, closed-drainage integrity and, above all, whether daily review for prompt removal is actually happening.',
  'ventilator associated pneumonia vap':
    'VAP prolongs ventilation, extends ICU stay and increases mortality. Because risk accumulates with every day of intubation, the rate is expressed per 1 000 ventilator-days. A rising rate directs attention to the ventilator care bundle — head-of-bed elevation, sedation interruption and daily weaning assessment, oral care with the unit antiseptic protocol, and subglottic secretion management.',
  'surgical site infection ssi':
    'SSI is the most common complication of surgery and a direct measure of the whole perioperative chain: preoperative preparation, antibiotic prophylaxis timing, theatre discipline, sterilisation and postoperative wound care. Surveillance over the 30- or 90-day window defined by procedure category is what makes the rate comparable. A rise triggers review of prophylaxis timing and re-dosing, skin preparation, theatre traffic and instrument reprocessing.',
  'hand hygiene compliance':
    'Hand hygiene is the single most effective measure against transmission of healthcare-associated infection, and it is the one behaviour that underlies every other infection indicator in this manual. It is measured by direct observation against the WHO Five Moments, because self-report and product-consumption data both overstate real practice. Compliance below target is treated as a leading indicator: it usually falls before device-related infection rates rise.',
  'hand hygiene compliance hospital':
    'The hospital-wide roll-up shows whether hand hygiene is an organisational habit or only strong in the units that are watched most closely. It is the board-level view of the same observations collected in each department, and it is the measure most directly linked to the hospital\'s overall infection performance.',
  'needle stick injury nsi':
    'A needle-stick or sharps injury exposes a staff member to bloodborne pathogens — hepatitis B, hepatitis C and HIV — and every event carries an immediate obligation of source testing, prophylaxis and follow-up. The indicator is a staff-safety measure rather than a patient one. Because injuries cluster around specific devices and moments (recapping, disposal, device passing in theatre), each event is logged with the activity so that engineering controls and safety-engineered devices can be targeted where they will actually work.',
  'in patient fall':
    'Falls are the most frequently reported inpatient safety incident and a major cause of avoidable injury, extended stay and loss of confidence in admitted patients. The rate is expressed per 1 000 patient-days so that units with longer stays are compared fairly. A rise prompts review of falls-risk assessment on admission and after any change in condition, environmental hazards, footwear and toileting routines, and the sedating medicines the patient is on.',
  'out patient fall':
    'Out-patients fall in corridors, waiting areas, on stairs and while moving to and from examination couches — often unaccompanied and after sedation or a procedure. These events are easily missed because the patient goes home, so deliberate capture matters. The rate is expressed per 1 000 out-patient visits and the target is set locally, since no national out-patient measure exists.',
  'hospital acquired pressure ulcer hapu':
    'A pressure injury that develops after admission is a direct indicator of nursing surveillance: risk assessment, repositioning, support surfaces, nutrition and moisture management. It is painful, slow to heal and largely preventable. A rise triggers review of risk-assessment completion, repositioning schedules and the availability of pressure-redistributing surfaces.',
  'phlebitis':
    'Phlebitis is the most common complication of peripheral intravenous therapy and a marker of cannula site selection, insertion technique, securement, dwell time and the irritant properties of what is being infused. It is measured because it is common, avoidable and an early warning of poorer vascular access practice, which also drives catheter-related infection.',
  'deep vein thrombosis dvt':
    'Venous thromboembolism after surgery or immobility is a leading cause of preventable inpatient death, and prophylaxis is highly effective. Measuring DVT tests whether risk assessment and prophylaxis are reaching the patients who need them. Each event is reviewed for whether prophylaxis was assessed, prescribed and actually given.',
  'accidental removal of ett tube':
    'Unplanned extubation is an airway emergency: it risks hypoxia, aspiration, arrhythmia and cardiac arrest, and re-intubation itself carries risk. It is measured per 100 ventilator-days because exposure accumulates with time on the ventilator. Events are reviewed for tube securement, sedation adequacy, agitation management and whether staffing allowed continuous observation.',
  'accidental catheter dislodgement':
    'An unplanned catheter removal interrupts treatment, forces a repeat invasive procedure with its own risk, and — for central and arterial devices — can cause bleeding or air embolism. It measures securement practice, patient agitation management and handover care during transfers and repositioning.',
  'accidental de lining of catheter':
    'An unplanned catheter removal interrupts treatment, forces a repeat invasive procedure with its own risk, and — for central and arterial devices — can cause bleeding or air embolism. It measures securement practice, patient agitation management and handover care during transfers and repositioning.',
  'accidental removal of catheter':
    'An unplanned catheter removal interrupts treatment, forces a repeat invasive procedure with its own risk, and — for central and arterial devices — can cause bleeding or air embolism. It measures securement practice, patient agitation management and handover care during transfers and repositioning.',
  're admission within 48 hours icu':
    'A patient who returns to intensive care within 48 hours was probably discharged too early, or discharged to a ward that could not deliver the level of monitoring they still needed. Readmitted patients have markedly worse outcomes than those admitted once. The indicator tests discharge criteria, handover quality and the capability of the receiving ward, not the competence of the ICU alone.',
  're intubation within 48 hours icu':
    'Re-intubation within 48 hours means the extubation decision was wrong, and extubation failure independently increases mortality, ventilator days and tracheostomy rates. It tests the weaning protocol: spontaneous breathing trial conduct, cuff-leak and secretion assessment, and whether the decision was made against agreed criteria rather than bed pressure.',
  'infection rate':
    'A unit-level healthcare-associated infection rate is the summary measure of infection prevention: hand hygiene, aseptic technique, environmental cleaning and device care together. It catches transmission that device-specific indicators would miss, and a rise is the trigger to look for a common source, a cluster or a break in the cleaning and disinfection routine.',
  'incidence of cautery burn':
    'An electrosurgical burn is an avoidable injury to a patient who is anaesthetised and cannot report pain — caused by return-electrode misapplication, insulation failure, capacitive coupling or activation of an unholstered active electrode. It is held to a zero-defect standard because every event is preventable. Each event triggers inspection of the electrosurgical unit, its accessories and the return electrode, in line with the AORN energy-device adverse-event tracking requirement.',
  'percentage of compliance with the organization s surgical safety protocol prevention of wrong patient wrong site and wrong surgery':
    'Wrong-patient, wrong-site and wrong-procedure surgery are never events: rare, catastrophic and entirely preventable by a disciplined checklist. Compliance is measured rather than assumed, because a checklist that is signed but not actually performed gives false assurance. Full compliance is required — any incomplete time-out is treated as a failure of the process, not a paperwork lapse.',
  'percentage of unplanned return to the operating theatre ot':
    'An unplanned return to theatre during the same admission usually signals a complication of the index operation — bleeding, anastomotic leak, retained material or infection. It is one of the more honest indicators of surgical quality because it reflects outcome rather than process. Each return is reviewed at morbidity meeting to separate patient-related risk from technical or decision-making factors.',
  'percentage of cases with intraoperative change in the planned surgery':
    'A change of procedure after the patient is anaesthetised means the operation the patient consented to is not the operation performed. Some changes are unavoidable and clinically correct; a persistent rate points to inadequate preoperative assessment, imaging or planning. It is measured to protect informed consent and to test the quality of preoperative work-up.',
  'percentage of rescheduled surgeries':
    'A cancelled or postponed operation wastes theatre capacity, extends the patient\'s wait and anxiety, and often reflects a fixable system problem: incomplete preoperative preparation, missing investigations, equipment or instrument unavailability, or overbooked lists. Measuring it separates avoidable administrative cancellations from genuine clinical postponement.',
  'ot utilization rate':
    'Theatre time is among the most expensive resource in the hospital. Utilisation shows whether allocated sessions are actually being used, and low utilisation usually means late starts, long turnovers or lists that finish early rather than a shortage of patients. It is a management indicator that protects access: unused theatre time is waiting-list time.',
  'door to balloon compliance 90 min':
    'In STEMI, myocardium dies while the artery stays blocked — every 30 minutes of delay raises one-year mortality measurably. This indicator measures the whole reperfusion chain, from arrival through diagnosis, activation and transfer to first device. It is a system measure: the delay is usually organisational, not clinical.',
  'door to cath lab':
    'This is the in-hospital component of the reperfusion pathway — the time from the patient arriving to reaching the catheterisation laboratory. It is measured separately from door-to-balloon so that emergency-department delay can be distinguished from laboratory activation and procedural delay, and the right part of the chain can be fixed.',
  'post pci complication':
    'Complications after percutaneous coronary intervention — bleeding, vascular injury, contrast-associated kidney injury, stroke or the need for emergency surgery — are the outcome measure of procedural quality, case selection and periprocedural management. Tracking them supports honest comparison with registry benchmarks and drives review of access route, anticoagulation dosing and contrast volume.',
  'puncture site hematoma':
    'Access-site haematoma is the most common complication of cardiac catheterisation, causing pain, prolonged bed rest, transfusion and occasionally vascular repair. It is a sensitive measure of access technique, sheath management, anticoagulation dosing and post-procedure haemostasis, and it is the complication most reduced by radial rather than femoral access.',
  'post procedure complication':
    'Endoscopic adverse events — perforation, bleeding, aspiration, sedation-related events and infection — are uncommon but serious, and the ASGE requires them to be captured, classified by timing and attribution, and reviewed. Consistent recording is what allows a unit to compare its outcomes with benchmarks rather than assume they are acceptable.',
  'cardiac arrest survival rate':
    'Survival to discharge after in-hospital cardiac arrest measures the whole chain of survival: recognition of deterioration, speed of the code response, resuscitation quality and post-arrest care. It is measured because it is actionable — most in-hospital arrests are preceded by hours of recorded deterioration, so a low survival rate often points upstream to escalation and early-warning practice.',
  'cardiac arrest events':
    'The number of in-hospital cardiac arrests is a measure of how well patient deterioration is recognised and escalated before it becomes an arrest. A rising count prompts review of early-warning scoring, observation frequency and the threshold for escalation, rather than of resuscitation itself.',
  /* Domain 2-4 of the Nursing Department KPI deck: workforce, experience and cost. These
     are nursing-SERVICE measures — they explain the clinical indicators above rather than
     competing with them, because understaffed, untrained or disengaged wards are where
     infection, falls and medication errors actually come from. */
  'nursing turnover rate':
    'Turnover is the workforce measure that sits underneath almost every clinical indicator in this manual. Losing an experienced nurse costs the recruitment and induction of a replacement, but the larger cost is the months during which the ward runs with a less experienced team — the period in which falls, medication errors and device infections rise. It is measured because it is the earliest hard signal that the working environment is failing, and because the causes it points at (workload, recognition, career progression, supervision) are within the department\'s power to change. A rising rate is reviewed alongside staff satisfaction and exit-interview themes, not on its own.',
  'nursing training hours compliance nurses':
    'Competence is not a state a nurse reaches once at registration; it decays as practice, equipment and protocols change. Measuring completed continuing-education hours against the department standard tests whether training is actually reaching the bedside rather than being scheduled and missed — the usual failure is not refusal but a ward too short-staffed to release anyone. A shortfall is read as a staffing and rostering problem first and an individual one second, and is reviewed against which units and which shifts are missing their hours.',
  'nursing training hours compliance pcas':
    'Patient Care Assistants deliver much of the direct personal care that falls, pressure ulcers and patient experience depend on, and they typically arrive with less formal preparation than nurses. Their training compliance is measured separately because the standard set for them is different and because a combined figure would let a strong nurse result mask a weak PCA one — which is precisely the gap the department is trying to close.',
  'nursing documentation accuracy':
    'The nursing record is the only durable evidence of what was assessed, what was given and what changed, and it is what the next shift relies on. Inaccurate or incomplete documentation causes real harm through missed handover information and repeated or omitted treatment, and it removes the hospital\'s ability to defend care that was in fact given. Auditing accuracy tests the record as a clinical tool, not as paperwork; a low score usually points at time pressure at the end of a shift rather than at unwillingness, so the response is to review when documentation is expected to happen.',
  'nursing staff satisfaction':
    'Staff satisfaction is measured because it predicts the things the hospital cannot afford to discover late: turnover, absence, and the quiet withdrawal of discretionary effort that shows up as slower call-bell responses and thinner documentation long before anyone resigns. It is a leading indicator where turnover is a lagging one. Its value depends entirely on honest responses, so the survey must be genuinely anonymous and the results must visibly lead to action, or the score rises while the problem does not move.',
  'patient complaints relating to nursing care':
    'A complaint is a patient telling the hospital about a failure it has not detected itself, and complaints about nursing care cluster around a small number of correctable themes — communication and attitude, delay in attending, unrelieved pain, and unmet personal-care needs. They are counted and classified so that the theme, rather than the individual event, drives the response. Reporting is deliberately non-punitive: a falling count with unchanged practice signals that complaining has become harder, not that care has improved.',
  'call bell response time':
    'The call bell is the only means a patient in a bed has of summoning help, and how long it takes to answer is the single most concrete measure of responsiveness the department has. Slow responses are linked to patients attempting to mobilise or toilet unaided, which is a direct route to a fall, and they are consistently among the strongest drivers of how patients rate their whole stay. Because the delay reflects staffing and workload rather than willingness, a rising average is reviewed against the rounding programme and the deployment of care assistants.',
  'patient satisfaction nursing services':
    'Patient satisfaction with nursing care measures the part of the stay the patient is best placed to judge — whether they were treated with respect, whether things were explained, and whether help came when they asked for it. It is measured separately from overall hospital satisfaction because nursing is the service the patient has most contact with and the one whose ratings move most in response to ward-level change. It is read together with the complaints indicator, which captures the same failures from the other direction and at a much lower response threshold.',
  'consumable cost per patient day':
    'Expressing consumable cost per patient-day separates genuine efficiency from a quiet month: a falling total spend during falling occupancy is not a saving. It is measured to find waste that ward practice controls — over-indenting, unnecessary printing, opened stock going unused — without touching the supplies that patient care depends on. The indicator is deliberately paired with the clinical measures in this manual, because a reduction in consumables achieved at the cost of a rise in infection or pressure-ulcer rates is not an improvement.',
  'patient waiting time opd':
    'Waiting time is what an out-patient actually experiences of the hospital, and it is the access measure most closely linked to whether a patient completes their care, returns for follow-up, or leaves without being seen. It is also a direct read-out of clinic design rather than of individual effort: over-booked slots, consultants starting late, registration bottlenecks and unbalanced session lengths all show up here before they show up anywhere else. A breach prompts review of the appointment model — slot length against real consultation time, the number of patients booked per session, and the point in the queue where the delay actually accumulates — not of how fast individual clinicians work.',
  'door to ct scan':
    'In stroke, major trauma and significant head injury, the CT scan is the decision point: no reperfusion, no neurosurgical referral and no definitive management can begin until the image exists. Time to CT is therefore a measure of the whole front-of-house emergency pathway — triage recognition, early senior review, porter and scanner availability, and whether the radiology department has been alerted in parallel rather than in sequence. A rising interval points at a specific link in that chain and is reviewed link by link; because the delay is usually in recognising and ordering rather than in scanning, the clock deliberately starts at the door and not at the request.',
  'dialysis adequacy urr':
    'Inadequate dialysis accumulates silently and translates directly into uraemic symptoms, malnutrition, cardiovascular disease and mortality. The urea reduction ratio verifies that the prescribed dose is actually being delivered — the prescription and the delivered dose are frequently not the same, because of access recirculation, shortened sessions and pump-flow shortfalls.',
  'vascular access complication':
    'Vascular access is the dialysis patient\'s lifeline. Thrombosis, stenosis, infection and aneurysm interrupt treatment, force temporary catheters with far higher infection risk, and are a leading cause of hospitalisation in this group. Monitoring complications protects access longevity and reduces catheter dependence.',
  'intradialytic hypotension':
    'A blood-pressure fall during dialysis is the most common acute complication of haemodialysis: it causes distress, forces the session to be cut short — which itself under-delivers dialysis — and is associated with cardiac and cerebral ischaemia and access thrombosis. Measuring it drives review of dry-weight assessment, ultrafiltration rate, dialysate temperature and antihypertensive timing.',
  'water quality compliance':
    'A haemodialysis patient is exposed to hundreds of litres of water each week across a membrane, with none of the protection of the gastrointestinal tract. Chemical or microbiological contamination can cause haemolysis, pyrogenic reactions or chronic toxicity across the whole unit at once. Compliance with the ISO 23500 limits is therefore verified on a fixed schedule and held at 100%.',
  'partograph compliance':
    'Structured labour monitoring is what makes prolonged and obstructed labour visible early enough to act, and it is directly linked to reductions in ruptured uterus, birth asphyxia and maternal death. Compliance is measured because the tool only works if it is completed contemporaneously and acted upon, not filled in retrospectively.',
  'fetal heart rate monitoring compliance':
    'Intrapartum fetal heart rate monitoring is the principal means of detecting fetal compromise in time to intervene, and failures of monitoring and interpretation are among the most frequent findings in intrapartum litigation and stillbirth review. Compliance measures whether monitoring was performed and documented to the agreed standard for the risk level of the labour.',
  'average length of stay at the emergency department':
    'Time spent in the emergency department is a direct measure of flow, and prolonged stay is associated with worse outcomes, higher mortality and more patients leaving without being seen. Long stays usually reflect inpatient bed availability and boarding rather than emergency-department effort, so the measure is used to argue for whole-hospital flow decisions.',
  'return of patient within 72 hours same complaint excl lama':
    'An unscheduled return with the same complaint within 72 hours is the emergency department\'s safety net: it detects missed diagnosis, premature discharge, inadequate analgesia or discharge advice the patient could not act on. Patients who left against medical advice are excluded so that the measure reflects clinical decisions rather than patient choice. Each return is reviewed for a missed or evolving diagnosis.',
  'medication administration error':
    'Medication error is among the most frequent causes of avoidable patient harm, and the administration step is where most errors reach the patient. Errors are recorded and categorised by severity so that system defects — look-alike/sound-alike drugs, unlabelled syringes, interruption during administration, unsafe abbreviations — can be corrected. Reporting is deliberately non-punitive; a falling report count with unchanged practice signals under-reporting, not improvement.',
};

/* ---- who is exposed: the clause that makes the department sentence specific ---- */
const RISK = {
  'central line associated bloodstream infection clabsi': 'central venous access is used heavily and often for prolonged periods',
  'catheter associated uti cauti': 'indwelling urinary catheters are common and easily left in longer than needed',
  'ventilator associated pneumonia vap': 'patients are mechanically ventilated, and every additional ventilator day adds risk',
  'surgical site infection ssi': 'surgical wounds are created here and the whole aseptic chain is under this department\'s control',
  'hand hygiene compliance': 'staff move between patients and devices many times an hour',
  'in patient fall': 'patients are admitted, often frail, sedated or newly mobilising',
  'out patient fall': 'patients attend, move about and leave without an inpatient team observing them',
  'hospital acquired pressure ulcer hapu': 'patients have limited mobility and depend on staff for repositioning',
  'phlebitis': 'peripheral intravenous therapy is given routinely',
  'deep vein thrombosis dvt': 'patients are immobile or post-operative and at thrombotic risk',
  'accidental removal of ett tube': 'patients are intubated and may be agitated or under-sedated',
  'accidental catheter dislodgement': 'indwelling catheters are in place and patients are moved, transferred and repositioned frequently',
  'accidental de lining of catheter': 'indwelling catheters are in place and patients are moved, transferred and repositioned frequently',
  'accidental removal of catheter': 'indwelling catheters are in place and patients are moved, transferred and repositioned frequently',
  'needle stick injury nsi': 'sharps are handled routinely as part of everyday clinical work',
  're admission within 48 hours icu': 'patients are discharged onward to lower-dependency care',
  're intubation within 48 hours icu': 'patients are weaned from mechanical ventilation and extubated',
  'infection rate': 'a shared clinical environment and repeated device contact create transmission opportunity',
  'incidence of cautery burn': 'electrosurgical energy is used on anaesthetised patients',
  'hand hygiene compliance hospital': 'the same Five Moments observations are collected in every clinical area',
  'cardiac arrest survival rate': 'in-hospital arrests occur and the speed and quality of the code response decide the outcome',
  'ot utilization rate': 'theatre sessions are allocated, staffed and paid for whether or not they are used',
  'percentage of compliance with the organization s surgical safety protocol prevention of wrong patient wrong site and wrong surgery':
    'invasive procedures are performed on anaesthetised patients who cannot verify their own site or procedure',
  'percentage of unplanned return to the operating theatre ot': 'operations are performed here, and a complication of one may require a second',
  'percentage of cases with intraoperative change in the planned surgery': 'operations are planned and consented before the patient is anaesthetised',
  'percentage of rescheduled surgeries': 'operating lists are booked in advance and depend on preparation completing on time',
  'door to balloon compliance 90 min': 'primary PCI is delivered here and myocardium is lost while the artery stays occluded',
  'door to cath lab': 'STEMI patients arrive here first and every in-hospital minute counts against the reperfusion target',
  'puncture site hematoma': 'arterial access is obtained and sheaths are managed under full anticoagulation',
  'post pci complication': 'coronary intervention is performed on patients with significant cardiac risk',
  'post procedure complication': 'sedated endoscopic procedures are performed and patients are discharged the same day',
  'dialysis adequacy urr': 'the prescribed dose of dialysis is only of value if it is actually delivered at the chair',
  'water quality compliance': 'every patient is exposed to hundreds of litres of treated water across a membrane each week',
  'intradialytic hypotension': 'fluid is removed rapidly within each session',
  'vascular access complication': 'vascular access is cannulated repeatedly, for every treatment, for years',
  'partograph compliance': 'labour is monitored over many hours across changes of staff',
  'fetal heart rate monitoring compliance': 'fetal wellbeing can only be assessed indirectly, and deterioration can be rapid',
  'average length of stay at the emergency department': 'flow depends on both departmental process and the availability of inpatient beds',
  'return of patient within 72 hours same complaint excl lama': 'patients are assessed and discharged quickly, often before a diagnosis has fully declared itself',
  'medication administration error': 'medicines are prepared and administered under time pressure and frequent interruption',
  'cardiac arrest events': 'deteriorating patients must be recognised and escalated before an arrest occurs',
  'patient waiting time opd': 'patients wait in person, in a queue this department controls, before any care begins',
  'door to ct scan': 'the patients who need imaging most urgently arrive unannounced and undifferentiated',
};

/* ---- each department's own risk profile ----
 * Kept to the unit's core identity — population and setting only. Anything
 * indicator-specific belongs in RISK or in a DEPT_PURPOSE override, because this clause
 * is concatenated with EVERY indicator's risk clause and a detail that fits one
 * indicator reads as a non-sequitur against the next. */
const DEPT_CONTEXT = {
  sicu: 'The Surgical ICU manages critically ill post-operative patients with multiple invasive devices and prolonged immobility',
  micu: 'The Medical ICU manages critically ill medical patients with high illness severity and long stays',
  ccu: 'The Coronary Care Unit manages acute cardiac patients under continuous monitoring',
  cticu: 'CTVS ICU manages patients through the immediate recovery period after cardiac surgery',
  nicu: 'The Neonatal ICU cares for newborns, many of them preterm, with immature immunity and fragile skin',
  lvl10: 'IPD Cabin Level 10 provides inpatient ward care to a mixed medical and surgical population of varying dependency',
  lvl9: 'IPD Cabin Level 9 provides inpatient ward care to a mixed medical and surgical population of varying dependency',
  ot: 'General OT runs the hospital\'s main elective and emergency operating list across specialties',
  ctvs: 'CTVS OT performs long, high-complexity cardiac and thoracic operations',
  cathlab: 'The Cath Lab performs coronary diagnostic and interventional procedures through arterial access',
  endoscopy: 'The Endoscopic Suite performs sedated endoscopy on largely ambulatory patients discharged the same day',
  dialysis: 'The Dialysis unit treats patients with end-stage kidney disease through vascular access several times a week, for years',
  /* No trailing "where …" clause here — this string is concatenated with the indicator's
     RISK clause, which supplies its own "where", and two of them in one sentence read as
     a mistake. Population and setting only, like every other entry. */
  ldr: 'Labour, Delivery & Recovery cares for women in labour and their newborns — two patients at once',
  er: 'Emergency Medicine receives undifferentiated, unscheduled patients of every acuity under time pressure',
  opd: 'The Out-Patient Department sees ambulatory patients who arrive and leave under their own care',
  radiology: 'Radiology performs imaging and image-guided procedures for both ambulatory and inpatient patients',
  homecare: 'Family Medicine delivers care in patients\' own homes, away from hospital equipment and immediate support',
  __hospital__: 'The hospital-wide view aggregates observations from every clinical area',
};

/* ---- hand-written pairs where the departmental reason is genuinely distinct ---- */
const DEPT_PURPOSE = {
  'central line associated bloodstream infection clabsi': {
    nicu: 'Neonates, particularly preterm infants, have immature immunity and often carry umbilical or percutaneously inserted central catheters for weeks. A single bloodstream infection at this age carries a high risk of death and of long-term neurodevelopmental injury, which is why the NICU tracks this even at very low event counts.',
    dialysis: 'Tunnelled haemodialysis catheters are the highest-risk form of vascular access and are accessed three times a week, every week. CLABSI here is both a patient-safety event and the strongest argument for converting catheter-dependent patients to a fistula or graft.',
    cticu: 'Post-cardiac-surgery patients arrive with multiple central and arterial lines placed under time pressure in theatre, and a bloodstream infection in a patient with prosthetic material or a fresh sternotomy risks endocarditis and mediastinitis.',
  },
  'surgical site infection ssi': {
    ctvs: 'After cardiac surgery an infection can involve the sternum and mediastinum or a prosthetic valve or graft, turning a wound problem into a life-threatening one requiring reoperation. Surveillance therefore extends to the 90-day window for implant procedures.',
    cathlab: 'Although Cath Lab work is percutaneous, device implantation such as pacemakers and defibrillators creates a pocket that can become infected, with consequences that usually require removal of the whole system.',
  },
  'catheter associated uti cauti': {
    lvl10: 'On a general ward the main driver is duration rather than insertion: catheters placed for a legitimate reason are frequently left in after the reason has passed. This indicator is used chiefly to test daily review and prompt removal.',
    lvl9: 'On a general ward the main driver is duration rather than insertion: catheters placed for a legitimate reason are frequently left in after the reason has passed. This indicator is used chiefly to test daily review and prompt removal.',
  },
  'in patient fall': {
    ldr: 'Women in labour and immediately post-delivery are at particular risk when mobilising after regional anaesthesia, during first ambulation and when carrying a newborn.',
    dialysis: 'Patients frequently become hypotensive during or just after dialysis and are at their most unsteady when standing to leave the chair at the end of a session.',
    ccu: 'Cardiac patients are often on antihypertensives, diuretics and anticoagulants — the combination makes both a fall and its consequences more likely.',
  },
  'phlebitis': {
    nicu: 'Neonatal veins are tiny and fragile, infusions are frequently irritant, and a neonate cannot report pain at the site — so surveillance rather than complaint is what detects phlebitis here.',
    dialysis: 'Peripheral access in a patient with end-stage kidney disease must be protected: veins damaged by phlebitis are veins unavailable for future fistula formation.',
  },
  'needle stick injury nsi': {
    ot: 'Theatre carries the highest sharps risk in the hospital — suture needles and scalpels are passed between people, often at speed and in a confined field, which is why hands-free passing technique and blunt suture needles are the focus here.',
    ctvs: 'Long cardiac procedures involve extensive suturing and wire handling with several people working in the same field, giving sustained exposure over many hours.',
    dialysis: 'Dialysis needles are large-bore and are inserted and removed repeatedly for every patient, every session, giving this unit a high per-staff exposure frequency.',
    ldr: 'Deliveries are urgent, often occur out of hours, and involve suturing in a field with high blood and body-fluid exposure.',
    homecare: 'Sharps are used away from the hospital, where disposal containers, lighting and assistance may not be immediately at hand — so safe transport and disposal are the focus.',
  },
  'hand hygiene compliance': {
    nicu: 'Neonates are handled many times a day by staff and parents, and their skin and immune barriers are immature — hand hygiene is the primary defence for this population.',
    dialysis: 'Staff move between patients and machines constantly during a session, handling vascular access each time, which makes hand hygiene the main barrier to patient-to-patient transmission.',
    radiology: 'Equipment surfaces and positioning aids are touched by every patient in sequence, so hand hygiene between patients is what interrupts contact transmission.',
  },
  'hospital acquired pressure ulcer hapu': {
    nicu: 'Neonatal skin is thin and easily injured, and pressure injury here is most often device-related — from CPAP interfaces, probes and securement — rather than from lying position.',
    cticu: 'Patients are immobile, often haemodynamically unstable and unable to be repositioned freely in the early post-operative hours, which concentrates pressure risk into that period.',
  },
  'out patient fall': {
    opd: 'Out-patients navigate unfamiliar corridors, queues and stairs, often elderly, alone, and sometimes after a procedure or sedation.',
    endoscopy: 'Patients are discharged after sedation and are at their least steady in the recovery and departure period.',
    dialysis: 'Post-dialysis hypotension makes the walk out of the unit the highest-risk moment of the visit.',
    er: 'Emergency patients are unassessed on arrival, may be intoxicated, confused, in pain or syncopal, and often move about before triage is complete.',
  },
  /* The nursing-service KPIs are held at hospital level rather than per ward because the
     KPI deck reports one figure for each and because the levers — recruitment, the
     training calendar, the survey, the complaint process — are all central. Each entry
     below says why that is the right level for THAT indicator, not just that it is. */
  'nursing turnover rate': {
    __hospital__: 'Turnover is measured for the nursing service as a whole because nurses move between wards as well as out of the hospital, and a ward-by-ward rate would count an internal transfer as a loss in one unit and a gain in another while the service had lost nobody. The levers are central too — recruitment, pay, career structure and the retention programme set out in the KPI plan — so accountability sits with the Nursing Department rather than with any single unit.',
  },
  'nursing training hours compliance nurses': {
    __hospital__: 'The continuing-education programme is run centrally — the six-monthly CNE workshop, the monthly CPD hours and the departmental training calendar are all Nursing Department commitments — so compliance is measured against the whole nursing establishment. Reporting it here also keeps the figure honest: a unit that cannot release staff to attend would otherwise simply record a lower target for itself.',
  },
  'nursing training hours compliance pcas': {
    __hospital__: 'Patient Care Assistants are trained on the same central programme as nurses and are deployed across wards rather than belonging to one, so their training compliance is a nursing-service figure. It is reported here beside the nurse figure precisely so the gap between the two — currently the larger of the two shortfalls — stays visible.',
  },
  'nursing documentation accuracy': {
    __hospital__: 'Documentation is audited against one checklist, by one audit process, across the nursing service, so that a score from one ward means the same as a score from another. Holding it centrally is also what makes the move towards paperless records measurable as a single trend rather than as eighteen unrelated ones.',
  },
  'nursing staff satisfaction': {
    __hospital__: 'The satisfaction survey is run once across the nursing service and must stay anonymous to be worth anything — in units with only a handful of staff, a per-ward score would identify individual respondents and the responses would stop being honest. It is therefore reported at hospital level and read together with turnover.',
  },
  'patient complaints relating to nursing care': {
    __hospital__: 'Complaints arrive through one central redressal process, are frequently about a patient\'s whole stay rather than a single ward, and are classified by theme before they can be attributed anywhere. Counting them for the nursing service as a whole is what lets the recurring themes drive the response; attributing every complaint to a ward would turn a learning measure into a scoring one and suppress reporting.',
  },
  'call bell response time': {
    __hospital__: 'Reported here as the nursing-service figure the KPI plan tracks against its 2-minute standard, alongside the ward-level figures from the cabin floors — the hospital number shows whether the standard is being met, the ward numbers show where it is not.',
    lvl9: 'IPD Cabin Level 9 is a cabin ward: patients are in individual rooms, out of sight of the nurses\' station, and the call bell is their only way of summoning help. That makes response time both meaningful and directly actionable here — it is the ward\'s own staffing, rounding and use of care assistants that decides it.',
    lvl10: 'IPD Cabin Level 10 is a cabin ward: patients are in individual rooms, out of sight of the nurses\' station, and the call bell is their only way of summoning help. That makes response time both meaningful and directly actionable here — it is the ward\'s own staffing, rounding and use of care assistants that decides it.',
  },
  'patient satisfaction nursing services': {
    __hospital__: 'The patient survey is administered once, at discharge, across the hospital, and its nursing items are extracted from it — so the measure exists at hospital level by construction. Reporting it here also keeps it comparable with the HCAHPS nursing-communication composite it is modelled on.',
  },
  'consumable cost per patient day': {
    __hospital__: 'Consumables are indented against one store at one price list, and the reduction target in the KPI plan is set against the hospital baseline rather than against any ward\'s. Holding the indicator centrally is also the only way to see whether a fall in one ward\'s consumption is a real saving or simply cost moving to another.',
  },
  'patient waiting time opd': {
    opd: 'The Out-Patient Department is the only place in the hospital where the entire waiting experience sits inside one department\'s control — registration, queueing and the consultant\'s session all belong to it. Its patients are ambulatory and unaccompanied by a ward team, so a long wait is borne standing in a corridor, often by elderly patients, patients who are fasting for a test, and patients who have travelled a long way for a single appointment. It is measured here because it is the department\'s principal service standard and its most common source of complaint.',
  },
  'door to ct scan': {
    er: 'Emergency Medicine is where the stroke, head-injury and major-trauma patient first arrives, and the CT clock starts at that door whether or not the department has recognised the diagnosis yet. Patients arrive undifferentiated and unannounced, so the interval measures triage recognition and the speed of escalation as much as it measures radiology. It is the department\'s own measure because every part of the interval — recognising the patient, calling for senior review, alerting CT, and moving the patient — happens under its control.',
  },
  'incidence of cautery burn': {
    ot: 'General theatre uses electrosurgery on almost every list, across a wide range of patient positions and return-electrode sites.',
    ctvs: 'Cardiac procedures use prolonged electrosurgery close to implanted devices and monitoring leads, where alternate-site burns and pacemaker interference are the specific concerns.',
  },
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Why the hospital measures this indicator at all. */
function purposeFor(indicatorName) {
  return PURPOSE[norm(indicatorName)] || '';
}

/** Why THIS department measures it. Hand-written where one exists, otherwise composed
 *  from the department's risk profile and the indicator's exposure clause. Returns ''
 *  when neither is available, so the manual simply omits the row. */
function deptPurposeFor(indicatorName, deptKey, deptName) {
  const k = norm(indicatorName);
  const hand = DEPT_PURPOSE[k] && DEPT_PURPOSE[k][deptKey];
  if (hand) return hand;
  const ctx = DEPT_CONTEXT[deptKey];
  const risk = RISK[k];
  if (!ctx || !risk) return '';
  return ctx + ', where ' + risk + '.';
}

module.exports = { PURPOSE, RISK, DEPT_CONTEXT, DEPT_PURPOSE, purposeFor, deptPurposeFor, norm };
