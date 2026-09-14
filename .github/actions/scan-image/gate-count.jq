# Grype --fail-on semantics: count matches at or above $cutoff (negligible<low<medium<high<critical; unknown never gates).
def rank: {"negligible": 1, "low": 2, "medium": 3, "high": 4, "critical": 5}[ascii_downcase] // 0;
[.matches[] | select((.vulnerability.severity // "unknown" | rank) >= ($cutoff | rank))] | length
