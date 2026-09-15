# Task

You are producing an EU Deforestation Regulation (EUDR) risk analysis for a
portfolio of Brazilian rural properties.

Your job is to analyze the following three datasets:

- **Field boundaries** — https://data.source.coop/wri-data-lab/trazofields/trazo3-fields/trazo3_brazil_goias_2024.parquet
- **Cadastral parcels** — https://data.source.coop/tristangruppwri/cadastral/Brazil_CAR_AREA_IMOVEL.parquet
- **Commodity infrastructure** — https://data.source.coop/tristangruppwri/soft-commodity-infrastructure/facilities/BR_facilities.parquet

The data are stored as GeoParquet and can be queried remotely using DuckDB (`duckdb` is
installed, with the `spatial` and `httpfs` extensions). You are advised to read all catalog metadata before starting work.

The `policies/` folder here contains all the necessary rules for this analysis. You must read its entire contents; this is the spec you are meant to implement. You will also need `lists/goias-sample.csv`, the portfolio of cadastral properties under analysis. Explanation of how to handle it is in `policies/` as well.

Do all your work in the foreground and write each answer to disk as soon as you have it, rather than holding your results to the end. Nothing will survive the end of your turn. Do not background slow queries; they will be lost, so simply wait for slow queries to finish instead.

Answer every question in `questions.yaml`. For each, write one CSV to
`answers/q{id}.csv`, exactly matching the specified
columns, meanings, and types. Column *names* are yours; column *meanings* and
*types* are not. All questions are staged to build on each other, so later questions rely on previous results.

Finally, write `answers/workflow.csv`: one row for every property you have
determined to be non-compliant (post-2020 loss on an EUDR-relevant crop), with
columns `cod_imovel`, `annex1_commodity`, `post2020_loss_ha`,
`top_contact_entity_id`, `entity_kind`, `tier`, `basis`, `distance_km`.
