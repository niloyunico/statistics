# Medicine index — vendored source data

These six CSVs are the drug database's source. They are **committed to this repository
on purpose** so the index can be rebuilt on a machine with no internet at all.

- Source: Assorted Medicine Dataset of Bangladesh (ahmedshahriarsakib, Kaggle)
- Produced by: https://github.com/ahmedshahriar/bd-medicine-scraper
- Licence: **CC0 1.0 (public domain)** — redistribution is unrestricted
- Snapshot: **2022-07-24** — prices are indicative, not current

Rebuild the database from these files (no network):

    node scripts/import-medicines.js

Check integrity against the checksums below:

    node scripts/import-medicines.js --verify

## SHA-256

    b4a833b22db4d7ef635a52871889e1f605af5d3324341f9d0049b40ec7243c67 *dosage form.csv
    728afad1bab145078e25f0c2fcec07bb64761fb3a34b183d2f73a76d83ebe071 *drug class.csv
    d87406bd0e1765fd3740912edd09d7df355e0cd8bcaa9482da9d2c47063e8046 *generic.csv
    4703725a3873e02594c3e4e0e61dc0a86d17f68bd9e114c35f2dde4092892cb1 *indication.csv
    9c41f606716ec6996a8113d1d9c0321309de55acd5cd89d39ca4bbf68ded921b *manufacturer.csv
    fa0767285719e093b124a2e68958e86afab9619e499a79e466024f095b0b8791 *medicine.csv
