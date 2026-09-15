# Golden fixtures

One verified result CSV per question (`q01.csv` … `q31.csv`), plus a
`SHA256SUMS` manifest. Authored by running hand-written queries against
trazo3-fields and reviewing the results against known facts about the
data, jointly with domain review.

Regenerate the manifest after any change:

```bash
cd fixtures/golden
sha256sum q*.csv > SHA256SUMS
```

These files are never mounted into session containers.
