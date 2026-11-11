# Architectural Blueprint: Pre-Tax Diversion Calibration, Dynamic Floor Clamping & Health Dashboard Simplification

## Completed Implementation Record

### 1. 401(k) Sliders Removed from Health Dashboard
- **Rationale**: 401(k) deferrals are already deducted prior to Form 1040 line 11 / Box 1 W-2 baseline AGI (IRC § 402(g)). Presenting secondary 401(k) sliders on the health dashboard created redundant and confusing adjustments against baseline AGI.
- **Implementation**:
  - Removed all 401(k) slider markup, inputs, and provisional MAGI labels from the health dashboard in both `index.html` and `AtlasBridgeDashboard.tsx`.
  - The left card now clearly represents **Gross Annual AGI (Form 1040 Base)** and displays the live **Adjusted MAGI & ACA Impact** card immediately below.
  - The pre-tax note under Adjusted MAGI displays the direct deduction: `-$X Trad-IRA Deduction` (or `-$0 reduction`).

### 2. Full Questionnaire Functionality Preserved
- All 401(k), retirement plan, and spousal coverage questions remain intact in the client intake questionnaire:
  - Retirement plan coverage options: *Neither*, *Client Only*, *Spouse Only*, and *Both Have Plans*.
  - When *Married Filing Jointly* is active, the **Spouse Age** field renders adjacent to client age.
  - Active participant coverage from the questionnaire continues to feed statutory active participant phase-out limits under IRC § 219(g) ($77k–$87k for single active, $123k–$143k for MFJ active, $230k–$240k for MFJ non-covered spouse).

### 3. Pre-Tax Diversion Slider & 100% FPL + $100 Poverty Floor Safeguard
- The **Pre-Tax Diversion Slider** (Trad-IRA / Qualified Annuity) serves as the primary tool to reduce AGI and maximize ACA subsidies.
- Dynamic poverty floor clamping guarantees that pre-tax diversions cannot reduce MAGI below $100 above the 100% Federal Poverty Level ($15,650 for single, $21,150 for couple + $100), protecting ACA marketplace premium tax credits and CSR Silver variants.
- Includes Kay Bailey Hutchison Spousal IRA support under IRC § 219(c) when Married Filing Jointly is active.

### 4. Supporting Features Intact
- **Annuities Growth & Protection Chart**: Interactive Chart.js projection comparing Fixed Index Annuities with 0% downside floor against S&P 500 equity volatility.
- **Life Dashboard Positioning**: "Popular Life Solutions in Stuart & Martin County" collapsible accordion placed directly below "Customize Policy Accumulation Parameters & Crediting Strategy".
- **DPC Unbundled from Premiums Bar**: Direct Primary Care membership fees are separated from health insurance premiums in the cost comparison chart.
- **Pre-Booking Advisory Agreement**: Disclaimer modal requiring acknowledgment of hypothetical projections and client tax responsibility before scheduling appointments.
