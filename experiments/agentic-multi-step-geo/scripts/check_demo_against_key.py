"""Check the one-shot demo report against this benchmark's answer key.

The demo (https://github.com/tristangrupp/cng-nyc-evals-demo) ran the same workflow
once, from a single spec, and published property_results.csv. The benchmark's key for
the final question, q30, names every property that should be flagged and the contact
for each. This script compares the two.

Usage: python scripts/check_demo_against_key.py <path to demo property_results.csv>
"""
import csv
import pathlib
import sys

KEY = pathlib.Path(__file__).resolve().parent.parent / "data" / "fixtures" / "golden" / "q30.csv"


def main(demo_csv: str) -> int:
    demo = [r for r in csv.DictReader(open(demo_csv, encoding="utf-8"))
            if r["follow_up_required"].strip().lower() == "true"]
    key = list(csv.DictReader(open(KEY, encoding="utf-8")))

    demo_ids = {r["cod_imovel"] for r in demo}
    key_ids = {r["cod_imovel"] for r in key}
    key_loss = {r["cod_imovel"]: float(r["post2020_loss_ha"]) for r in key}
    demo_loss = {r["cod_imovel"]: float(r["post2020_loss_ha"]) for r in demo}
    key_contact = {r["cod_imovel"]: (r["entity_id"], r["tier"]) for r in key}
    demo_contact = {r["cod_imovel"]: (r["contact_entity_id"], r["contact_tier"]) for r in demo}

    print("flagged properties: key %d, demo %d, identical set: %s"
          % (len(key_ids), len(demo_ids), key_ids == demo_ids))
    print("post-2020 loss on flagged land: key %.1f ha, demo %.1f ha"
          % (sum(key_loss.values()), sum(demo_loss.values())))
    shared = key_ids & demo_ids
    loss_off = [c for c in shared if abs(key_loss[c] - demo_loss[c]) > 0.05]
    contact_off = [c for c in shared if key_contact[c] != demo_contact[c]]
    print("per-property loss differing by more than 0.05 ha: %d" % len(loss_off))
    print("properties given a different top contact: %d" % len(contact_off))
    for c in sorted(key_ids - demo_ids):
        print("  missing from the demo: %s" % c)
    for c in sorted(demo_ids - key_ids):
        print("  flagged only by the demo: %s" % c)
    return 0 if (key_ids == demo_ids and not loss_off and not contact_off) else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    raise SystemExit(main(sys.argv[1]))
