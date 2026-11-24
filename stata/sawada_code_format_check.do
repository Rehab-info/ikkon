* ========================================================================
* Sawada: 産業・職業コードの形式確認（v6 の STOP 原因の調査）
* 3桁の数字になっていないコードについて、年度別に
*   - 文字数（バイト数・文字数）
*   - 実際のコード値と件数（コード値は分類コードであり個人情報ではない）
* を集計してログに出す。個人ID・施設コード・個票は出力しない。
* ========================================================================
version 18.0
capture log close _all
clear all
set more off
set linesize 180

cd "C:/Users/sawad/OneDrive/デスクトップ/新しいフォルダー"
log using "code_format_check.log", text replace name(fmt)

tempfile combined
forvalues yy = 2019/2023 {
    noi di "--- `yy'.xlsx ---"
    import excel using "`yy'.xlsx", firstrow clear
    noi di "産業分類コード現職 の型:"
    noi describe 産業分類コード現職 職業分類コード現職
    keep 産業分類コード現職 職業分類コード現職
    foreach v in 産業分類コード現職 職業分類コード現職 {
        capture confirm numeric variable `v'
        if !_rc {
            noi di "  `v' は数値型で読み込まれています（先頭の0が消える可能性）"
            quietly tostring `v', replace force format(%30.0g)
        }
        quietly replace `v' = strtrim(`v')
    }
    gen int file_year = `yy'
    if `yy' > 2019 append using "`combined'"
    quietly save "`combined'", replace
}
use "`combined'", clear

foreach v in 産業分類コード現職 職業分類コード現職 {
    noi di "============================================================"
    noi di "`v'"
    noi di "============================================================"
    gen byte _ok = regexm(`v', "^[0-9][0-9][0-9]$")
    gen byte _blank = (`v' == "")
    gen int _bytes = strlen(`v')
    gen int _chars = ustrlen(`v')
    noi di "年度別：3桁の数字でない件数（空欄を除く）"
    noi tab file_year _ok if !_blank, missing
    noi di "3桁の数字でないコードの文字数（バイト数 × 文字数）"
    noi tab _bytes _chars if !_ok & !_blank, missing
    noi di "3桁の数字でないコードの値と件数（上位）"
    preserve
        keep if !_ok & !_blank
        contract file_year `v', freq(n)
        gsort -n
        local nshow = min(60, _N)
        if `nshow' > 0 noi list file_year `v' n in 1/`nshow', noobs clean abbreviate(30)
        else noi di "（該当なし）"
    restore
    drop _ok _blank _bytes _chars
}

noi di "確認終了。code_format_check.log を共有してください。"
log close fmt
