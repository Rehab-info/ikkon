* ========================================================================
* Sawada: return-to-work anxiety among hospitalized patients, 2019-2023
* VERSION: 4.0 (2026-11-22; MI=20 protocol-aligned; Stata 18)
*
* Purpose: cohort flow, missingness, Table 1, disease-specific proportions,
*          and complete-case + MI(20) mixed-effects logistic regressions.
* No individual-level data or identifiers are written to the output files.
*
* PROTOCOL ALIGNMENT:
* (a) Discharge date 2019-04-01 through 2024-03-31 (not admission date).
* (b) Employment: current occupation code present and not 991/992/993.
*     This is a PROXY until the questionnaire's direct work-status variable
*     is identified. A blank employment-type is NOT an exclusion criterion.
* (c) Repeat admissions: first eligible admission per unique patient ID;
*     IDs with conflicting sex are excluded across ALL source files.
* (d) Exclude patients whose survey date precedes selected admission date.
* (e) Model specification: patient (level 1), fiscal year (level 2)
*     nested within facility (level 3).
* (f) Missing outcomes (3, blank) are not coded as 'No'; MI is among observed outcomes.
* (g) Current industry / occupation codes are used here; code-prefix grouping
*     remains a placeholder, not validated industry/occupation categories.
* This version adds MI by chained equations M=20 to the exploratory analysis.
* Both submitted documents require M>=20; this version uses M=20.
* Missing outcomes are NOT imputed; only incomplete covariates are imputed.
* Industry/occupation groupings need verification against the source codebook.
* Not a final approved primary analysis.
* Never send source xlsx files or identifiers to the supervisor.
* ========================================================================
version 18.0
capture log close _all
clear all
set more off
set linesize 180
set varabbrev off

* The folder with 2019.xlsx, 2020.xlsx, ... , 2023.xlsx
cd "C:/Users/sawad/OneDrive/デスクトップ/新しいフォルダー"
capture mkdir "sawada_v4_results"
global OUT "sawada_v4_results"
log using "$OUT/sawada_main_analysis_v4.log", text replace name(mainlog)
noi di "=== Sawada 2026-11-22: cohort cleanup + Table1 + CC + 20-imputation MI multilevel models ==="
* Patient ID and copied survey data were audited on 22 Nov 2026.
* Run complete-case sensitivity models first; then perform MI (M=20).
local RUN_MODELS 1
local RUN_MI 1
local M 20  // both submitted protocol/ethics documents request >=20
* Within each disease, pool two-character codes with fewer than 200
* valid-outcome observations. This rule uses COUNTS, NOT outcome status.
local MIN_GROUP_N 200

* ========================================================================
* 1. Import ONLY necessary analysis variables from each annual file.
*    Patient identifiers are used in memory for audit and deduplication only.
* ========================================================================
local required "施設コード 患者番号 入院年月日 退院年月日 調査年月日 入院時年齢 性別コード 確定診断名コード1 職歴調査状況コード 不安有無 雇用形態コード 夜間勤務有無 保険区分 喫煙習慣程度コード 飲酒習慣程度コード 生活習慣病確認 産業分類コード現職 職業分類コード現職"
tempfile combined flowfile outcomefile tablefile missfile modelfile maincohort
postfile flowh str65 step double n using "`flowfile'", replace
local imported_total 0

forvalues yy = 2019/2023 {
    noi di "--- Importing `yy'.xlsx ---"
    capture noisily import excel using "`yy'.xlsx", firstrow clear
    if _rc {
        noi di as error "Cannot import `yy'.xlsx; check working directory and Excel file."
        log close mainlog
        exit 601
    }
    foreach v of local required {
        capture confirm variable `v'
        if _rc {
            noi di as error "Missing required variable in `yy'.xlsx: `v'"
            log close mainlog
            exit 111
        }
    }
    * List ONLY the names of possible severity / baseline-functional-status fields.
    * No individual-level contents are sent to the log.
    if `yy' == 2019 {
        noi di "===== POTENTIAL SEVERITY / BASELINE VARIABLE NAMES (CHECK CODEBOOK) ====="
        foreach v of varlist _all {
            local hit 0
            foreach key in 重症 病期 ステージ FIM ADL Barthel NYHA JCS GCS 入院時状態 入院時意識 手術 併存 合併 重度 入院前 {
                if strpos(ustrlower("`v'"), ustrlower("`key'")) > 0 local hit 1
            }
            if `hit' noi di "Candidate column: `v'"
        }
    }
    keep `required'
    foreach v of local required {
        capture confirm numeric variable `v'
        if !_rc quietly tostring `v', replace force format(%30.0g)
        quietly replace `v' = strtrim(`v')
    }
    gen int file_year = `yy'
    quietly count
    local imported_total = `imported_total' + r(N)
    compress
    if `yy' > 2019 append using "`combined'"
    save "`combined'", replace
}
use "`combined'", clear
gen long source_order = _n
quietly count
post flowh ("Original: all 5 imported files") (r(N))
noi di "Imported total records = " r(N)

* Detect sex-discordant patient IDs across ALL records, not just eligible rows.
* No patient or facility identifier is displayed or exported.
gen byte has_patient_id = (患者番号 != "")
egen long pid = group(患者番号) if has_patient_id
gen byte male_id = .
replace male_id = 1 if upper(性別コード) == "M"
replace male_id = 0 if upper(性別コード) == "F"
bysort pid: egen byte sex_min = min(male_id) if has_patient_id
bysort pid: egen byte sex_max = max(male_id) if has_patient_id
gen byte sex_conflict = has_patient_id & !missing(sex_min,sex_max) & sex_min != sex_max
egen byte person_tag = tag(pid) if has_patient_id
quietly count if person_tag == 1 & sex_conflict
noi di "Sex-discordant patient IDs in source = " r(N)
quietly count if sex_conflict
noi di "Rows belonging to sex-discordant IDs in source = " r(N)

* ========================================================================
* 2. Protocol discharge-date restriction (NOT admission-date restriction).
* Dates from Excel may be Stata daily integers, Excel serials, or YYYYMMDD.
* The date conversion is based on the previous successfully run diagnostic.
* ========================================================================
foreach v in 入院年月日 退院年月日 調査年月日 {
    local z "survey_date"
    if "`v'" == "入院年月日" local z "admission_date"
    if "`v'" == "退院年月日" local z "discharge_date"
    gen double _num_`z' = real(subinstr(`v', ",", "", .))
    gen double `z' = .
    replace `z' = daily(string(_num_`z', "%12.0f"), "YMD") if missing(`z') & inrange(_num_`z', 19000101, 21001231)
    replace `z' = _num_`z' - 21916 if missing(`z') & inrange(_num_`z', 30000, 80000)
    replace `z' = _num_`z' if missing(`z') & inrange(_num_`z', 15000, 29999)
    replace `z' = daily(`v', "YMD") if missing(`z')
    replace `z' = daily(`v', "DMY") if missing(`z')
    replace `z' = daily(`v', "MDY") if missing(`z')
    format `z' %tdCCYY/NN/DD
}
quietly count if missing(discharge_date)
noi di "Unparseable/missing discharge dates: " r(N)
quietly count if inrange(discharge_date, td(01apr2019), td(31mar2024))
noi di "Discharge date eligible, before other restrictions: " r(N)
keep if inrange(discharge_date, td(01apr2019), td(31mar2024))
quietly count
post flowh ("Discharges 2019-04-01 to 2024-03-31") (r(N))

destring 入院時年齢, generate(age) ignore(" ,") force
keep if age >= 15 & age < .
quietly count
post flowh ("Age at admission >=15") (r(N))

gen str20 dx_clean = upper(strtrim(確定診断名コード1))
replace dx_clean = subinstr(dx_clean, ".", "", .)
replace dx_clean = subinstr(dx_clean, " ", "", .)
gen str1 dx_letter = substr(dx_clean, 1, 1)
gen int dx_num2 = real(substr(dx_clean, 2, 2))
gen byte disease = .
replace disease = 1 if dx_letter == "C" | (dx_letter == "D" & inrange(dx_num2, 0, 48))
replace disease = 2 if dx_letter == "M" & inrange(dx_num2, 0, 99)
replace disease = 3 if (dx_letter == "S" & inrange(dx_num2, 0, 99)) | (dx_letter == "T" & inrange(dx_num2, 0, 98))
replace disease = 4 if dx_letter == "I" & inrange(dx_num2, 0, 99)
replace disease = 5 if dx_letter == "K" & inrange(dx_num2, 0, 93)
label define diseaselbl 1 "新生物" 2 "筋骨格系" 3 "損傷・中毒" 4 "循環器系" 5 "消化器系"
label values disease diseaselbl
keep if inrange(disease, 1, 5)
quietly count
post flowh ("Five disease groups") (r(N))

* Use current occupation code for employment classification, as asked.
* Codebook says 991=homemaker, 992=student, 993=unemployed.
* IMPORTANT: occupation nonblank and not 991-993 is a provisional rule;
* it is not the same as a directly recorded 'currently working=yes'.
gen str15 current_job_code = strtrim(職業分類コード現職)
gen byte employment = real(雇用形態コード)
replace employment = . if !inrange(employment,1,7)
gen byte working_proxy = current_job_code != "" & !inlist(current_job_code, "991", "992", "993")
noi di "=== Working proxy by employment-type availability ==="
tab working_proxy 雇用形態コード, missing
quietly count if current_job_code == ""
noi di "Blank current-occupation code: " r(N)
quietly count if inlist(current_job_code, "991", "992", "993")
noi di "Codes 991/992/993 (not currently working): " r(N)
keep if working_proxy == 1
quietly count
post flowh ("Working proxy: current job not 991-993 and nonblank") (r(N))
noi di "Working proxy count; NOT expected to equal old 205157: " r(N)
quietly count if missing(employment)
noi di "Employment type blank AMONG working proxy: " r(N)

* ========================================================================
* 3. Outcome: 1=yes, 2=no, 3=unknown; blank kept separately.
* ========================================================================
gen byte outcome_status = 4
replace outcome_status = 1 if 不安有無 == "1"
replace outcome_status = 2 if 不安有無 == "2"
replace outcome_status = 3 if 不安有無 == "3"
replace outcome_status = 5 if !inlist(不安有無, "", "1", "2", "3")
label define outlbl 1 "Anxiety=yes" 2 "Anxiety=no" 3 "Unknown" 4 "Blank" 5 "Other code"
label values outcome_status outlbl
gen byte return_anxiety = .
replace return_anxiety = 1 if outcome_status == 1
replace return_anxiety = 0 if outcome_status == 2
label define anxlbl 0 "No" 1 "Yes"
label values return_anxiety anxlbl
gen byte answered = inlist(outcome_status, 1, 2)

* Calendar fiscal year is based on DISCHARGE date.
gen int fiscal_year = year(discharge_date) - (month(discharge_date) <= 3)
noi di "==== Discharge-year alignment with input files ===="
tab file_year fiscal_year, missing
noi di "==== Outcome completeness BEFORE possible ID restriction ===="
tab disease outcome_status, row missing
tab fiscal_year outcome_status, row missing

* ========================================================================
* 4. Confirm unique patients, remove copied old surveys, then model cohort.
*    Based on sawada_cohort_finalize_v1.log (22 Nov 2026).
*    First eligible visit is chosen BEFORE excluding old surveys, to avoid
*    replacing a patient's first visit with a later visit (selection bias).
* ========================================================================
noi di "==== ID / chronological admission checks ===="
quietly count if !has_patient_id
noi di "Eligible rows with missing patient ID (excluded): " r(N)
drop if !has_patient_id
quietly count if sex_conflict
noi di "Eligible rows linked to discordant-sex IDs (excluded): " r(N)
drop if sex_conflict
quietly count
post flowh ("After ID present and sex-consistency checks") (r(N))

quietly count if missing(admission_date)
noi di "Eligible rows missing admission date (excluded): " r(N)
drop if missing(admission_date)
quietly count if discharge_date < admission_date
noi di "Eligible rows discharged before admitted (excluded): " r(N)
drop if discharge_date < admission_date
quietly count
post flowh ("After chronological date checks") (r(N))

* One patient has one selected index admission (not a lifelong first stay).
sort pid admission_date discharge_date source_order
by pid: gen long n_eligible_admissions = _N
by pid: gen byte first_eligible = (_n == 1)
quietly count if first_eligible & n_eligible_admissions > 1
noi di "Patients with multiple eligible records: " r(N)
quietly count if !first_eligible
noi di "Extra eligible records excluded: " r(N)
keep if first_eligible
quietly count
post flowh ("First eligible admission per unique patient ID") (r(N))
noi di "Before survey-date restriction, expected N=156034: " r(N)
if r(N) != 156034 {
    noi di as error "STOP: cohort N differs from 2026-11-22 audit. Review source Excel."
    capture postclose flowh
    log close mainlog
    exit 459
}

* Count status 05 but do not exclude it solely on its status code.
gen byte copied_status05 = inlist(職歴調査状況コード,"05","5")
gen byte survey_predates_adm = !missing(survey_date, admission_date) & survey_date < admission_date
quietly count if copied_status05
noi di "First-eligible patients with status 05: " r(N)
quietly count if survey_predates_adm
noi di "First-eligible patients with survey before admission: " r(N)
local removed_olds = r(N)
if `removed_olds' != 8329 {
    noi di as error "STOP: earlier-survey count differs from validated 8329."
    capture postclose flowh
    log close mainlog
    exit 459
}
quietly count if copied_status05 & survey_predates_adm
noi di "Both status 05 and survey before admission: " r(N)
quietly count if copied_status05 & !survey_predates_adm
noi di "Status 05 but no earlier survey date (retained): " r(N)
quietly count if missing(survey_date)
noi di "Missing survey date (retained pending review): " r(N)
quietly count if survey_date > discharge_date & !missing(survey_date, discharge_date)
noi di "Survey date AFTER discharge date; audit if nonzero: " r(N)

* USER-APPROVED MAIN-COHORT EXCLUSION: do not use old copied surveys.
drop if survey_predates_adm == 1
quietly count
post flowh ("After excluding survey date before admission") (r(N))
noi di "Final cohort; expected N=147705: " r(N)
if r(N) != 147705 {
    noi di as error "STOP: post-exclusion N differs from expected 147705."
    capture postclose flowh
    log close mainlog
    exit 459
}
noi di "Number of dated-before-admission records excluded: `removed_olds'"

noi di "==== OUTCOMES IN FINAL COHORT ===="
tab outcome_status, missing
tab disease outcome_status, row missing
tab fiscal_year outcome_status, row missing

quietly count if answered
post flowh ("Outcome yes/no after old-survey exclusions") (r(N))
noi di "Final outcome yes/no = " r(N)
quietly count if outcome_status == 3
post flowh ("Outcome unknown (3) after exclusion") (r(N))
quietly count if outcome_status == 4
post flowh ("Outcome blank after exclusion") (r(N))
postclose flowh

* 5. Covariates (the original complete-case model definitions).
* ========================================================================
gen byte male = .
replace male = 1 if upper(性別コード) == "M"
replace male = 0 if upper(性別コード) == "F"
label define sexlbl 0 "Female" 1 "Male"
label values male sexlbl

gen byte night_work = .
replace night_work = 1 if 夜間勤務有無 == "1"
replace night_work = 0 if 夜間勤務有無 == "2"
label define nightlbl 0 "No night work" 1 "Night work"
label values night_work nightlbl

gen byte lifestyle = .
replace lifestyle = 1 if 生活習慣病確認 == "1"
replace lifestyle = 0 if 生活習慣病確認 == "2"
label define lifelbl 0 "No" 1 "Yes"
label values lifestyle lifelbl

encode 保険区分, generate(insurance)
encode 喫煙習慣程度コード, generate(smoking)
encode 飲酒習慣程度コード, generate(drinking)
encode 施設コード, generate(facility)
quietly levelsof facility, local(facilities)
local n_facilities : word count `facilities'
noi di "Number of facilities in final cohort = `n_facilities'"

* Exploratory 2-character industry / occupation groupings.
* These are CODE PREFIXES, not validated major-group classifications.
foreach x in industry occupation {
    if "`x'" == "industry" local source "産業分類コード現職"
    if "`x'" == "occupation" local source "職業分類コード現職"
    gen str2 `x'_prefix = substr(strtrim(`source'), 1, 2)
    bysort disease `x'_prefix: egen long `x'_n = total(answered == 1)
    replace `x'_prefix = "ZZ" if `x'_prefix != "" & `x'_n < `MIN_GROUP_N'
    encode `x'_prefix, generate(`x'_group)
    drop `x'_n
}

* Complete case includes BOTH industry and occupation, so sample is the
* SAME for the three industry/occupation specifications within a disease.
egen byte nmiss_model = rowmiss(return_anxiety age male employment night_work ///
    insurance smoking drinking lifestyle industry_group occupation_group facility)
gen byte complete_case = (nmiss_model == 0)
quietly count if complete_case
postfile missh str40 variable double n_nonmissing n_missing pct_missing using "`missfile'", replace
quietly count
local denom = r(N)
foreach v in return_anxiety age male employment night_work insurance smoking drinking lifestyle industry_group occupation_group facility {
    quietly count if missing(`v')
    local nmiss = r(N)
    local nnon = `denom' - `nmiss'
    local pp = 100*`nmiss'/`denom'
    post missh ("`v'") (`nnon') (`nmiss') (`pp')
}
postclose missh
quietly count if complete_case
local n_cc = r(N)
noi di "Complete cases (common to all three model specifications) = `n_cc'"
noi di "N valid outcome = "
quietly count if answered
noi di r(N)
noi di "N complete case = `n_cc'"

noi di "==== ANALYSIS SAMPLE SIZES BY DISEASE ===="
tab disease complete_case, row missing
tab disease return_anxiety, row missing
* Retain the local, temporary complete cohort for producing summary outputs.
save "`maincohort'", replace

* ========================================================================
* 6. Aggregate outcomes by disease, fiscal year, and overall; no person rows.
* ========================================================================
postfile oh str22 grouping str32 subgroup double total yes no unknown blank valid percent_yes_of_valid using "`outcomefile'", replace
foreach g in disease fiscal_year {
    quietly levelsof `g', local(levels)
    foreach k of local levels {
        quietly count if `g' == `k'
        local nt = r(N)
        quietly count if `g' == `k' & outcome_status == 1
        local ny = r(N)
        quietly count if `g' == `k' & outcome_status == 2
        local nn = r(N)
        quietly count if `g' == `k' & outcome_status == 3
        local nu = r(N)
        quietly count if `g' == `k' & outcome_status == 4
        local nb = r(N)
        local nv = `ny' + `nn'
        local pct = cond(`nv' > 0, 100*`ny'/`nv', .)
        local cat "`k'"
        if "`g'" == "disease" {
            local valuelabel : value label disease
            local cat : label `valuelabel' `k'
        }
        post oh ("`g'") ("`cat'") (`nt') (`ny') (`nn') (`nu') (`nb') (`nv') (`pct')
    }
}
quietly count
local nt = r(N)
quietly count if outcome_status == 1
local ny = r(N)
quietly count if outcome_status == 2
local nn = r(N)
quietly count if outcome_status == 3
local nu = r(N)
quietly count if outcome_status == 4
local nb = r(N)
local nv = `ny'+`nn'
local pct = cond(`nv'>0,100*`ny'/`nv',.)
post oh ("All") ("2019-2023") (`nt') (`ny') (`nn') (`nu') (`nb') (`nv') (`pct')
postclose oh

* ========================================================================
* 7. Table 1 among observed yes/no outcomes: age + categorical variables.
*    Values are strings n (%) or mean (SD). Percent denominators are the
*    nonmissing count for that variable within each anxiety group.
* ========================================================================
postfile th str42 Variable str60 Level str40 Overall str40 No_anxiety str40 Anxiety using "`tablefile'", replace
quietly summarize age if answered
local avg0 = string(r(mean), "%8.2f") + " (" + string(r(sd), "%8.2f") + ")"
quietly summarize age if return_anxiety == 0
local avg1 = string(r(mean), "%8.2f") + " (" + string(r(sd), "%8.2f") + ")"
quietly summarize age if return_anxiety == 1
local avg2 = string(r(mean), "%8.2f") + " (" + string(r(sd), "%8.2f") + ")"
post th ("Age at admission") ("Mean (SD)") ("`avg0'") ("`avg1'") ("`avg2'")

local tabvars "male disease employment night_work insurance smoking drinking lifestyle industry_group occupation_group"
foreach v of local tabvars {
    quietly count if answered & !missing(`v')
    local denall = r(N)
    quietly count if return_anxiety == 0 & !missing(`v')
    local denno = r(N)
    quietly count if return_anxiety == 1 & !missing(`v')
    local denyes = r(N)
    quietly levelsof `v' if answered & !missing(`v'), local(levels)
    foreach k of local levels {
        quietly count if answered & `v' == `k'
        local a = r(N)
        quietly count if return_anxiety == 0 & `v' == `k'
        local b = r(N)
        quietly count if return_anxiety == 1 & `v' == `k'
        local c = r(N)
        local pa = cond(`denall'>0, 100*`a'/`denall', .)
        local pb = cond(`denno'>0, 100*`b'/`denno', .)
        local pc = cond(`denyes'>0, 100*`c'/`denyes', .)
        local sa = string(`a', "%12.0fc") + " (" + string(`pa', "%5.1f") + "%)"
        local sb = string(`b', "%12.0fc") + " (" + string(`pb', "%5.1f") + "%)"
        local sc = string(`c', "%12.0fc") + " (" + string(`pc', "%5.1f") + "%)"
        local cat "`k'"
        local vallab : value label `v'
        if "`vallab'" != "" {
            local named : label `vallab' `k'
            if "`named'" != "" local cat "`named'"
        }
        post th ("`v'") ("`cat'") ("`sa'") ("`sb'") ("`sc'")
    }
}
postclose th

* ========================================================================
* 8. Export aggregate Excel files. Never export the working patient dataset.
* ========================================================================
use "`flowfile'", clear
export excel using "$OUT/01_flow.xlsx", firstrow(variables) replace
use "`outcomefile'", clear
export excel using "$OUT/02_outcomes.xlsx", firstrow(variables) replace
use "`missfile'", clear
export excel using "$OUT/03_missingness.xlsx", firstrow(variables) replace
use "`tablefile'", clear
export excel using "$OUT/04_table1.xlsx", firstrow(variables) replace

* ========================================================================
* 9. Exploratory 3-level mixed-effects logistic regression (RUNS by default).
*    Patient / discharge fiscal-year within facility / facility.
*    5 diseases x {industry, occupation, both} = 15 exploratory models.
*    Multiple imputation (M=20) follows in section 10.
*    Complete-case estimates serve as sensitivity analyses.
* ========================================================================
if `RUN_MODELS' == 1 {
    use "`maincohort'", clear
    local adjust "i.employment i.night_work i.insurance c.age i.male i.smoking i.drinking i.lifestyle"
    postfile mh str28 disease_name str18 model str95 coefficient double OR CI_low CI_high p N str20 status using "`modelfile'", replace
    forvalues d = 1/5 {
        local diseasename : label diseaselbl `d'
        quietly count if disease == `d' & complete_case == 1
        local expected = r(N)
        noi di "======================================================"
        noi di "Disease: `diseasename'; eligible complete cases: `expected'"
        if `expected' < 100 noi di as error "WARNING: low model N; inspect output carefully."
        noi di "======================================================"
        foreach m in Industry Occupation Both {
            local ivars ""
            if "`m'" == "Industry" local ivars "i.industry_group"
            if "`m'" == "Occupation" local ivars "i.occupation_group"
            if "`m'" == "Both" local ivars "i.industry_group i.occupation_group"
            noi di "Fitting `diseasename' / `m'"
            capture noisily melogit return_anxiety `ivars' `adjust' ///
                if disease == `d' & complete_case == 1 || facility: || fiscal_year:, nolog or
            local rc = _rc
            if `rc' != 0 {
                noi di as error "MODEL FAILED: disease=`d' model=`m' error=`rc'"
                post mh ("`diseasename'") ("`m'") ("MODEL FAILED") (.) (.) (.) (.) (`expected') ("error `rc'")
            }
            else {
                local fitted = e(N)
                noi di "Fitted n = `fitted'; requested complete cases = `expected'"
                if `fitted' < `expected' {
                    noi di as error "WARNING: MODEL LOST OBSERVATIONS (separation/other issue). Review log."
                }
                matrix bb = e(b)
                matrix vv = e(V)
                local termnames : colnames bb
                local ncoef = colsof(bb)
                forvalues j = 1/`ncoef' {
                    local nm : word `j' of `termnames'
                    local beta = bb[1,`j']
                    local se = sqrt(vv[`j',`j'])
                    * Skip omitted factors and non-estimable parameters.
                    if (`se' > 0 & `se' < . & `beta' < .) {
                        local odds = exp(`beta')
                        local lcl = exp(`beta' - invnormal(.975)*`se')
                        local ucl = exp(`beta' + invnormal(.975)*`se')
                        local pp = 2*normal(-abs(`beta'/`se'))
                        local fixed = (strpos("`nm'", "industry_group") > 0 | ///
                            strpos("`nm'", "occupation_group") > 0 | ///
                            strpos("`nm'", "employment") > 0 | ///
                            strpos("`nm'", "night_work") > 0 | ///
                            strpos("`nm'", "insurance") > 0 | ///
                            strpos("`nm'", "age") > 0 | ///
                            strpos("`nm'", "male") > 0 | ///
                            strpos("`nm'", "smoking") > 0 | ///
                            strpos("`nm'", "drinking") > 0 | ///
                            strpos("`nm'", "lifestyle") > 0)
                        if (`fixed' == 1) {
                            post mh ("`diseasename'") ("`m'") ("`nm'") (`odds') (`lcl') (`ucl') (`pp') (`fitted') ("EXPLORATORY")
                        }
                    }
                }
            }
        }
    }
    postclose mh
    use "`modelfile'", clear
    export excel using "$OUT/05_model_ORs.xlsx", firstrow(variables) replace
}


* ========================================================================
* 10. MULTIPLE IMPUTATION (M=20), then 3-level mixed-effects logistic model
* ========================================================================
* Cohort selection is performed BEFORE MI. This analysis imputes ONLY
* covariates; outcome yes/no is observed (unknown/blank are excluded here).
* The observed outcome IS included as a categorical predictor in the MICE
* equations. This is NOT imputing missing outcomes as if they were observed.
*
* The imputation uses facility + fiscal-year FIXED INDICATORS to account for
* clustering approximately; it is not a full joint 3-level imputation model.
* The analysis model still has facility and facility-specific year intercepts.
* M=20 meets both documents' minimum (>=20), but codebook must be checked.
* ========================================================================
if `RUN_MI' == 1 {
    use "`maincohort'", clear
    keep if answered == 1
    quietly count
    local n_observed = r(N)
    noi di "===== MI ANALYSIS (OUTCOMES OBSERVED ONLY) ====="
    noi di "N observed outcome, before covariate MI = `n_observed'"
    noi di "MI imputation count M=`M' (protocol minimum >=20)"
    noi di "Do NOT use 'force' to conceal incomplete imputations."

    * Register only variables that actually have missing values.
    * Binary variables: logit. Nominal categories: multinomial logit.
    local binary_vars "night_work lifestyle"
    local nominal_vars "employment insurance smoking drinking industry_group occupation_group"
    local imp_binary ""
    local imp_nominal ""
    local all_imp ""

    foreach v of local binary_vars {
        quietly count if missing(`v')
        local nmissing = r(N)
        quietly levelsof `v' if !missing(`v'), local(levels)
        local nlevels : word count `levels'
        noi di "MI candidate `v': missing=`nmissing', observed categories=`nlevels'"
        if `nmissing' > 0 {
            if `nlevels' != 2 {
                noi di as error "STOP: `v' is not observed in exactly two classes. Review coding."
                capture log close mainlog
                exit 459
            }
            local imp_binary "`imp_binary' `v'"
            local all_imp "`all_imp' `v'"
        }
    }
    foreach v of local nominal_vars {
        quietly count if missing(`v')
        local nmissing = r(N)
        quietly levelsof `v' if !missing(`v'), local(levels)
        local nlevels : word count `levels'
        noi di "MI candidate `v': missing=`nmissing', observed categories=`nlevels'"
        if `nmissing' > 0 {
            if `nlevels' < 2 {
                noi di as error "STOP: `v' has <2 observed categories, cannot impute."
                capture log close mainlog
                exit 459
            }
            local imp_nominal "`imp_nominal' `v'"
            local all_imp "`all_imp' `v'"
        }
    }
    mi set mlong
    mi register regular return_anxiety disease facility fiscal_year age male
    local mi_ok 1
    if "`all_imp'" == "" {
        noi di as error "No missing analysis covariates: MI is unnecessary; no MI results."
        local mi_ok 0
    }
    else {
        mi register imputed `all_imp'
        * Syntax is assembled based on actually incomplete variables.
        local specs ""
        if "`imp_binary'" != "" local specs "`specs' (logit, augment) `imp_binary'"
        if "`imp_nominal'" != "" local specs "`specs' (mlogit, augment) `imp_nominal'"
        noi di "MI variables: `all_imp'"
        noi di "Fixed predictors in imputation: disease, facility, discharge FY, age, sex, outcome"
        capture noisily mi impute chained `specs' = ///
            i.disease i.facility i.fiscal_year c.age i.male i.return_anxiety, ///
            add(`M') burnin(10) rseed(20261122) dots
        if _rc {
            local mi_ok 0
            noi di as error "MI FAILED, do not interpret imputed models. Check sparse cells / separation / coding."
        }
    }
    if `mi_ok' == 1 {
        noi mi describe
        noi mi misstable summarize
        local adjust "i.employment i.night_work i.insurance c.age i.male i.smoking i.drinking i.lifestyle"
        tempfile miresultfile
        postfile mih str28 disease_name str18 model str95 coefficient ///
            double OR CI_low_approx CI_high_approx p_approx N ///
            str25 status using "`miresultfile'", replace
        forvalues d = 1/5 {
            local diseasename : label diseaselbl `d'
            foreach m in Industry Occupation Both {
                local ivars ""
                if "`m'" == "Industry" local ivars "i.industry_group"
                if "`m'" == "Occupation" local ivars "i.occupation_group"
                if "`m'" == "Both" local ivars "i.industry_group i.occupation_group"
                noi di "======== MI(20): `diseasename' / `m' ========"
                * Use pooled imputation estimates, keeping facility/year hierarchy.
                capture noisily mi estimate, post: ///
                    melogit return_anxiety `ivars' `adjust' ///
                    if disease == `d' || facility: || fiscal_year:, nolog
                local rc = _rc
                if `rc' != 0 {
                    noi di as error "MODEL FAILED: `diseasename' / `m'; Stata rc=`rc'"
                    post mih ("`diseasename'") ("`m'") ("MODEL FAILED") (.) (.) (.) (.) (.) ("error `rc'")
                }
                else {
                    local fitted = e(N)
                    * The MI log gives proper MI degrees of freedom and CIs.
                    * The Excel below uses normal-Wald CI/p approximations only.
                    * Do not report the approximations as final inference.
                    matrix bb = e(b)
                    matrix vv = e(V)
                    local termnames : colnames bb
                    local ncoef = colsof(bb)
                    forvalues j = 1/`ncoef' {
                        local nm : word `j' of `termnames'
                        local beta = bb[1,`j']
                        local se = sqrt(vv[`j',`j'])
                        if (`se' > 0 & `se' < . & `beta' < .) {
                            local fixed = (strpos("`nm'", "industry_group") > 0 | ///
                                strpos("`nm'", "occupation_group") > 0 | ///
                                strpos("`nm'", "employment") > 0 | ///
                                strpos("`nm'", "night_work") > 0 | ///
                                strpos("`nm'", "insurance") > 0 | ///
                                strpos("`nm'", "age") > 0 | ///
                                strpos("`nm'", "male") > 0 | ///
                                strpos("`nm'", "smoking") > 0 | ///
                                strpos("`nm'", "drinking") > 0 | ///
                                strpos("`nm'", "lifestyle") > 0)
                            if `fixed' {
                                local ORv = exp(`beta')
                                local L = exp(`beta' - invnormal(.975)*`se')
                                local U = exp(`beta' + invnormal(.975)*`se')
                                local pv = 2*normal(-abs(`beta'/`se'))
                                post mih ("`diseasename'") ("`m'") ("`nm'") ///
                                    (`ORv') (`L') (`U') (`pv') (`fitted') ("MI_Wald_approx")
                            }
                        }
                    }
                }
            }
        }
        postclose mih
        preserve
            use "`miresultfile'", clear
            export excel using "$OUT/06_MI20_model_ORs_APPROX.xlsx", firstrow(variables) replace
        restore
    }
}

noi di "============================================================"
noi di "FINISHED. Outputs in: $OUT"
noi di "SEND ONLY: sawada_main_analysis_v4.log, 01_flow.xlsx,"
noi di "02_outcomes.xlsx, 03_missingness.xlsx, 04_table1.xlsx,"
noi di "05_model_ORs.xlsx and 06_MI20_model_ORs_APPROX.xlsx (if generated)."
noi di "DO NOT SEND: 2019-2023.xlsx or any individual-level data."
noi di "Three levels: patient, facility-specific discharge fiscal year, facility."
noi di "Exclude old surveys; one first eligible admission per patient."
noi di "Industry/occupation code-prefix groupings need codebook review."
noi di "CC models are sensitivity analysis; MI(20) requires codebook review before final reporting."
noi di "For correct finite-M MI p-values/CIs consult the log, not 06_MI20_model_ORs_APPROX.xlsx."
noi di "Ethics application requests MI >=20; M=20 meets minimum."
noi di "============================================================"
log close mainlog
