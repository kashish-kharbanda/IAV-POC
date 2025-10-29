export function hardcodedLkasReport(): { markdown: string; itemName: string; itemId: string } {
  const itemName = "Lane Keeping Assist System (LKAS) - Generation 2.0";
  const itemId = "LKAS-ID-001";

  const md = `# LKAS G2.0 HARA Report

A complete Hazard Analysis and Risk Assessment (HARA) Report is the crucial second work product of the ISO 26262 Concept Phase (Part 3). It is structured to systematically link potential system malfunctions to measurable risk levels (ASILs) and define the top-level safety response.

The following framework shows what a comprehensive HARA Report for your Lane Keeping Assist System (LKAS) should look like, culminating in the main analysis table.

## 1. Report Metadata and Context

| Field | Value |
| :--- | :--- |
| Item Name | Lane Keeping Assist System (LKAS) - Generation 2.0 |
| Item ID | LKAS-ID-001 |
| ASIL Goal | Determine ASILs for all safety-related malfunctions. |
| Reference Document | LKAS-ID-001_Item_Definition_V1.0 |
| Approved by FSM | [Signature & Date] |

## 2. ASIL Determination Criteria

The Automotive Safety Integrity Level (ASIL) is determined by classifying the hazardous event across three factors and using the standard ISO 26262 ASIL Risk Matrix.

### Risk Classification Factors

| Factor | Description | Levels Used in HARA |
| :--- | :--- | :--- |
| Severity (S) | The possible extent of harm/injury to a person. | S1 (Light/Moderate Injuries) to S3 (Life-Threatening/Fatal) |
| Exposure (E) | The probability of the vehicle operating in the hazardous situation. | E1 (Very Low) to E4 (High) |
| Controllability (C) | The ability of a typical driver to avoid the specified harm once the malfunction occurs. | C1 (Simply Controllable) to C3 (Difficult/Uncontrollable) |

### ASIL Risk Matrix

| S \\ E | E1 | E2 | E3 | E4 |
| :--- | :--- | :--- | :--- | :--- |
| S3 | C1: A | C2: B | C3: D | C3: D |
| S2 | C1: QM | C2: A | C3: C | C4: D |
| S1 | C1: QM | C2: QM | C3: A | C4: B |
| S0 | QM | QM | QM | QM |

## 3. The Core HARA Analysis Table

This table is the central part of the report. It utilizes the malfunctions identified in the Item Definition as a starting point.

| ID | Malfunction Behavior | Operational Situation | Hazardous Event Description | S | E | C | Calculated ASIL | Safety Goal (Top-Level Requirement) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| H-201 | Uncommanded Steering (Max Torque Left) | Driving on a curved highway at 120 km/h with heavy traffic. | Vehicle suddenly swerves into the adjacent lane, leading to a high-speed multi-car collision. | S3 | E4 | C3 | ASIL D | SG-1: The deviation of the vehicle from the lane due to malfunction of the LKAS shall be prevented. |
| H-202 | Loss of Assistance (Passive failure) | Driving on a straight, monotonous highway at 100 km/h (driver inattentive). | LKAS-ECU stops providing corrective torque/warnings, causing the inattentive driver to drift out of lane and hit a roadside object. | S2 | E3 | C1 | ASIL B | SG-2: The failure of the LKAS to provide steering assistance or warning shall be indicated to the driver within 500 ms. |
| H-203 | Steering Vibration Malfunction (Excessive strength) | Driving on a bumpy city road at 60 km/h while performing an evasive maneuver. | The warning vibration is so aggressive that it causes the driver to momentarily lose grip or oversteer. | S1 | E2 | C0 | QM | N/A (Addressed via quality management processes and product usability testing.) |
| H-204 | Uncommanded Activation (At low speed) | Parking maneuver at 5 km/h in a crowded parking lot. | LKAS activates and steers the car into an adjacent parked vehicle or pedestrian. | S2 | E1 | C1 | QM | SG-3: Uncommanded steering assistance above a threshold of X Nm shall be suppressed during vehicle speeds below 10 km/h. |

## 4. Safety Goal Summary and FTTI

This final summary section defines the non-negotiable safety requirements that flow into the next step, the Functional Safety Concept.

| Safety Goal ID | Assigned ASIL | Functional Safety Goal Description | FTTI (Fault Tolerance Time Interval) Placeholder |
| :--- | :--- | :--- | :--- |
| SG-1 | ASIL D | The deviation of the vehicle from the lane due to malfunction of the LKAS shall be prevented. | Must initiate safe state transition within 50 ms of fault detection. |
| SG-2 | ASIL B | The failure of the LKAS to provide steering assistance or warning shall be indicated to the driver within 500 ms. | Must activate the warning system within 500 ms of fault occurrence. |
| SG-3 | QM | Uncommanded steering assistance above a threshold of X Nm shall be suppressed during vehicle speeds below 10 km/h. | N/A (Handled by design constraints). |
`;

  return { markdown: md, itemName, itemId };
}


