********************************************************************************
* 入院患者病職歴調査：復職不安研究
* 主解析 do-file（マルチレベルロジスティック回帰）v1
*
* 対象者の選定は sawada_cohort_finalize_v1.do（指導教員作成）と同じ手順：
*   退院日 2019/04/01～2024/03/31 → 入院時15歳以上 → 対象5疾病
*   → 就労者（現職の職業コードあり、991～993以外）
*   → 性別不一致IDの全レコード除外 → 同一患者は初回適格入院のみ
*   → （主解析）初回適格入院が職歴調査状況05（再入院コピー）なら除外
*
* モデル：レベル1＝患者、レベル2＝施設（ランダム切片）
*         年度（退院年度）は固定効果として調整
*
* 出力（集計値のみ。個票・ID・施設コードは出力しない）
*   main_results.xlsx
*   main_analysis.log
*
* 実行段階（0-3 で切り替え）
*   RUN_CC = 1 : 記述統計＋完全症例解析（最初はこれ）
*   RUN_MI = 1 : 多重代入による主解析（時間がかかる）
********************************************************************************

version 16.0
capture log close _all
clear all
set more off
set varabbrev off
set linesize 200
set seed 20261122

*===============================================================================
* 0. 設定
*===============================================================================

* 0-1. データフォルダ（これまでと同じ）
cd "C:/Users/sawad/OneDrive/デスクトップ/新しいフォルダー"
global XLSX "main_results.xlsx"

* 0-2. 主解析の条件
local EXCL_05   1      // 1=初回適格入院が05（再入院コピー）なら除外（主解析）
                       // 0=含める（感度分析）
local EMP_ONLY  0      // 1=雇用形態の記載がある人に限定（感度分析）

* 0-3. 実行段階
local RUN_CC    1      // 記述統計＋完全症例解析
local RUN_MI    0      // 多重代入（RUN_CC の結果を確認してから 1 に）
local MI_M      20     // 代入回数（研究計画書：20回以上）
local MI_SUBSETS "0 1 2 3 4 5"   // 0=全体モデル、1-5=疾病群別

capture erase "$XLSX"
log using "main_analysis.log", text replace name(mainlog)

noi di "============================================================"
noi di "主解析 v1  EXCL_05=`EXCL_05'  EMP_ONLY=`EMP_ONLY'  RUN_CC=`RUN_CC'  RUN_MI=`RUN_MI'  MI_M=`MI_M'"
noi di "Stata version = " c(stata_version)
noi di "============================================================"


*===============================================================================
* 1. 5年度分の読み込み（必要な列のみ）
*===============================================================================

local need "施設コード 患者番号 入院年月日 退院年月日 調査年月日 入院時年齢 性別コード 確定診断名コード1 職歴調査状況コード 職業分類コード現職 産業分類コード現職 雇用形態コード 不安有無 夜間勤務有無 夜間勤務回数 交替制勤務コード 総労働時間 勤務日数 勤務時間 時間外労働時間 保険区分 喫煙習慣程度コード 喫煙習慣程度 飲酒習慣程度コード 飲酒習慣程度 生活習慣病確認 身長 体重"

tempfile combined flowtmp
postfile flowh str90 stage double n using "`flowtmp'", replace

forvalues yy = 2019/2023 {
    noi di "--- `yy'.xlsx を読み込み ---"
    capture noisily import excel using "`yy'.xlsx", firstrow clear
    if _rc {
        noi di as error "読み込みエラー: `yy'.xlsx"
        capture postclose flowh
        log close mainlog
        exit 601
    }
    foreach v of local need {
        capture confirm variable `v'
        if _rc {
            noi di as error "列が見つかりません: `yy'.xlsx / `v'"
            capture postclose flowh
            log close mainlog
            exit 111
        }
    }
    keep `need'
    foreach v of local need {
        capture confirm numeric variable `v'
        if !_rc quietly tostring `v', replace force format(%30.0g)
        quietly replace `v' = strtrim(`v')
    }
    gen int file_year = `yy'
    compress
    if `yy' > 2019 append using "`combined'"
    quietly save "`combined'", replace
}
use "`combined'", clear
gen long source_order = _n
quietly count
post flowh ("全レコード（5ファイル）") (r(N))


*===============================================================================
* 2. 日付・ID
*===============================================================================

foreach v in 入院年月日 退院年月日 調査年月日 {
    local s ""
    if "`v'" == "入院年月日" local s "adm"
    if "`v'" == "退院年月日" local s "dis"
    if "`v'" == "調査年月日" local s "survey"
    gen double _raw = real(subinstr(`v', ",", "", .))
    gen double `s'_date = .
    quietly replace `s'_date = daily(string(_raw, "%12.0f"), "YMD") if missing(`s'_date) & inrange(_raw,19000101,21001231)
    quietly replace `s'_date = _raw - 21916 if missing(`s'_date) & inrange(_raw,30000,80000)
    quietly replace `s'_date = _raw if missing(`s'_date) & inrange(_raw,15000,29999)
    quietly replace `s'_date = daily(`v',"YMD") if missing(`s'_date)
    format `s'_date %tdCCYY/NN/DD
    drop _raw
}

* 同一患者：施設コード＋患者番号（監査で患者番号のみと同じ結果を確認済み）
egen long pid = group(施設コード 患者番号) if 施設コード!="" & 患者番号!=""

* 性別不一致IDは全レコード除外（全レコードで判定）
gen byte male = .
replace male = 1 if upper(性別コード) == "M"
replace male = 0 if upper(性別コード) == "F"
bysort pid: egen byte _smin = min(male)
bysort pid: egen byte _smax = max(male)
gen byte sex_conflict = !missing(pid) & !missing(_smin,_smax) & _smin != _smax
drop _smin _smax


*===============================================================================
* 3. 対象者の選定（sawada_cohort_finalize_v1 と同じ順序）
*===============================================================================

gen double age = real(入院時年齢)

gen str20 _dx = upper(subinstr(subinstr(strtrim(確定診断名コード1),".","",.)," ","",.))
gen str1 _dxl = substr(_dx,1,1)
gen int  _dxn = real(substr(_dx,2,2))
gen byte disease = .
replace disease = 1 if _dxl=="C" | (_dxl=="D" & inrange(_dxn,0,48))
replace disease = 2 if _dxl=="M" & inrange(_dxn,0,99)
replace disease = 3 if (_dxl=="S" & inrange(_dxn,0,99)) | (_dxl=="T" & inrange(_dxn,0,98))
replace disease = 4 if _dxl=="I" & inrange(_dxn,0,99)
replace disease = 5 if _dxl=="K" & inrange(_dxn,0,93)
label define disease_lbl 1 "新生物" 2 "筋骨格系" 3 "損傷・中毒" 4 "循環器系" 5 "消化器系", replace
label values disease disease_lbl
drop _dx _dxl _dxn

gen double occ_n = real(職業分類コード現職)
gen byte working = (職業分類コード現職 != "" & !inlist(occ_n, 991, 992, 993))

keep if inrange(dis_date, td(01apr2019), td(31mar2024))
quietly count
post flowh ("退院日 2019/04/01～2024/03/31") (r(N))

keep if age >= 15 & age < .
quietly count
post flowh ("入院時15歳以上") (r(N))

keep if inrange(disease, 1, 5)
quietly count
post flowh ("対象5疾病") (r(N))

keep if working == 1
quietly count
post flowh ("就労者（現職職業コードあり・991～993以外）") (r(N))

drop if missing(adm_date) | dis_date < adm_date
quietly count
post flowh ("入院日あり・入退院日の矛盾なし") (r(N))

drop if sex_conflict
quietly count
post flowh ("性別不一致IDを除外") (r(N))

drop if missing(pid)
sort pid adm_date dis_date source_order
by pid: keep if _n == 1
quietly count
post flowh ("同一患者は初回適格入院のみ") (r(N))

gen byte status05 = inlist(職歴調査状況コード, "05", "5")
quietly count if status05
noi di "初回適格入院が05（再入院コピー）: " %12.0fc r(N)
if `EXCL_05' == 1 {
    drop if status05
    quietly count
    post flowh ("初回適格入院が05（再入院コピー）を除外") (r(N))
}


*===============================================================================
* 4. 分析用変数
*===============================================================================

* 4-1. 復職不安（1=有 → 1、2=無 → 0、3=不明・空欄 → 欠測）
gen byte anxiety = .
replace anxiety = 1 if 不安有無 == "1"
replace anxiety = 0 if 不安有無 == "2"
label define anx_lbl 0 "不安なし" 1 "不安あり", replace
label values anxiety anx_lbl

gen byte anx_status = 4
replace anx_status = 1 if 不安有無 == "1"
replace anx_status = 2 if 不安有無 == "2"
replace anx_status = 3 if 不安有無 == "3"
label define anxst_lbl 1 "不安あり" 2 "不安なし" 3 "不明(3)" 4 "空欄", replace
label values anx_status anxst_lbl

label define male_lbl 0 "女性" 1 "男性", replace
label values male male_lbl

* 4-2. 雇用形態（コードブック：1正規 2パート 3アルバイト 4派遣 5契約・嘱託 6その他 7自営業）
gen double _emp = real(雇用形態コード)
gen byte emp_g = .
replace emp_g = 1 if _emp == 1
replace emp_g = 2 if inrange(_emp, 2, 5)
replace emp_g = 3 if _emp == 7
replace emp_g = 4 if _emp == 6
label define emp_lbl 1 "正規職員" 2 "非正規（パート・アルバイト・派遣・契約）" 3 "自営業" 4 "その他", replace
label values emp_g emp_lbl
drop _emp

if `EMP_ONLY' == 1 {
    keep if !missing(emp_g)
    quietly count
    post flowh ("【感度分析】雇用形態の記載ありに限定") (r(N))
}

* 4-3. 夜間勤務・交替制勤務（1有 2無 3不明）
gen byte night = .
replace night = 1 if 夜間勤務有無 == "1"
replace night = 0 if 夜間勤務有無 == "2"
label define yn_lbl 0 "なし" 1 "あり", replace
label values night yn_lbl

gen byte shift = .
replace shift = 1 if 交替制勤務コード == "1"
replace shift = 0 if 交替制勤務コード == "2"
label values shift yn_lbl

* 4-4. 保険区分（1労災以外 2労災）
gen byte rosai = .
replace rosai = 0 if 保険区分 == "1"
replace rosai = 1 if 保険区分 == "2"
label define rosai_lbl 0 "労災以外" 1 "労災", replace
label values rosai rosai_lbl

* 4-5. 喫煙（2016年4月以降：1吸わない 2習慣的に吸う 3禁煙 4吸っているが本数変化）
*      コード5は表にないため暫定で欠測。ログの名称対応表で確認すること。
gen double _sm = real(喫煙習慣程度コード)
gen byte smoke_g = .
replace smoke_g = 1 if _sm == 1
replace smoke_g = 2 if _sm == 3
replace smoke_g = 3 if inlist(_sm, 2, 4)
label define smoke_lbl 1 "吸わない" 2 "禁煙" 3 "現在喫煙", replace
label values smoke_g smoke_lbl

* 4-6. 飲酒（1飲めない 2飲まない 3以前毎日・今は飲まない 4時々 5ほぼ毎日 6毎日）
*      コード7は表にないため暫定で欠測。
gen double _dr = real(飲酒習慣程度コード)
gen byte drink_g = .
replace drink_g = 1 if inlist(_dr, 1, 2)
replace drink_g = 2 if _dr == 3
replace drink_g = 3 if _dr == 4
replace drink_g = 4 if inlist(_dr, 5, 6)
label define drink_lbl 1 "飲まない" 2 "以前飲酒" 3 "時々" 4 "ほぼ毎日・毎日", replace
label values drink_g drink_lbl

* 4-7. 生活習慣病（1有 2無 3不明）
gen byte lifestyle = .
replace lifestyle = 1 if 生活習慣病確認 == "1"
replace lifestyle = 0 if 生活習慣病確認 == "2"
label values lifestyle yn_lbl

* 4-8. BMI（身長cm・体重kg、明らかな外れ値は欠測）
gen double _h = real(身長)
gen double _w = real(体重)
replace _h = . if !inrange(_h, 120, 220)
replace _w = . if !inrange(_w, 25, 250)
gen double bmi = _w / (_h/100)^2
replace bmi = . if !inrange(bmi, 12, 70)
gen byte bmi_g = .
replace bmi_g = 1 if bmi < 18.5
replace bmi_g = 2 if bmi >= 18.5 & bmi < 25
replace bmi_g = 3 if bmi >= 25 & bmi < .
label define bmi_lbl 1 "<18.5" 2 "18.5-24.9" 3 ">=25", replace
label values bmi_g bmi_lbl
drop _h _w

* 4-9. 産業分類（統一コード → 大分類。小さい分類は統合）
gen double ind_n = real(産業分類コード現職)
gen byte ind_g = .
replace ind_g = 1  if inlist(ind_n, 11, 21, 31, 32, 41)
replace ind_g = 2  if inrange(ind_n, 51, 53)
replace ind_g = 3  if inrange(ind_n, 61, 84)
replace ind_g = 4  if inrange(ind_n, 91, 94)
replace ind_g = 5  if inrange(ind_n, 101, 105)
replace ind_g = 6  if inrange(ind_n, 111, 118)
replace ind_g = 7  if inrange(ind_n, 121, 132)
replace ind_g = 8  if inrange(ind_n, 141, 147) | inlist(ind_n, 151, 152, 209)
replace ind_g = 9  if inlist(ind_n, 201, 202, 210)
replace ind_g = 10 if inrange(ind_n, 161, 164)
replace ind_g = 11 if inrange(ind_n, 203, 205)
replace ind_g = 12 if inlist(ind_n, 181, 182)
replace ind_g = 13 if inrange(ind_n, 171, 173)
replace ind_g = 14 if inlist(ind_n, 191, 192, 206, 207, 208) | inrange(ind_n, 211, 214)
replace ind_g = 15 if inrange(ind_n, 221, 223)
replace ind_g = 16 if ind_n == 900
label define ind_lbl 1 "農林漁業・鉱業" 2 "建設業" 3 "製造業" 4 "電気・ガス・水道" ///
    5 "情報通信業" 6 "運輸業" 7 "卸売・小売業" 8 "金融・保険・不動産・物品賃貸" ///
    9 "学術研究・専門技術サービス" 10 "宿泊・飲食サービス" 11 "生活関連サービス・娯楽" ///
    12 "教育・学習支援" 13 "医療・福祉" 14 "複合サービス・その他サービス" ///
    15 "公務" 16 "分類不能の産業", replace
label values ind_g ind_lbl

* 4-10. 職業分類（統一コード → 大分類）
gen byte occ_g = .
replace occ_g = 1  if inrange(occ_n, 11, 33)
replace occ_g = 2  if inrange(occ_n, 34, 37)
replace occ_g = 3  if inrange(occ_n, 38, 44)
replace occ_g = 4  if inrange(occ_n, 45, 46)
replace occ_g = 5  if inrange(occ_n, 47, 53)
replace occ_g = 6  if inrange(occ_n, 54, 56)
replace occ_g = 7  if inrange(occ_n, 57, 59)
replace occ_g = 8  if inrange(occ_n, 60, 64)
replace occ_g = 9  if inrange(occ_n, 65, 89)
replace occ_g = 10 if occ_n == 994
label define occ_lbl 1 "専門的・技術的" 2 "管理的" 3 "事務" 4 "販売" 5 "サービス" ///
    6 "保安" 7 "農林漁業" 8 "運輸・通信" 9 "生産工程・労務" 10 "分類不能の職業", replace
label values occ_g occ_lbl

* 4-11. 年度（退院年度）・施設
gen int fy = year(dis_date) - (month(dis_date) <= 3)
egen int fac = group(施設コード)

label variable anxiety   "復職不安"
label variable age       "入院時年齢"
label variable male      "性別"
label variable disease   "疾病群"
label variable emp_g     "雇用形態"
label variable night     "夜間勤務"
label variable shift     "交替制勤務"
label variable rosai     "保険区分"
label variable smoke_g   "喫煙"
label variable drink_g   "飲酒"
label variable lifestyle "生活習慣病"
label variable bmi_g     "BMI"
label variable ind_g     "産業（大分類）"
label variable occ_g     "職業（大分類）"
label variable fy        "退院年度"


*===============================================================================
* 5. コードの確認（集計のみ）
*===============================================================================

noi di "===== 産業・職業コードで大分類に割り当てられなかった件数 ====="
noi count if missing(ind_g) & 産業分類コード現職 != ""
noi count if missing(ind_g) & 産業分類コード現職 == ""
noi count if missing(occ_g)

noi di "===== 喫煙・飲酒：コードと名称の対応（5・7の意味の確認用） ====="
noi tab 喫煙習慣程度コード 喫煙習慣程度, missing
noi tab 飲酒習慣程度コード 飲酒習慣程度, missing

noi di "===== 勤務時間関連（連続変数）の分布：モデル投入の検討用 ====="
foreach v in 総労働時間 勤務日数 勤務時間 時間外労働時間 夜間勤務回数 {
    quietly gen double _x = real(`v')
    quietly count if !missing(_x)
    local nn = r(N)
    if `nn' > 0 {
        quietly summarize _x, detail
        noi di "`v': N=" %9.0fc `nn' "  p5=" %8.1f r(p5) "  p25=" %8.1f r(p25) ///
            "  p50=" %8.1f r(p50) "  p75=" %8.1f r(p75) "  p95=" %8.1f r(p95)
    }
    else noi di "`v': 数値の記録なし"
    drop _x
}

* 解析に使わない文字列・ID列はここで削除（個票の保持を最小化）
keep pid fac fy disease anxiety anx_status age male emp_g night shift rosai ///
     smoke_g drink_g lifestyle bmi bmi_g ind_g occ_g status05 survey_date adm_date
drop pid survey_date adm_date


*===============================================================================
* 6. 出力用の補助プログラム
*===============================================================================

* 10件未満は "<10" として出力
capture program drop pxn
program define pxn
    args cell value
    if `value' > 0 & `value' < 10 {
        putexcel `cell' = "<10"
    }
    else {
        putexcel `cell' = (`value')
    }
end

* カテゴリ変数の Table 1 行（全体／不安あり／不安なし／不安欠測）
capture program drop t1cat
program define t1cat
    args v
    local vlab : variable label `v'
    local vl : value label `v'
    quietly levelsof `v', local(levs)
    foreach k of local levs {
        local r = $T1ROW
        local klab "`k'"
        if "`vl'" != "" local klab : label `vl' `k'
        putexcel A`r' = "`vlab'" B`r' = "`klab'"
        local col = 0
        foreach cond in "1" "anxiety==1" "anxiety==0" "missing(anxiety)" {
            quietly count if `cond' & !missing(`v')
            local den = r(N)
            quietly count if `cond' & `v' == `k'
            local nn = r(N)
            local pp = cond(`den' > 0, 100*`nn'/`den', .)
            local cN  = word("C E G I", `col'+1)
            local cP  = word("D F H J", `col'+1)
            pxn `cN'`r' `nn'
            putexcel `cP'`r' = (`pp')
            local ++col
        }
        global T1ROW = $T1ROW + 1
    }
    * 欠測行
    local r = $T1ROW
    putexcel A`r' = "`vlab'" B`r' = "欠測"
    local col = 0
    foreach cond in "1" "anxiety==1" "anxiety==0" "missing(anxiety)" {
        quietly count if `cond' & missing(`v')
        local nmis = r(N)
        local cN = word("C E G I", `col'+1)
        pxn `cN'`r' `nmis'
        local ++col
    }
    global T1ROW = $T1ROW + 2
end

* 推定結果（固定効果のOR・95%CI・p値）を書き出す
capture program drop export_or
program define export_or, rclass
    syntax, Sheet(string) Startrow(integer) Label(string)
    tempname B V
    matrix `B' = e(b)
    matrix `V' = e(V)
    local cn : colnames `B'
    local eq : coleq `B'
    local k = colsof(`B')
    local dep "`e(depvar)'"
    putexcel set "$XLSX", sheet("`sheet'") modify
    local row = `startrow'
    putexcel A`row' = "`label'" B`row' = "N" C`row' = (e(N))
    local ++row
    putexcel A`row' = "Parameter" B`row' = "OR" C`row' = "95%CI_low" D`row' = "95%CI_high" E`row' = "p"
    local ++row
    forvalues j = 1/`k' {
        local c : word `j' of `cn'
        local e : word `j' of `eq'
        if "`e'" != "`dep'" continue
        if "`c'" == "_cons" continue
        if strpos("`c'", "o.") continue
        if strpos("`c'", "b.") {
            putexcel A`row' = "`c'" B`row' = "ref"
            local ++row
            continue
        }
        local b  = `B'[1,`j']
        local se = sqrt(`V'[`j',`j'])
        putexcel A`row' = "`c'" B`row' = (exp(`b')) ///
            C`row' = (exp(`b' - invnormal(.975)*`se')) ///
            D`row' = (exp(`b' + invnormal(.975)*`se')) ///
            E`row' = (2*normal(-abs(`b'/`se')))
        local ++row
    }
    return scalar nextrow = `row' + 1
end


*===============================================================================
* 7. 記述統計
*===============================================================================

postclose flowh
preserve
    use "`flowtmp'", clear
    noi di "===== 対象者選定フロー ====="
    noi list stage n, noobs clean
    putexcel set "$XLSX", sheet("Flow") replace
    putexcel A1 = "選定段階" B1 = "N"
    local nn = _N
    forvalues i = 1/`nn' {
        local s = stage[`i']
        local k = n[`i']
        putexcel A`=`i'+1' = "`s'" B`=`i'+1' = (`k')
    }
restore

* README
putexcel set "$XLSX", sheet("README") modify
putexcel A1 = "復職不安研究 主解析 v1（集計値のみ、10件未満は<10）"
putexcel A2 = "EXCL_05" B2 = (`EXCL_05') A3 = "EMP_ONLY" B3 = (`EMP_ONLY')
putexcel A4 = "RUN_CC" B4 = (`RUN_CC') A5 = "RUN_MI" B5 = (`RUN_MI') A6 = "MI_M" B6 = (`MI_M')
putexcel A8 = "モデル：施設ランダム切片の2レベルロジスティック回帰、退院年度は固定効果"
putexcel A9 = "参照カテゴリ：産業=製造業、職業=事務、雇用形態=正規職員"

* 復職不安の内訳（疾病群別）
noi di "===== 復職不安の内訳（疾病群別） ====="
noi tab disease anx_status, row missing

* Table 1
putexcel set "$XLSX", sheet("Table1") modify
putexcel A1 = "Variable" B1 = "Level" C1 = "全体_N" D1 = "全体_%" E1 = "不安あり_N" F1 = "不安あり_%" ///
         G1 = "不安なし_N" H1 = "不安なし_%" I1 = "不安欠測_N" J1 = "不安欠測_%"
local r = 2
putexcel A`r' = "入院時年齢" B`r' = "平均(SD)"
local col = 0
foreach cond in "1" "anxiety==1" "anxiety==0" "missing(anxiety)" {
    quietly summarize age if `cond'
    local cN = word("C E G I", `col'+1)
    local cP = word("D F H J", `col'+1)
    putexcel `cN'`r' = (r(mean)) `cP'`r' = (r(sd))
    local ++col
}
global T1ROW = 4
foreach v in male disease emp_g night shift rosai smoke_g drink_g lifestyle bmi_g ind_g occ_g fy {
    t1cat `v'
}

* 欠測状況
putexcel set "$XLSX", sheet("Missing") modify
putexcel A1 = "Variable" B1 = "N_missing" C1 = "Missing_%"
quietly count
local ntot = r(N)
local r = 2
foreach v in anxiety age male disease emp_g night shift rosai smoke_g drink_g lifestyle bmi_g ind_g occ_g fy fac {
    quietly count if missing(`v')
    putexcel A`r' = "`v'" B`r' = (r(N)) C`r' = (100*r(N)/`ntot')
    local ++r
}
egen byte _nm = rowmiss(anxiety age male emp_g night shift rosai smoke_g drink_g lifestyle bmi_g ind_g occ_g)
quietly count if _nm == 0
putexcel E1 = "完全症例数" F1 = (r(N)) E2 = "全対象者数" F2 = (`ntot')
gen byte cc = (_nm == 0)
drop _nm


*===============================================================================
* 8. モデルの定義
*===============================================================================

local covs "ib1.emp_g i.night i.shift i.rosai c.age i.male i.smoke_g i.drink_g i.lifestyle ib2.bmi_g i.fy"
local exp_IND "ib3.ind_g"
local exp_OCC "ib3.occ_g"
local exp_BOTH "ib3.ind_g ib3.occ_g"


*===============================================================================
* 9. 完全症例解析（＋ null model による施設間のばらつき）
*===============================================================================

if `RUN_CC' == 1 {

    * 9-1. Null model：ICC と MOR（全体・疾病群別）
    putexcel set "$XLSX", sheet("ICC") modify
    putexcel A1 = "Subset" B1 = "N" C1 = "施設数" D1 = "ICC" E1 = "MOR"
    local r = 2
    foreach d of local MI_SUBSETS {
        local ifc "!missing(anxiety)"
        local lab "全体"
        if `d' > 0 {
            local ifc "!missing(anxiety) & disease==`d'"
            local lab : label disease_lbl `d'
        }
        capture noisily melogit anxiety if `ifc' || fac:, nolog
        if _rc == 0 {
            quietly estat icc
            local icc = r(icc2)
            local v = `icc' * (_pi^2/3) / (1 - `icc')
            local mor = exp(sqrt(2*`v') * invnormal(0.75))
            putexcel A`r' = "`lab'" B`r' = (e(N)) C`r' = (el(e(N_g),1,1)) D`r' = (`icc') E`r' = (`mor')
        }
        else putexcel A`r' = "`lab'" B`r' = "推定エラー" C`r' = (_rc)
        local ++r
    }

    * 9-2. 完全症例：産業・職業・同時投入 × 全体・疾病群別
    foreach m in IND OCC BOTH {
        local sh "CC_`m'"
        putexcel set "$XLSX", sheet("`sh'") modify
        putexcel A1 = "完全症例解析：`m'（施設ランダム切片、年度固定効果）"
        local row = 3
        foreach d of local MI_SUBSETS {
            if `d' == 0 {
                local ifc "cc==1"
                local addd "i.disease"
                local lab "全体"
            }
            else {
                local ifc "cc==1 & disease==`d'"
                local addd ""
                local lab : label disease_lbl `d'
            }
            capture noisily melogit anxiety `exp_`m'' `covs' `addd' if `ifc' || fac:, nolog
            if _rc == 0 {
                export_or, sheet("`sh'") startrow(`row') label("`lab'")
                local row = r(nextrow)
            }
            else {
                putexcel set "$XLSX", sheet("`sh'") modify
                putexcel A`row' = "`lab'" B`row' = "推定エラー" C`row' = (_rc)
                local row = `row' + 2
            }
        }
    }
}


*===============================================================================
* 10. 多重代入による主解析
*===============================================================================

if `RUN_MI' == 1 {

    noi di "===== 多重代入 ====="
    mi set mlong

    * 欠測がある変数だけを代入対象にし、欠測のない変数は予測変数にする
    local logit_v ""
    local mlogit_v ""
    local regular_v "age disease fy fac"
    local preds "c.age i.disease i.fy i.fac"
    foreach v in anxiety male night shift rosai lifestyle {
        quietly count if missing(`v')
        if r(N) > 0 local logit_v "`logit_v' `v'"
        else {
            local regular_v "`regular_v' `v'"
            local preds "`preds' i.`v'"
        }
    }
    foreach v in emp_g smoke_g drink_g bmi_g ind_g occ_g {
        quietly count if missing(`v')
        if r(N) > 0 local mlogit_v "`mlogit_v' `v'"
        else {
            local regular_v "`regular_v' `v'"
            local preds "`preds' i.`v'"
        }
    }
    noi di "logit で代入: `logit_v'"
    noi di "mlogit で代入: `mlogit_v'"
    noi di "予測変数（欠測なし）: `preds'"

    mi register imputed `logit_v' `mlogit_v'
    mi register regular `regular_v'

    local blk ""
    if "`logit_v'"  != "" local blk "`blk' (logit, augment) `logit_v'"
    if "`mlogit_v'" != "" local blk "`blk' (mlogit, augment) `mlogit_v'"

    capture noisily mi impute chained `blk' = `preds', ///
        add(`MI_M') rseed(20261122) burnin(10) dots

    if _rc != 0 {
        noi di as error "多重代入でエラーが出ました（コード `=_rc'）。ログを確認してください。"
    }
    else {
        foreach m in IND OCC BOTH {
            local sh "MI_`m'"
            putexcel set "$XLSX", sheet("`sh'") modify
            putexcel A1 = "多重代入（M=`MI_M'）：`m'（施設ランダム切片、年度固定効果）"
            local row = 3
            foreach d of local MI_SUBSETS {
                if `d' == 0 {
                    local ifc ""
                    local addd "i.disease"
                    local lab "全体"
                }
                else {
                    local ifc "if disease==`d'"
                    local addd ""
                    local lab : label disease_lbl `d'
                }
                capture noisily mi estimate, post: ///
                    melogit anxiety `exp_`m'' `covs' `addd' `ifc' || fac:, nolog
                if _rc == 0 {
                    export_or, sheet("`sh'") startrow(`row') label("`lab'")
                    local row = r(nextrow)
                }
                else {
                    putexcel set "$XLSX", sheet("`sh'") modify
                    putexcel A`row' = "`lab'" B`row' = "推定エラー" C`row' = (_rc)
                    local row = `row' + 2
                }
            }
        }
    }
}


*===============================================================================
* 11. 終了（個票データは保存しない）
*===============================================================================

noi di "============================================================"
noi di "終了。共有するのは main_results.xlsx と main_analysis.log のみ。"
noi di "元のExcelや個票データは共有しないでください。"
noi di "============================================================"
log close mainlog
