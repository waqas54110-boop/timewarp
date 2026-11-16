// Dev-time helper: world-atlas (topojson) -> one GeoJSON file with country polygons, merged with world-countries metadata.
const topo = require('topojson-client');
const atlas = require('world-atlas/countries-50m.json');
const wc = require('world-countries');
const fc = topo.feature(atlas, atlas.objects.countries);
// the 50m file stores the Antarctic mainland as a degenerate ring at the pole: take Antarctica from the 10m file instead
const atlas10 = require('world-atlas/countries-10m.json');
const antarctica10 = topo.feature(atlas10, atlas10.objects.countries).features.find((f) => f.properties.name === 'Antarctica');
fc.features.forEach((f) => { if (f.properties.name === 'Antarctica') f.geometry = antarctica10.geometry; });
const byNum = new Map(wc.map((c) => [c.ccn3, c]));
const out = fc.features.map((f) => {
  const m = f.id ? byNum.get(String(f.id).padStart(3, '0')) : null;
  return {
    name: m ? m.name.common : f.properties.name,
    cc: m ? m.cca2 : '',
    flag: m ? m.flag : '',
    region: m ? m.region : '',
    cap: m && m.capital && m.capital[0] ? m.capital[0] : '',
    capLL: m && m.capitalInfo && m.capitalInfo.latlng && m.capitalInfo.latlng.length ? m.capitalInfo.latlng : (m ? m.latlng : null),
    geom: f.geometry,
  };
});
require('fs').writeFileSync('countries.geo.json', JSON.stringify(out));
console.log('features', out.length, 'missing meta', out.filter((o) => !o.cc).map((o) => o.name).join(', '));
