/* UNICO — staff (nurse + PCA) records.
   The records now live in MongoDB (the `staff` collection) and are injected by the
   Express web server as window.__UNICO_STAFF__ before this script runs. No hardcoded
   staff data remains here. To edit the seed: server/seed/staff.json then
   npm --prefix server run seed-data -- staff --force */
window.STAFF_SEED = (typeof window !== 'undefined' && Array.isArray(window.__UNICO_STAFF__)) ? window.__UNICO_STAFF__ : [];
