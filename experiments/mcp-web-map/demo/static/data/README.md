# Bundled datasets

## `countries.geojson`

World country boundaries derived from **Natural Earth** (1:110m Admin 0 – Countries),
which is in the **public domain** (https://www.naturalearthdata.com/about/terms-of-use/).

Processed for this demo to keep the file small (~200 KB):

- Coordinates rounded to 3 decimal places (sufficient at 1:110m resolution).
- Properties trimmed to: `name`, `iso_a3`, `continent`, `region`, `pop_est`
  (population estimate), `gdp_md` (GDP in millions USD).

Used by the `add_data_layer`, `style_data_layer`, `filter_data_layer`, and
`query_at_point` tools (dataset key: `countries`).
