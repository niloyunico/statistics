/* UNICO — Quality Indicators.
   The reports now live in MongoDB (the `quality` collection) and are injected by the
   Express web server as window.__UNICO_QUALITY__ before this script runs. No hardcoded
   quality data remains here. To edit the seed: server/seed/quality.json then
   npm --prefix server run seed-data -- quality --force */
window.QUALITY_SEED = (typeof window !== 'undefined' && Array.isArray(window.__UNICO_QUALITY__)) ? window.__UNICO_QUALITY__ : [];
