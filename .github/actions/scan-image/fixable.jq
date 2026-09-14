# Emulates `grype --only-fixed` (ignore rules fix-state not-fixed | wont-fix | unknown; empty state counts as unknown).
def fix_state: (.vulnerability.fix.state // "unknown") | if . == "" then "unknown" else . end;
. + {
  matches: [.matches[] | select(fix_state == "fixed")],
  ignoredMatches: ((.ignoredMatches // []) + [.matches[] | select(fix_state != "fixed") | . + {appliedIgnoreRules: [{"fix-state": fix_state}]}])
}
