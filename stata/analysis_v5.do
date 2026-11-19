********************************************************************************
* 入院患者病職歴調査：復職不安研究
* 学生用 do-file（Stata 16以上対応版・v5）
*
* v5 の変更点（v4から）
*   - 夜間勤務の列名を実データに合わせて「夜間勤務有無」に修正
*   - 1つ目のExcelの列名一覧（見出しのみ・個票値なし）をlogに出力
*   - 対象期間を 0-4 で指定する方式に変更（既定：2019/04/01～2024/03/31）
*   - データフォルダがOneDrive内の場合は停止する安全チェックを追加
*
* 対応：Stata 16 / 17 / 18 / 19 以降
*
* この do-file の目的
*   1. 元データを安全に読み込む
*   2. 研究対象者を作る
*   3. 分析用変数を作る
*   4. 記述統計・欠測状況を Excel に出す
*   5. 施設をレベル2としたマルチレベルロジスティック回帰を行う
*   6. 多重代入（MI）を行うコードを準備する
*
* 【重要】学生から返送してもらうファイル（2つだけ）
*   student_return.xlsx
*   analysis_run.log
*
* 【絶対に送ってはいけないもの】
*   元のExcel生データ、患者番号を含むファイル、個票データ
*
* 【実行方法】
*   1. 5年度分の元Excelファイルを「同じ1つのフォルダ」に置く
*      （そのフォルダには、元データ以外のExcelファイルを置かないでください）
*   2. このdo-fileをStataで開く
*   3. Ctrl + A ですべて選択
*   4. Ctrl + D で実行
*   5. ファイル選択画面が出たら、5年度分のうち「どれか1つ」を選ぶ
*   6. 同じフォルダ内のExcel 5ファイルを自動的に読み込み、縦に結合する
*   7. 同じフォルダに student_return.xlsx と analysis_run.log が作成される
*
* ※ Excel生データに「開くためのパスワード（暗号化）」が設定されている場合、
*    Stataから直接読み込めないことがあります。その場合はエラーがlogに残ります。
* ※ Excelの「シート保護」のみであれば、通常は読み込み可能です。
*
* Stata 16には dtable / etable / collect がないため使用しません。
* 集計・解析結果は summarize / tabulate / melogit / mi / putexcel のみで
* Excelに出力します。
********************************************************************************

version 16.0
clear all
set more off
set seed 1234


*===============================================================================
* 0. 5年度分のExcel生データが入っているフォルダを指定する
*===============================================================================

* 固定パスは使いません。
* 実行するとファイル選択画面が開きます。
* 5年度分のうち「どれか1つ」のExcel生データを選択してください。
* 選択したファイルと同じフォルダにあるExcel 5ファイルを自動的に読み込みます。
*
* 【重要】同じフォルダには、5年度分の元Excel以外のExcelファイルを
*          置かないでください。

global RAW_XLSX ""
capture window fopen RAW_XLSX "5年度分のうち、どれか1つのExcel生データを選択してください" ///
    "Excel (*.xlsx)|*.xlsx|Excel 97-2003 (*.xls)|*.xls|All files (*.*)|*.*"

if _rc != 0 | "$RAW_XLSX" == "" {
    noi di as error "Excelファイルが選択されなかったため、処理を終了します。"
    exit 601
}

* 選択したExcelファイルのフォルダを取得
local p1 = ustrrpos("$RAW_XLSX", "/")
local p2 = ustrrpos("$RAW_XLSX", char(92))
local p  = max(`p1', `p2')

if `p' <= 1 {
    noi di as error "Excelファイルの保存場所を取得できませんでした。"
    exit 601
}

local root = usubstr("$RAW_XLSX", 1, `p' - 1)
global ROOT "`root'"
global XLSX "$ROOT/student_return.xlsx"
global LOGF "$ROOT/analysis_run.log"

* OneDrive等のクラウド同期フォルダに生データを置かない（研究計画書9・10章）
if ustrpos(lower("$ROOT"), "onedrive") > 0 {
    noi di as error "============================================================"
    noi di as error "選択したフォルダはOneDrive（クラウド同期）の中にあります："
    noi di as error "  $ROOT"
    noi di as error "生データはOneDriveの外のローカルフォルダ（例 C:\study_data）に置き、"
    noi di as error "そのフォルダ内のExcelを選び直してください。"
    noi di as error "============================================================"
    exit 601
}

noi di "選択したファイル： $RAW_XLSX"
noi di "データフォルダ　： $ROOT"


*--------------------------------------------------
* 0-2. 元データの変数名
*--------------------------------------------------
* 5年度すべてで同じ列名であることを前提とします。

local v_facility   施設コード
local v_age        入院時年齢
local v_sex        性別コード
local v_admdate    入院年月日
local v_anxiety    不安有無
local v_industry   統一最長産業コード
local v_occupation 統一最長職業コード
local v_employment 雇用形態コード現職
local v_night      夜間勤務有無
local v_insurance  保険区分
local v_smoking    喫煙習慣程度コード
local v_drinking   飲酒習慣程度コード
local v_lifestyle  生活習慣病確認
local v_dx         確定診断名コード1
local v_survey     職歴調査状況コード

* 「入院時点で就労中」を直接示す変数がある場合、その変数名を入れてください。
* まだ不明な場合は空欄のままで構いません。
local v_working ""
local working_value 1


*--------------------------------------------------
* 0-4. 対象期間（入院年月日で判定）
*--------------------------------------------------
* 研究計画書：2019年4月～2024年3月（2019～2023年度）
* ※計画書は「退院」基準。退院日基準にするかは指導教員と確認中。
local period_start "01apr2019"
local period_end   "31mar2024"
local fy_first 2019
local fy_last  2023


*--------------------------------------------------
* 0-3. 解析の段階
*--------------------------------------------------
* RUN_MI = 0：集計・完全症例解析まで実行（最初はこちら）
* RUN_MI = 1：多重代入まで実行
local RUN_MI 0


*===============================================================================
* 1. ログ開始・5年度分Excelの自動読み込みと結合
*===============================================================================

capture log close _all
capture noisily log using "$LOGF", text replace name(mainlog)
if _rc != 0 {
    noi di as error "analysis_run.log を作成できませんでした。"
    noi di as error "同名のlogファイルを開いている場合は閉じてから再実行してください。"
    exit 603
}

noi di "============================================================"
noi di "解析開始"
noi di "Stata version = " c(stata_version)
noi di "データフォルダ = $ROOT"
noi di "============================================================"

*--------------------------------------------------
* 1-1. フォルダ内のExcelファイルを数える
*--------------------------------------------------

local xlsx_files : dir "$ROOT" files "*.xlsx"
local xls_files  : dir "$ROOT" files "*.xls"
local nraw 0

foreach f of local xlsx_files {
    if lower("`f'") != "student_return.xlsx" & substr("`f'",1,2) != "~$" {
        local ++nraw
        local raw`nraw' "`f'"
    }
}
foreach f of local xls_files {
    if substr("`f'",1,2) != "~$" {
        local ++nraw
        local raw`nraw' "`f'"
    }
}

noi di "検出した元Excelファイル数 = `nraw'"

if `nraw' != 5 {
    noi di as error "============================================================"
    noi di as error "元Excelファイルが5個ではありません。"
    noi di as error "この研究では5年度分（`fy_first'～`fy_last'年度）の5ファイルを結合します。"
    noi di as error "5年度分の元Excelだけを同じフォルダに置いて、もう一度実行してください。"
    noi di as error "student_return.xlsx は自動的に除外します。"
    noi di as error "検出数 = `nraw'"
    noi di as error "============================================================"
    log close mainlog
    exit 601
}

*--------------------------------------------------
* 1-2. 必要変数を文字列として統一する補助プログラム
*      年度によってExcelの型判定が異なっても、安全にappendするためです。
*--------------------------------------------------

capture program drop make_string_copy
program define make_string_copy
    version 16.0
    syntax varname, Generate(name)

    capture confirm string variable `varlist'
    if !_rc {
        gen strL `generate' = strtrim(`varlist')
    }
    else {
        tostring `varlist', gen(`generate') force format(%30.0g)
        replace `generate' = strtrim(`generate')
    }
end

*--------------------------------------------------
* 1-2b. Excelの見出しがStata用変数名に変換された場合の補助プログラム
*
* Excel見出しに（ ）などが含まれると、import excel はStataで使える
* 別の変数名を自動生成し、元の見出しを variable label に保存することがあります。
* そのため「変数名 + variable label」の両方から目的の列を探します。
*--------------------------------------------------

capture program drop find_header_var
program define find_header_var, rclass
    version 16.0
    syntax, Include(string) [Exclude(string)]

    local first ""
    local nhit 0

    foreach vv of varlist _all {
        local vl : variable label `vv'
        local txt "`vv' `vl'"

        local ok = ustrregexm("`txt'", "`include'")
        if `ok' {
            if "`exclude'" != "" {
                if ustrregexm("`txt'", "`exclude'") local ok = 0
            }
        }

        if `ok' {
            local ++nhit
            if `nhit' == 1 local first "`vv'"
        }
    }

    return scalar n = `nhit'
    return local varname "`first'"
end

local required_raw "`v_facility' `v_age' `v_sex' `v_admdate' `v_anxiety' `v_industry' `v_occupation' `v_employment' `v_night' `v_insurance' `v_smoking' `v_drinking' `v_lifestyle' `v_dx' `v_survey'"

tempfile combined

forvalues i = 1/5 {
    local f "`raw`i''"

    noi di "------------------------------------------------------------"
    noi di "Excel `i'/5 を読み込みます：`f'"

    capture noisily import excel using "$ROOT/`f'", firstrow clear
    local import_rc = _rc

    if `import_rc' != 0 {
        noi di as error "Excel `i'/5 を読み込めませんでした。エラーコード=`import_rc'"
        noi di as error "開くためのパスワードが設定されている場合はStataから読めないことがあります。"
        noi di as error "analysis_run.log とエラー画面のスクリーンショットだけを送ってください。"
        noi di as error "元のExcel生データは絶対に送らないでください。"
        log close mainlog
        exit `import_rc'
    }

    count
    local nobs`i' = r(N)
    noi di "行数 = `nobs`i''"

    * 1つ目のファイルだけ、全列名（見出し）をlogに出す。個票値は出さない。
    if `i' == 1 {
        noi di as text "---- 全列名一覧（Excel 1/5、見出しのみ） ----"
        local jj 0
        foreach vv of varlist _all {
            local ++jj
            local vl : variable label `vv'
            noi di as text "`jj'  variable=`vv'   header=`vl'"
        }
        noi di as text "----------------------------------------------"
    }

    *--------------------------------------------------
    * Excel見出しの（ ）等によりStataの変数名が変わった列を自動解決
    *--------------------------------------------------

    * （統一）最長産業コード
    capture confirm variable `v_industry'
    if _rc {
        quietly find_header_var, include("最長産業コード") exclude("元.*最長産業コード")
        if r(n) == 1 {
            local hit "`r(varname)'"
            clonevar `v_industry' = `hit'
            noi di as text "【自動対応】産業分類列：`hit' -> `v_industry'"
        }
    }

    * （統一）最長職業コード
    capture confirm variable `v_occupation'
    if _rc {
        quietly find_header_var, include("最長職業コード") exclude("元.*最長職業コード")
        if r(n) == 1 {
            local hit "`r(varname)'"
            clonevar `v_occupation' = `hit'
            noi di as text "【自動対応】職業分類列：`hit' -> `v_occupation'"
        }
    }

    * 雇用形態コード（現職）
    capture confirm variable `v_employment'
    if _rc {
        quietly find_header_var, include("雇用形態コード.*現職|現職.*雇用形態コード")
        if r(n) == 0 quietly find_header_var, include("雇用形態コード")
        if r(n) == 1 {
            local hit "`r(varname)'"
            clonevar `v_employment' = `hit'
            noi di as text "【自動対応】雇用形態列：`hit' -> `v_employment'"
        }
    }

    * 夜間勤務（現職）
    capture confirm variable `v_night'
    if _rc {
        quietly find_header_var, include("夜間勤務.*現職|現職.*夜間勤務")
        if r(n) == 0 quietly find_header_var, include("夜間勤務")
        if r(n) == 1 {
            local hit "`r(varname)'"
            clonevar `v_night' = `hit'
            noi di as text "【自動対応】夜間勤務列：`hit' -> `v_night'"
        }
    }

    * 各年度ファイルに必要変数があるか確認
    local badvar 0
    foreach v of local required_raw {
        capture confirm variable `v'
        if _rc {
            noi di as error "【Excel `i'/5：変数が見つかりません】 `v'"
            local badvar 1
        }
    }

    if "`v_working'" != "" {
        capture confirm variable `v_working'
        if _rc {
            noi di as error "【Excel `i'/5：就労中変数が見つかりません】 `v_working'"
            local badvar 1
        }
    }

    if `badvar' == 1 {
        noi di as error "年度ファイル間で列名が異なる可能性があります。"
        noi di as text  "---- 関連しそうな列名・見出し（個票値は表示しません） ----"
        foreach vv of varlist _all {
            local vl : variable label `vv'
            local txt "`vv' `vl'"
            if ustrregexm("`txt'", "産業|職業|雇用形態|夜間勤務") {
                noi di as text "variable=`vv'   header/label=`vl'"
            }
        }
        noi di as text  "----------------------------------------------------------"
        noi di as error "analysis_run.log を送ってください。元のExcel生データは送らないでください。"
        log close mainlog
        exit 111
    }

    * 必要列だけを、年度間で型がずれないよう文字列に統一
    make_string_copy `v_facility',   generate(_facility_raw)
    make_string_copy `v_age',        generate(_age_raw)
    make_string_copy `v_sex',        generate(_sex_raw)
    make_string_copy `v_admdate',    generate(_admdate_raw)
    make_string_copy `v_anxiety',    generate(_anxiety_raw)
    make_string_copy `v_industry',   generate(_industry_raw)
    make_string_copy `v_occupation', generate(_occupation_raw)
    make_string_copy `v_employment', generate(_employment_raw)
    make_string_copy `v_night',      generate(_night_raw)
    make_string_copy `v_insurance',  generate(_insurance_raw)
    make_string_copy `v_smoking',    generate(_smoking_raw)
    make_string_copy `v_drinking',   generate(_drinking_raw)
    make_string_copy `v_lifestyle',  generate(_lifestyle_raw)
    make_string_copy `v_dx',         generate(_dx_raw)
    make_string_copy `v_survey',     generate(_survey_raw)

    if "`v_working'" != "" {
        make_string_copy `v_working', generate(_working_raw)
    }

    gen byte source_file = `i'

    if "`v_working'" == "" {
        keep _facility_raw _age_raw _sex_raw _admdate_raw _anxiety_raw ///
             _industry_raw _occupation_raw _employment_raw _night_raw ///
             _insurance_raw _smoking_raw _drinking_raw _lifestyle_raw ///
             _dx_raw _survey_raw source_file
    }
    else {
        keep _facility_raw _age_raw _sex_raw _admdate_raw _anxiety_raw ///
             _industry_raw _occupation_raw _employment_raw _night_raw ///
             _insurance_raw _smoking_raw _drinking_raw _lifestyle_raw ///
             _dx_raw _survey_raw _working_raw source_file
    }

    if `i' > 1 {
        append using "`combined'"
    }
    save "`combined'", replace
}

use "`combined'", clear
count
noi di "5年度分を結合した総行数 = " r(N)

* 元の列名に戻す
rename _facility_raw   `v_facility'
rename _age_raw        `v_age'
rename _sex_raw        `v_sex'
rename _admdate_raw    `v_admdate'
rename _anxiety_raw    `v_anxiety'
rename _industry_raw   `v_industry'
rename _occupation_raw `v_occupation'
rename _employment_raw `v_employment'
rename _night_raw      `v_night'
rename _insurance_raw  `v_insurance'
rename _smoking_raw    `v_smoking'
rename _drinking_raw   `v_drinking'
rename _lifestyle_raw  `v_lifestyle'
rename _dx_raw         `v_dx'
rename _survey_raw     `v_survey'
if "`v_working'" != "" {
    rename _working_raw `v_working'
}

* 数値として使うコードはここで数値化
capture destring `v_age', replace ignore(" ,") force
capture destring `v_anxiety', replace ignore(" ,") force
capture destring `v_night', replace ignore(" ,") force
capture destring `v_lifestyle', replace ignore(" ,") force
if "`v_working'" != "" {
    capture destring `v_working', replace ignore(" ,") force
}

* 以前の集計Excelが開かれていると上書きできないため確認
capture confirm file "$XLSX"
if _rc == 0 {
    capture erase "$XLSX"
    if _rc != 0 {
        noi di as error "student_return.xlsx を上書きできません。"
        noi di as error "Excelで student_return.xlsx を開いている場合は閉じてから再実行してください。"
        log close mainlog
        exit 603
    }
}


*===============================================================================
* 2. 必要な変数が存在するか確認
*===============================================================================

local required_vars "`v_facility' `v_age' `v_sex' `v_admdate' `v_anxiety' `v_industry' `v_occupation' `v_employment' `v_night' `v_insurance' `v_smoking' `v_drinking' `v_lifestyle' `v_dx' `v_survey'"

local badvar 0
foreach v of local required_vars {
    capture confirm variable `v'
    if _rc {
        noi di as error "【変数が見つかりません】 `v'"
        local badvar 1
    }
}

if `badvar' == 1 {
    noi di as error "上記の変数名がExcel内に見つかりませんでした。"
    noi di as error "analysis_run.log を送ってください。元のExcel生データは送らないでください。"

    * 個票を出さず、必要な変数名だけをExcelに記録
    capture putexcel set "$XLSX", sheet("VariableCheck") replace
    if _rc == 0 {
        putexcel A1 = "必要な変数が見つかりませんでした"
        putexcel A2 = "analysis_run.log とこのExcelだけを送ってください。元の生データは送らないでください。"
        putexcel A4 = "Expected variables"
        local vr 5
        foreach v of local required_vars {
            capture confirm variable `v'
            if _rc {
                putexcel A`vr' = "`v'" B`vr' = "NOT FOUND"
            }
            else {
                putexcel A`vr' = "`v'" B`vr' = "OK"
            }
            local ++vr
        }
    }

    log close mainlog
    exit 111
}


*===============================================================================
* 3. Excel出力ファイルを作る
*===============================================================================

putexcel set "$XLSX", sheet("README") replace
putexcel A1 = "入院患者病職歴調査：復職不安研究"
putexcel A2 = "Stata 16以上対応版 v5"
putexcel A4 = "このExcelには個票を出力していません。集計結果のみです。"
putexcel A5 = "元のExcel生データは絶対に送付しないでください。返送はこのExcelとanalysis_run.logだけです。"
putexcel A6 = "元データ" B6 = "年度別Excel 5ファイルを縦結合"
putexcel A7 = "対象期間（入院日）" B7 = "`period_start' ～ `period_end'"
putexcel A8 = "対象年齢" B8 = "入院時15歳以上"
putexcel A9 = "対象疾病" B9 = "新生物、筋骨格系、損傷・中毒、循環器系、消化器系"
putexcel A10 = "主要アウトカム" B10 = "復職不安"
putexcel A11 = "施設効果" B11 = "施設をランダム切片とする2レベルロジスティック回帰"
putexcel A13 = "RUN_MI" B13 = (`RUN_MI')

if "`v_working'" == "" {
    putexcel A15 = "注意" B15 = "入院時就労中を示す変数が未指定のため、就労中の適格基準はまだ適用していません。"
}
else {
    putexcel A15 = "入院時就労中変数" B15 = "`v_working'"
}


* 5年度分がすべて読み込まれたことを確認するための集計
putexcel set "$XLSX", sheet("SourceFiles") modify
putexcel A1 = "Source_file" B1 = "Imported_rows"
forvalues i = 1/5 {
    putexcel A`=`i'+1' = "File `i'" B`=`i'+1' = (`nobs`i'')
}
putexcel A8 = "Total imported rows"
quietly count
putexcel B8 = (r(N))


*===============================================================================
* 4. 対象者選定フロー
*===============================================================================

putexcel set "$XLSX", sheet("Flow") modify
putexcel A1 = "Step" B1 = "N" C1 = "説明"
local flowrow 2

count
putexcel A`flowrow' = "Original" B`flowrow' = (r(N)) C`flowrow' = "元データ"
local ++flowrow


*--------------------------------------------------
* 4-1. 入院年月日を Stata date に変換
*      5年度のExcelで日付の保存形式が多少違っても対応できるようにします。
*--------------------------------------------------

gen double admission_date = .
gen str40 _adm_text = strtrim(`v_admdate')
replace _adm_text = subinstr(_adm_text, char(9), "", .)
gen double _adm_num = real(subinstr(_adm_text, ",", "", .))

* YYYYMMDD（例 20210401）
replace admission_date = daily(string(_adm_num, "%12.0f"), "YMD") ///
    if missing(admission_date) & _adm_num >= 19000101 & _adm_num <= 21001231

* Excelの日付シリアル値（2020年前後は約43,000～46,000）
replace admission_date = _adm_num - 21916 ///
    if missing(admission_date) & inrange(_adm_num, 30000, 80000)

* すでにStataの日付値で保存されている場合
replace admission_date = _adm_num ///
    if missing(admission_date) & inrange(_adm_num, 15000, 29999)

* 文字列日付 2021/04/01, 2021-04-01 など
replace admission_date = daily(_adm_text, "YMD") if missing(admission_date)
replace admission_date = daily(_adm_text, "DMY") if missing(admission_date)
replace admission_date = daily(_adm_text, "MDY") if missing(admission_date)

format admission_date %tdCCYY/NN/DD

quietly count if missing(admission_date)
noi di "入院年月日を日付に変換できなかった行数 = " r(N)

keep if inrange(admission_date, td(`period_start'), td(`period_end'))
count
putexcel A`flowrow' = "Period" B`flowrow' = (r(N)) C`flowrow' = "`period_start'～`period_end'（入院日）"
local ++flowrow

* 年度別件数（4月～翌3月を1年度とする）
gen int fiscal_year = year(admission_date) - (month(admission_date) <= 3)

putexcel set "$XLSX", sheet("YearCount") modify
putexcel A1 = "年度" B1 = "N"
local yrrow 2
forvalues yy = `fy_first'/`fy_last' {
    quietly count if fiscal_year == `yy'
    putexcel A`yrrow' = (`yy') B`yrrow' = (r(N))
    local ++yrrow
}


*--------------------------------------------------
* 4-2. 15歳以上
*--------------------------------------------------

keep if `v_age' >= 15 & `v_age' < .
count
putexcel A`flowrow' = "Age>=15" B`flowrow' = (r(N)) C`flowrow' = "入院時15歳以上"
local ++flowrow


*===============================================================================
* 5. 分析用変数を作る
*===============================================================================

*--------------------------------------------------
* 5-1. 復職不安：1=あり、0=なし
*       元データ：1=有、2=無、3=不明 を想定
*--------------------------------------------------

gen byte return_anxiety = .
replace return_anxiety = 1 if `v_anxiety' == 1
replace return_anxiety = 0 if `v_anxiety' == 2
label define anxiety_lbl 0 "不安なし" 1 "不安あり", replace
label values return_anxiety anxiety_lbl
label variable return_anxiety "復職不安"


*--------------------------------------------------
* 5-2. 性別：男性=1、女性=0
*       元データ：M/F を想定
*--------------------------------------------------

gen byte male = .

capture confirm string variable `v_sex'
if !_rc {
    replace male = 1 if upper(strtrim(`v_sex')) == "M"
    replace male = 0 if upper(strtrim(`v_sex')) == "F"
}
else {
    noi di as error "【確認】性別コードが数値です。male の作成ルールを確認してください。"
}

label define male_lbl 0 "女性" 1 "男性", replace
label values male male_lbl
label variable male "男性"


*--------------------------------------------------
* 5-3. 年齢
*--------------------------------------------------

gen double age = `v_age'
label variable age "入院時年齢"


*--------------------------------------------------
* 5-4. カテゴリ変数を分析用の数値変数にそろえる
*       元変数が数値ならコピー、文字列なら encode
*--------------------------------------------------

capture program drop make_category
program define make_category
    version 16.0
    syntax varname, Generate(name)

    capture confirm numeric variable `varlist'
    if !_rc {
        clonevar `generate' = `varlist'
    }
    else {
        encode `varlist', gen(`generate')
    }
end

make_category `v_industry',   generate(industry)
make_category `v_occupation', generate(occupation)
make_category `v_employment', generate(employment)
make_category `v_insurance',  generate(insurance)
make_category `v_smoking',    generate(smoking)
make_category `v_drinking',   generate(drinking)

label variable industry   "産業分類"
label variable occupation "職業分類"
label variable employment "雇用形態"
label variable insurance  "保険区分"
label variable smoking    "喫煙歴"
label variable drinking   "飲酒歴"


*--------------------------------------------------
* 5-5. 夜勤：1=有、0=無、3=不明は欠測
*--------------------------------------------------

gen byte night_work = .
replace night_work = 1 if `v_night' == 1
replace night_work = 0 if `v_night' == 2
label define night_lbl 0 "夜勤なし" 1 "夜勤あり", replace
label values night_work night_lbl
label variable night_work "夜勤"


*--------------------------------------------------
* 5-6. 生活習慣病：1=有、0=無、3=不明は欠測
*--------------------------------------------------

gen byte lifestyle = .
replace lifestyle = 1 if `v_lifestyle' == 1
replace lifestyle = 0 if `v_lifestyle' == 2
label define lifestyle_lbl 0 "なし" 1 "あり", replace
label values lifestyle lifestyle_lbl
label variable lifestyle "生活習慣病"


*--------------------------------------------------
* 5-7. 施設コード
*--------------------------------------------------

capture confirm numeric variable `v_facility'
if !_rc {
    clonevar facility = `v_facility'
}
else {
    encode `v_facility', gen(facility)
}
label variable facility "入院施設"


*--------------------------------------------------
* 5-8. ICD-10から5疾病群を作る
*
* 重要：ここでは「確定診断名コード1」を代表診断として使用しています。
*       主病名が別変数の場合は、0-2 の v_dx を変更してください。
*
* 1 新生物           C00-D48
* 2 筋骨格系         M00-M99
* 3 損傷・中毒       S00-T98
* 4 循環器系         I00-I99
* 5 消化器系         K00-K93
*--------------------------------------------------

gen str20 dx_clean = ""

capture confirm string variable `v_dx'
if !_rc {
    replace dx_clean = upper(strtrim(`v_dx'))
}
else {
    tostring `v_dx', gen(_dx_string) force format(%20.0g)
    replace dx_clean = upper(strtrim(_dx_string))
    drop _dx_string
}

replace dx_clean = subinstr(dx_clean, ".", "", .)
replace dx_clean = subinstr(dx_clean, " ", "", .)

gen str1 dx_letter = substr(dx_clean, 1, 1)
gen int  dx_num2   = real(substr(dx_clean, 2, 2))

gen byte disease = .
replace disease = 1 if dx_letter == "C" | (dx_letter == "D" & inrange(dx_num2, 0, 48))
replace disease = 2 if dx_letter == "M" & inrange(dx_num2, 0, 99)
replace disease = 3 if dx_letter == "S" & inrange(dx_num2, 0, 99)
replace disease = 3 if dx_letter == "T" & inrange(dx_num2, 0, 98)
replace disease = 4 if dx_letter == "I" & inrange(dx_num2, 0, 99)
replace disease = 5 if dx_letter == "K" & inrange(dx_num2, 0, 93)

label define disease_lbl ///
    1 "新生物" ///
    2 "筋骨格系" ///
    3 "損傷・中毒" ///
    4 "循環器系" ///
    5 "消化器系", replace
label values disease disease_lbl
label variable disease "疾病群"

keep if inrange(disease, 1, 5)
count
putexcel A`flowrow' = "Five diseases" B`flowrow' = (r(N)) C`flowrow' = "対象5疾病"
local ++flowrow


*--------------------------------------------------
* 5-9. 入院時就労中
*--------------------------------------------------

if "`v_working'" != "" {
    capture confirm variable `v_working'
    if _rc {
        noi di as error "【確認】v_working に指定した変数が見つかりません。"
    }
    else {
        keep if `v_working' == `working_value'
        count
        putexcel A`flowrow' = "Working" B`flowrow' = (r(N)) C`flowrow' = "入院時就労中"
        local ++flowrow
    }
}
else {
    count
    putexcel A`flowrow' = "Working" B`flowrow' = (r(N)) C`flowrow' = "未適用：就労中変数を確認する必要あり"
    local ++flowrow
}


*--------------------------------------------------
* 5-10. 病職歴調査を確認できる症例
*       ここでは職歴調査状況コードが欠測でないことを暫定条件とします。
*--------------------------------------------------

keep if !missing(`v_survey')
count
putexcel A`flowrow' = "Survey available" B`flowrow' = (r(N)) C`flowrow' = "職歴調査状況コードが非欠測"
local ++flowrow


*===============================================================================
* 6. 変数作成が正しいか確認
*===============================================================================

noi di "============================================================"
noi di "変数作成後の確認"
noi di "============================================================"

noi tabulate return_anxiety, missing
noi tabulate male, missing
noi tabulate disease, missing
noi tabulate night_work, missing
noi tabulate lifestyle, missing
noi tabulate employment, missing
noi tabulate insurance, missing
noi tabulate smoking, missing
noi tabulate drinking, missing


*===============================================================================
* 7. 欠測状況をExcelに出力
*===============================================================================

putexcel set "$XLSX", sheet("Missing") modify
putexcel A1 = "Variable" B1 = "N_total" C1 = "N_missing" D1 = "Missing_%"

local missvars "return_anxiety age male industry occupation employment night_work insurance smoking drinking lifestyle disease facility"
local missrow 2

foreach v of local missvars {
    quietly count
    local ntotal = r(N)
    quietly count if missing(`v')
    local nmiss = r(N)
    local pmiss = 100 * `nmiss' / `ntotal'

    putexcel A`missrow' = "`v'" ///
             B`missrow' = (`ntotal') ///
             C`missrow' = (`nmiss') ///
             D`missrow' = (`pmiss')

    local ++missrow
}


*--------------------------------------------------
* 7-2. 完全症例フラグ
*       感度分析では、解析に用いる全変数に欠測のない症例を使用します。
*--------------------------------------------------

egen nmiss_analysis = rowmiss(return_anxiety age male industry occupation ///
    employment night_work insurance smoking drinking lifestyle facility)
gen byte complete_case = (nmiss_analysis == 0)
label define cc_lbl 0 "欠測あり" 1 "完全症例", replace
label values complete_case cc_lbl
label variable complete_case "全解析変数が完全"

quietly count
local n_all = r(N)
quietly count if complete_case == 1
local n_cc = r(N)
local p_cc = 100 * `n_cc' / `n_all'

putexcel set "$XLSX", sheet("Missing") modify
putexcel F1 = "Complete-case summary" G1 = "Value"
putexcel F2 = "全対象者数" G2 = (`n_all')
putexcel F3 = "完全症例数" G3 = (`n_cc')
putexcel F4 = "完全症例割合(%)" G4 = (`p_cc')


*===============================================================================
* 8. 記述統計をExcelに出力
*===============================================================================

*--------------------------------------------------
* 8-0. コード・カテゴリー確認用
*--------------------------------------------------
* 目的：雇用形態、保険区分、喫煙、飲酒などがどのコードになっているかを
*       学生と指導者が確認するための一覧です。
*--------------------------------------------------

putexcel set "$XLSX", sheet("Coding") modify
putexcel A1 = "Variable" B1 = "Category_value" C1 = "Category_label" ///
         D1 = "N" E1 = "Percent"
local coderow 2

local codevars "employment insurance smoking drinking night_work lifestyle disease"
foreach v of local codevars {
    local varlabel : variable label `v'
    quietly count if !missing(`v')
    local denom = r(N)

    capture levelsof `v' if !missing(`v'), local(levels)
    if _rc == 0 {
        foreach k of local levels {
            quietly count if `v' == `k'
            local nn = r(N)
            local pp = 100 * `nn' / `denom'

            local vallab : value label `v'
            local catlab "`k'"
            if "`vallab'" != "" {
                local tmp : label `vallab' `k'
                if "`tmp'" != "" local catlab "`tmp'"
            }

            putexcel A`coderow' = "`varlabel'" ///
                     B`coderow' = (`k') ///
                     C`coderow' = "`catlab'" ///
                     D`coderow' = (`nn') ///
                     E`coderow' = (`pp')
            local ++coderow
        }
    }
}


*--------------------------------------------------
* 8-0b. 施設数・施設あたり症例数
*       施設コード自体はExcelに出しません。
*--------------------------------------------------

egen byte _facility_tag = tag(facility)
bysort facility: gen long _facility_n = _N

quietly count if _facility_tag == 1
local n_facilities = r(N)
quietly summarize _facility_n if _facility_tag == 1, detail
local fac_min = r(min)
local fac_p50 = r(p50)
local fac_max = r(max)

putexcel set "$XLSX", sheet("Cluster") modify
putexcel A1 = "項目" B1 = "値"
putexcel A2 = "施設数" B2 = (`n_facilities')
putexcel A3 = "施設あたり症例数：最小" B3 = (`fac_min')
putexcel A4 = "施設あたり症例数：中央値" B4 = (`fac_p50')
putexcel A5 = "施設あたり症例数：最大" B5 = (`fac_max')

drop _facility_tag _facility_n


*--------------------------------------------------
* 8-1. Table 1：復職不安の有無別
*--------------------------------------------------

putexcel set "$XLSX", sheet("Table1") modify
putexcel A1 = "Variable" B1 = "Level" ///
         C1 = "Overall_N" D1 = "Overall_%" ///
         E1 = "No_anxiety_N" F1 = "No_anxiety_%" ///
         G1 = "Anxiety_N" H1 = "Anxiety_%"

local trow 2

* 年齢は平均・標準偏差を別形式で出力
quietly summarize age if !missing(return_anxiety)
local age_all_mean = r(mean)
local age_all_sd   = r(sd)
local age_all_n    = r(N)
quietly summarize age if return_anxiety == 0
local age0_mean = r(mean)
local age0_sd   = r(sd)
local age0_n    = r(N)
quietly summarize age if return_anxiety == 1
local age1_mean = r(mean)
local age1_sd   = r(sd)
local age1_n    = r(N)

putexcel A`trow' = "入院時年齢" B`trow' = "Mean" ///
         C`trow' = (`age_all_mean') D`trow' = (`age_all_sd') ///
         E`trow' = (`age0_mean') F`trow' = (`age0_sd') ///
         G`trow' = (`age1_mean') H`trow' = (`age1_sd')
local ++trow
putexcel A`trow' = "入院時年齢" B`trow' = "N" ///
         C`trow' = (`age_all_n') E`trow' = (`age0_n') G`trow' = (`age1_n')
local ++trow

* カテゴリ変数
local table1vars "male disease employment night_work insurance smoking drinking lifestyle"
foreach v of local table1vars {
    local varlabel : variable label `v'

    quietly count if !missing(`v') & !missing(return_anxiety)
    local denomall = r(N)
    quietly count if return_anxiety == 0 & !missing(`v')
    local denom0 = r(N)
    quietly count if return_anxiety == 1 & !missing(`v')
    local denom1 = r(N)

    capture levelsof `v' if !missing(`v'), local(levels)
    if _rc == 0 {
        foreach k of local levels {
            quietly count if `v' == `k' & !missing(return_anxiety)
            local nall = r(N)
            local pall = 100 * `nall' / `denomall'
            quietly count if `v' == `k' & return_anxiety == 0
            local n0 = r(N)
            local p0 = 100 * `n0' / `denom0'
            quietly count if `v' == `k' & return_anxiety == 1
            local n1 = r(N)
            local p1 = 100 * `n1' / `denom1'

            local vallab : value label `v'
            local catlab "`k'"
            if "`vallab'" != "" {
                local tmp : label `vallab' `k'
                if "`tmp'" != "" local catlab "`tmp'"
            }

            putexcel A`trow' = "`varlabel'" B`trow' = "`catlab'" ///
                     C`trow' = (`nall') D`trow' = (`pall') ///
                     E`trow' = (`n0') F`trow' = (`p0') ///
                     G`trow' = (`n1') H`trow' = (`p1')
            local ++trow
        }
    }
}


*--------------------------------------------------
* 8-2. 産業分類：復職不安の有無別
*--------------------------------------------------

putexcel set "$XLSX", sheet("Industry") modify
putexcel A1 = "Industry_value" B1 = "Industry_label" ///
         C1 = "Overall_N" D1 = "Overall_%" ///
         E1 = "No_anxiety_N" F1 = "No_anxiety_%" ///
         G1 = "Anxiety_N" H1 = "Anxiety_%"
local row 2

quietly count if !missing(industry) & !missing(return_anxiety)
local denomall = r(N)
quietly count if return_anxiety == 0 & !missing(industry)
local denom0 = r(N)
quietly count if return_anxiety == 1 & !missing(industry)
local denom1 = r(N)

capture levelsof industry if !missing(industry), local(levels)
if _rc == 0 {
    foreach k of local levels {
        quietly count if industry == `k' & !missing(return_anxiety)
        local nall = r(N)
        local pall = 100 * `nall' / `denomall'
        quietly count if industry == `k' & return_anxiety == 0
        local n0 = r(N)
        local p0 = 100 * `n0' / `denom0'
        quietly count if industry == `k' & return_anxiety == 1
        local n1 = r(N)
        local p1 = 100 * `n1' / `denom1'

        local vallab : value label industry
        local catlab "`k'"
        if "`vallab'" != "" {
            local tmp : label `vallab' `k'
            if "`tmp'" != "" local catlab "`tmp'"
        }

        putexcel A`row' = (`k') B`row' = "`catlab'" ///
                 C`row' = (`nall') D`row' = (`pall') ///
                 E`row' = (`n0') F`row' = (`p0') ///
                 G`row' = (`n1') H`row' = (`p1')
        local ++row
    }
}


*--------------------------------------------------
* 8-3. 職業分類：復職不安の有無別
*--------------------------------------------------

putexcel set "$XLSX", sheet("Occupation") modify
putexcel A1 = "Occupation_value" B1 = "Occupation_label" ///
         C1 = "Overall_N" D1 = "Overall_%" ///
         E1 = "No_anxiety_N" F1 = "No_anxiety_%" ///
         G1 = "Anxiety_N" H1 = "Anxiety_%"
local row 2

quietly count if !missing(occupation) & !missing(return_anxiety)
local denomall = r(N)
quietly count if return_anxiety == 0 & !missing(occupation)
local denom0 = r(N)
quietly count if return_anxiety == 1 & !missing(occupation)
local denom1 = r(N)

capture levelsof occupation if !missing(occupation), local(levels)
if _rc == 0 {
    foreach k of local levels {
        quietly count if occupation == `k' & !missing(return_anxiety)
        local nall = r(N)
        local pall = 100 * `nall' / `denomall'
        quietly count if occupation == `k' & return_anxiety == 0
        local n0 = r(N)
        local p0 = 100 * `n0' / `denom0'
        quietly count if occupation == `k' & return_anxiety == 1
        local n1 = r(N)
        local p1 = 100 * `n1' / `denom1'

        local vallab : value label occupation
        local catlab "`k'"
        if "`vallab'" != "" {
            local tmp : label `vallab' `k'
            if "`tmp'" != "" local catlab "`tmp'"
        }

        putexcel A`row' = (`k') B`row' = "`catlab'" ///
                 C`row' = (`nall') D`row' = (`pall') ///
                 E`row' = (`n0') F`row' = (`p0') ///
                 G`row' = (`n1') H`row' = (`p1')
        local ++row
    }
}


*--------------------------------------------------
* 8-4. 疾病別の復職不安
*--------------------------------------------------

putexcel set "$XLSX", sheet("Disease") modify
putexcel A1 = "Disease" B1 = "N_total_with_outcome" ///
         C1 = "No_anxiety_N" D1 = "No_anxiety_%" ///
         E1 = "Anxiety_N" F1 = "Anxiety_%"
local row 2

forvalues d = 1/5 {
    quietly count if disease == `d' & !missing(return_anxiety)
    local den = r(N)
    quietly count if disease == `d' & return_anxiety == 0
    local n0 = r(N)
    local p0 = 100 * `n0' / `den'
    quietly count if disease == `d' & return_anxiety == 1
    local n1 = r(N)
    local p1 = 100 * `n1' / `den'

    local dlab : label disease_lbl `d'
    putexcel A`row' = "`dlab'" B`row' = (`den') ///
             C`row' = (`n0') D`row' = (`p0') ///
             E`row' = (`n1') F`row' = (`p1')
    local ++row
}


*===============================================================================
* 9. 回帰結果をExcelに書くための補助プログラム
*===============================================================================
* Stata 16には etable がないため、e(b) と e(V) から
* OR、95%CI、p値を計算して putexcel で書き出します。
* ランダム効果の分散パラメータは除外し、固定効果のみ出力します。
*===============================================================================

capture program drop export_current_model
program define export_current_model, rclass
    version 16.0
    syntax, Sheet(string) Startrow(integer) Disease(string) Model(string)

    tempname B V
    matrix `B' = e(b)
    matrix `V' = e(V)

    local cnames : colnames `B'
    local eqnames : coleq `B'
    local k = colsof(`B')
    local dep "`e(depvar)'"

    putexcel set "$XLSX", sheet("`sheet'") modify

    local row = `startrow'
    putexcel A`row' = "Disease" B`row' = "Model" C`row' = "Parameter" ///
             D`row' = "OR" E`row' = "95%CI_low" F`row' = "95%CI_high" ///
             G`row' = "p_value"
    local ++row

    forvalues j = 1/`k' {
        local cname : word `j' of `cnames'
        local eqname : word `j' of `eqnames'

        * melogitのランダム効果パラメータを除外
        local fixed 0
        if "`eqname'" == "`dep'" local fixed 1
        if "`eqname'" == "" local fixed 1
        if substr("`eqname'",1,3) == "lns" local fixed 0
        if substr("`eqname'",1,3) == "lnv" local fixed 0
        if substr("`eqname'",1,2) == "ln" & "`eqname'" != "`dep'" local fixed 0

        if `fixed' == 1 & "`cname'" != "_cons" {
            local beta = `B'[1,`j']
            local se   = sqrt(`V'[`j',`j'])
            local z    = `beta' / `se'
            local p    = 2 * normal(-abs(`z'))
            local or   = exp(`beta')
            local ll   = exp(`beta' - invnormal(.975)*`se')
            local ul   = exp(`beta' + invnormal(.975)*`se')

            putexcel A`row' = "`disease'" ///
                     B`row' = "`model'" ///
                     C`row' = "`cname'" ///
                     D`row' = (`or') ///
                     E`row' = (`ll') ///
                     F`row' = (`ul') ///
                     G`row' = (`p')
            local ++row
        }
    }

    * 解析対象数も最後に記録
    capture local NN = e(N)
    if _rc == 0 {
        putexcel A`row' = "`disease'" B`row' = "`model'" C`row' = "N" D`row' = (`NN')
        local ++row
    }

    local ++row
    return scalar nextrow = `row'
end


*===============================================================================
* 10. 完全症例によるマルチレベルロジスティック回帰
*     研究計画上の感度分析
*
* レベル1：患者
* レベル2：入院施設（ランダム切片）
* 疾病ごとに解析します。
*===============================================================================

* 調整変数
local adjust "i.employment i.night_work i.insurance c.age i.male i.smoking i.drinking i.lifestyle"


*--------------------------------------------------
* 10-1. 産業分類 + 調整変数
*--------------------------------------------------

putexcel set "$XLSX", sheet("CC_Industry") modify
putexcel A1 = "完全症例解析：産業分類と復職不安"
local regrow 3

forvalues d = 1/5 {
    local dlab : label disease_lbl `d'

    capture noisily melogit return_anxiety i.industry `adjust' ///
        if disease == `d' & complete_case == 1 || facility:, nolog

    if _rc == 0 {
        export_current_model, sheet("CC_Industry") startrow(`regrow') ///
            disease("`dlab'") model("産業分類+調整変数")
        local regrow = r(nextrow)
    }
    else {
        noi di as error "産業分類モデル：`dlab' は推定できませんでした。"
        putexcel set "$XLSX", sheet("CC_Industry") modify
        putexcel A`regrow' = "`dlab'" B`regrow' = "推定エラー" C`regrow' = (_rc)
        local regrow = `regrow' + 2
    }
}


*--------------------------------------------------
* 10-2. 職業分類 + 調整変数
*--------------------------------------------------

putexcel set "$XLSX", sheet("CC_Occupation") modify
putexcel A1 = "完全症例解析：職業分類と復職不安"
local regrow 3

forvalues d = 1/5 {
    local dlab : label disease_lbl `d'

    capture noisily melogit return_anxiety i.occupation `adjust' ///
        if disease == `d' & complete_case == 1 || facility:, nolog

    if _rc == 0 {
        export_current_model, sheet("CC_Occupation") startrow(`regrow') ///
            disease("`dlab'") model("職業分類+調整変数")
        local regrow = r(nextrow)
    }
    else {
        noi di as error "職業分類モデル：`dlab' は推定できませんでした。"
        putexcel set "$XLSX", sheet("CC_Occupation") modify
        putexcel A`regrow' = "`dlab'" B`regrow' = "推定エラー" C`regrow' = (_rc)
        local regrow = `regrow' + 2
    }
}


*--------------------------------------------------
* 10-3. 産業分類 + 職業分類 + 調整変数
*       研究計画の独立変数を同時に投入したモデル
*--------------------------------------------------

putexcel set "$XLSX", sheet("CC_Both") modify
putexcel A1 = "完全症例解析：産業分類+職業分類と復職不安"
local regrow 3

forvalues d = 1/5 {
    local dlab : label disease_lbl `d'

    capture noisily melogit return_anxiety i.industry i.occupation `adjust' ///
        if disease == `d' & complete_case == 1 || facility:, nolog

    if _rc == 0 {
        export_current_model, sheet("CC_Both") startrow(`regrow') ///
            disease("`dlab'") model("産業分類+職業分類+調整変数")
        local regrow = r(nextrow)
    }
    else {
        noi di as error "産業+職業モデル：`dlab' は推定できませんでした。"
        putexcel set "$XLSX", sheet("CC_Both") modify
        putexcel A`regrow' = "`dlab'" B`regrow' = "推定エラー" C`regrow' = (_rc)
        local regrow = `regrow' + 2
    }
}


*===============================================================================
* 11. 多重代入（研究計画上の主解析）
*
* 研究計画：
*   ・欠測値に多重代入法
*   ・従属変数、独立変数、調整変数を含む代入モデル
*   ・20回以上の代入
*   ・施設をレベル2とするマルチレベルロジスティック回帰
*
* 最初の実行では RUN_MI=0 とし、Missing / Coding シートを確認してください。
* 産業・職業分類のカテゴリー数や欠測状況によっては、
* mlogitによる代入が不安定になるため、結果を見て調整します。
*===============================================================================

if `RUN_MI' == 1 {

    noi di "============================================================"
    noi di "多重代入を開始します"
    noi di "============================================================"

    mi set mlong

    * 疾病群と施設は欠測させない前提
    mi register regular disease facility admission_date complete_case nmiss_analysis

    * 欠測がある可能性のある分析変数
    mi register imputed return_anxiety age male industry occupation ///
        employment night_work insurance smoking drinking lifestyle

    *--------------------------------------------------------------
    * chained equations による20回の多重代入
    * binary      : logit
    * nominal     : mlogit
    * continuous  : regress
    *--------------------------------------------------------------

    capture noisily mi impute chained ///
        (logit)  return_anxiety male night_work lifestyle ///
        (mlogit) industry occupation employment insurance smoking drinking ///
        (regress) age ///
        = i.disease, ///
        add(20) rseed(1234) burnin(10) dots

    if _rc != 0 {
        noi di as error "============================================================"
        noi di as error "多重代入でエラーが出ました。"
        noi di as error "analysis_run.log と student_return.xlsx を返してください。"
        noi di as error "産業・職業分類のカテゴリー数やperfect predictionを確認します。"
        noi di as error "============================================================"
    }
    else {

        noi mi describe
        noi mi misstable summarize

        *----------------------------------------------------------
        * 11-1. MI：産業分類モデル
        *----------------------------------------------------------

        putexcel set "$XLSX", sheet("MI_Industry") modify
        putexcel A1 = "多重代入：産業分類と復職不安"
        local regrow 3

        forvalues d = 1/5 {
            local dlab : label disease_lbl `d'

            capture noisily mi estimate, post: ///
                melogit return_anxiety i.industry `adjust' ///
                if disease == `d' || facility:, nolog

            if _rc == 0 {
                export_current_model, sheet("MI_Industry") startrow(`regrow') ///
                    disease("`dlab'") model("産業分類+調整変数")
                local regrow = r(nextrow)
            }
            else {
                noi di as error "MI産業分類モデル：`dlab' は推定できませんでした。"
                putexcel set "$XLSX", sheet("MI_Industry") modify
                putexcel A`regrow' = "`dlab'" B`regrow' = "推定エラー" C`regrow' = (_rc)
                local regrow = `regrow' + 2
            }
        }

        *----------------------------------------------------------
        * 11-2. MI：職業分類モデル
        *----------------------------------------------------------

        putexcel set "$XLSX", sheet("MI_Occupation") modify
        putexcel A1 = "多重代入：職業分類と復職不安"
        local regrow 3

        forvalues d = 1/5 {
            local dlab : label disease_lbl `d'

            capture noisily mi estimate, post: ///
                melogit return_anxiety i.occupation `adjust' ///
                if disease == `d' || facility:, nolog

            if _rc == 0 {
                export_current_model, sheet("MI_Occupation") startrow(`regrow') ///
                    disease("`dlab'") model("職業分類+調整変数")
                local regrow = r(nextrow)
            }
            else {
                noi di as error "MI職業分類モデル：`dlab' は推定できませんでした。"
                putexcel set "$XLSX", sheet("MI_Occupation") modify
                putexcel A`regrow' = "`dlab'" B`regrow' = "推定エラー" C`regrow' = (_rc)
                local regrow = `regrow' + 2
            }
        }

        *----------------------------------------------------------
        * 11-3. MI：産業分類 + 職業分類モデル
        *----------------------------------------------------------

        putexcel set "$XLSX", sheet("MI_Both") modify
        putexcel A1 = "多重代入：産業分類+職業分類と復職不安"
        local regrow 3

        forvalues d = 1/5 {
            local dlab : label disease_lbl `d'

            capture noisily mi estimate, post: ///
                melogit return_anxiety i.industry i.occupation `adjust' ///
                if disease == `d' || facility:, nolog

            if _rc == 0 {
                export_current_model, sheet("MI_Both") startrow(`regrow') ///
                    disease("`dlab'") model("産業分類+職業分類+調整変数")
                local regrow = r(nextrow)
            }
            else {
                noi di as error "MI産業+職業モデル：`dlab' は推定できませんでした。"
                putexcel set "$XLSX", sheet("MI_Both") modify
                putexcel A`regrow' = "`dlab'" B`regrow' = "推定エラー" C`regrow' = (_rc)
                local regrow = `regrow' + 2
            }
        }
    }
}


*===============================================================================
* 12. 個票データは保存しない
*===============================================================================
* 情報管理上の安全性を高めるため、analysis_data.dta 等の個票ファイルは
* このdo-fileでは作成しません。
* 外部へ返送するのは student_return.xlsx と analysis_run.log の2つだけです。


*===============================================================================
* 13. 終了メッセージ
*===============================================================================

noi di ""
noi di "============================================================"
noi di as result "解析が終了しました。"
noi di as result "学生から返してもらうファイルは次の2つです。"
noi di as result "  1) $XLSX"
noi di as result "  2) $LOGF"
noi di as error  "元のExcel生データは絶対に送らないでください。"
noi di "============================================================"

log close mainlog

********************************************************************************
* 終了
********************************************************************************
