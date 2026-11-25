* ========================================================================
* Sawada: 統一コードの特殊コード（末尾0・末尾X）と「元」コードの対応確認
*
* 目的：統一産業分類・統一職業分類（現職）のうち、機構のコード表に
*       載っていないコード（産業：010,030,…,200,220,20X,21X／
*       職業：01X～11X）が、元の日本標準産業分類・日本標準職業分類で
*       どのコード・名称になっているかを集計する。
* 出力：分類コード・分類名称・件数のみ（個人ID・施設コード・個票は出力しない）
* 対象：5ファイルの全レコード（対象者の絞り込みはしない）
* ========================================================================
version 18.0
capture log close _all
clear all
set more off
set linesize 200

cd "C:/Users/sawad/OneDrive/デスクトップ/新しいフォルダー"
capture mkdir "sawada_code_crosswalk_results"
log using "sawada_code_crosswalk_results/special_code_crosswalk.log", text replace name(cw)

local keepvars "産業分類コード現職 元産業分類コード現職 元産業分類現職現職 職業分類コード現職 元職業分類コード現職 元職業分類現職"
tempfile combined
forvalues yy = 2019/2023 {
    noi di "--- `yy'.xlsx ---"
    import excel using "`yy'.xlsx", firstrow clear
    keep `keepvars'
    foreach v of local keepvars {
        capture confirm numeric variable `v'
        if !_rc quietly tostring `v', replace force format(%30.0g)
        quietly replace `v' = strtrim(`v')
    }
    gen int file_year = `yy'
    if `yy' > 2019 append using "`combined'"
    quietly save "`combined'", replace
}
use "`combined'", clear

* 機構のコード表（p.146～147）に載っていない統一コードに印を付ける
gen double _i = real(産業分類コード現職)
gen byte ind_special = 産業分類コード現職 != "" & ( ///
    strpos(産業分類コード現職, "X") > 0 | ///
    inlist(_i, 10, 30, 40, 50, 60, 70, 80, 90, 100) | ///
    inlist(_i, 110, 120, 130, 140, 150, 160, 170, 180, 190) | ///
    inlist(_i, 200, 220) )
gen byte occ_special = strpos(職業分類コード現職, "X") > 0

* ---- 産業：特殊コード × 元コード・元名称 ----
noi di "================================================================"
noi di "産業：特殊な統一コード × 元産業分類コード・名称（件数の多い順）"
noi di "================================================================"
preserve
    keep if ind_special
    contract 産業分類コード現職 元産業分類コード現職 元産業分類現職現職, freq(n)
    gsort 産業分類コード現職 -n
    by 産業分類コード現職: gen _rank = _n
    noi list 産業分類コード現職 元産業分類コード現職 元産業分類現職現職 n if _rank <= 8, ///
        noobs sepby(産業分類コード現職) abbreviate(20)
    export excel using "sawada_code_crosswalk_results/special_code_crosswalk.xlsx", ///
        sheet("Industry") firstrow(variables) replace
restore

* ---- 職業：特殊コード × 元コード・元名称 ----
noi di "================================================================"
noi di "職業：特殊な統一コード（末尾X）× 元職業分類コード・名称（件数の多い順）"
noi di "================================================================"
preserve
    keep if occ_special
    contract 職業分類コード現職 元職業分類コード現職 元職業分類現職, freq(n)
    gsort 職業分類コード現職 -n
    by 職業分類コード現職: gen _rank = _n
    noi list 職業分類コード現職 元職業分類コード現職 元職業分類現職 n if _rank <= 8, ///
        noobs sepby(職業分類コード現職) abbreviate(20)
    export excel using "sawada_code_crosswalk_results/special_code_crosswalk.xlsx", ///
        sheet("Occupation") firstrow(variables) sheetreplace
restore

noi di "確認終了。special_code_crosswalk.log と special_code_crosswalk.xlsx を共有してください。"
log close cw
