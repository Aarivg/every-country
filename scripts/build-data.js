// Builds data/world.js for the Every Country quiz from Natural Earth data (via world-atlas).
// Run with: npm install && npm run build-data
const fs = require("fs");
const topojson = require("topojson-client");
const t50 = require("world-atlas/countries-50m.json");
const t10 = require("world-atlas/countries-10m.json");

// topo name -> [canonical name, continent, ...accepted aliases]
const AF = "Africa", AS = "Asia", EU = "Europe", NA = "North America", SA = "South America", OC = "Oceania";
const C = {
  "Algeria": ["Algeria", AF], "Angola": ["Angola", AF], "Benin": ["Benin", AF], "Botswana": ["Botswana", AF],
  "Burkina Faso": ["Burkina Faso", AF], "Burundi": ["Burundi", AF],
  "Cabo Verde": ["Cabo Verde", AF, "Cape Verde"], "Cameroon": ["Cameroon", AF],
  "Central African Rep.": ["Central African Republic", AF, "CAR"], "Chad": ["Chad", AF], "Comoros": ["Comoros", AF],
  "Congo": ["Republic of the Congo", AF, "Congo", "Congo-Brazzaville", "Congo Brazzaville", "Republic of Congo", "ROC"],
  "Dem. Rep. Congo": ["Democratic Republic of the Congo", AF, "DRC", "DR Congo", "Congo-Kinshasa", "Congo Kinshasa", "Democratic Republic of Congo", "Zaire"],
  "Côte d'Ivoire": ["Côte d'Ivoire", AF, "Ivory Coast", "Cote dIvoire"], "Djibouti": ["Djibouti", AF], "Egypt": ["Egypt", AF],
  "Eq. Guinea": ["Equatorial Guinea", AF], "Eritrea": ["Eritrea", AF],
  "eSwatini": ["Eswatini", AF, "Swaziland"], "Ethiopia": ["Ethiopia", AF], "Gabon": ["Gabon", AF],
  "Gambia": ["The Gambia", AF, "Gambia"], "Ghana": ["Ghana", AF], "Guinea": ["Guinea", AF, "Guinea-Conakry"],
  "Guinea-Bissau": ["Guinea-Bissau", AF], "Kenya": ["Kenya", AF], "Lesotho": ["Lesotho", AF], "Liberia": ["Liberia", AF],
  "Libya": ["Libya", AF], "Madagascar": ["Madagascar", AF], "Malawi": ["Malawi", AF], "Mali": ["Mali", AF],
  "Mauritania": ["Mauritania", AF], "Mauritius": ["Mauritius", AF], "Morocco": ["Morocco", AF],
  "Mozambique": ["Mozambique", AF], "Namibia": ["Namibia", AF], "Niger": ["Niger", AF], "Nigeria": ["Nigeria", AF],
  "Rwanda": ["Rwanda", AF], "São Tomé and Principe": ["São Tomé and Príncipe", AF, "Sao Tome", "Sao Tome and Principe"],
  "Senegal": ["Senegal", AF], "Seychelles": ["Seychelles", AF], "Sierra Leone": ["Sierra Leone", AF],
  "Somalia": ["Somalia", AF], "Somaliland": ["Somalia", AF], "South Africa": ["South Africa", AF, "RSA"],
  "S. Sudan": ["South Sudan", AF], "Sudan": ["Sudan", AF], "Tanzania": ["Tanzania", AF], "Togo": ["Togo", AF],
  "Tunisia": ["Tunisia", AF], "Uganda": ["Uganda", AF], "Zambia": ["Zambia", AF], "Zimbabwe": ["Zimbabwe", AF],

  "Afghanistan": ["Afghanistan", AS], "Armenia": ["Armenia", AS], "Azerbaijan": ["Azerbaijan", AS],
  "Bahrain": ["Bahrain", AS], "Bangladesh": ["Bangladesh", AS], "Bhutan": ["Bhutan", AS],
  "Brunei": ["Brunei", AS, "Brunei Darussalam"], "Cambodia": ["Cambodia", AS, "Kampuchea"], "China": ["China", AS, "PRC"],
  "Georgia": ["Georgia", AS], "India": ["India", AS], "Indonesia": ["Indonesia", AS], "Iran": ["Iran", AS, "Persia"],
  "Iraq": ["Iraq", AS], "Israel": ["Israel", AS], "Japan": ["Japan", AS], "Jordan": ["Jordan", AS],
  "Kazakhstan": ["Kazakhstan", AS], "Kuwait": ["Kuwait", AS], "Kyrgyzstan": ["Kyrgyzstan", AS, "Kirghizia", "Kyrgyz Republic"],
  "Laos": ["Laos", AS, "Lao"], "Lebanon": ["Lebanon", AS], "Malaysia": ["Malaysia", AS], "Maldives": ["Maldives", AS],
  "Mongolia": ["Mongolia", AS], "Myanmar": ["Myanmar", AS, "Burma"], "Nepal": ["Nepal", AS],
  "North Korea": ["North Korea", AS, "DPRK"], "Oman": ["Oman", AS], "Pakistan": ["Pakistan", AS],
  "Palestine": ["Palestine", AS, "State of Palestine", "Palestinian Territories"], "Philippines": ["Philippines", AS],
  "Qatar": ["Qatar", AS], "Saudi Arabia": ["Saudi Arabia", AS, "KSA"], "Singapore": ["Singapore", AS],
  "South Korea": ["South Korea", AS, "Korea", "ROK", "Republic of Korea"], "Sri Lanka": ["Sri Lanka", AS, "Ceylon"],
  "Syria": ["Syria", AS], "Taiwan": ["Taiwan", AS, "ROC Taiwan", "Republic of China"], "Tajikistan": ["Tajikistan", AS],
  "Thailand": ["Thailand", AS, "Siam"], "Timor-Leste": ["Timor-Leste", AS, "East Timor"], "Turkey": ["Türkiye", AS, "Turkey"],
  "Turkmenistan": ["Turkmenistan", AS], "United Arab Emirates": ["United Arab Emirates", AS, "UAE", "Emirates"],
  "Uzbekistan": ["Uzbekistan", AS], "Vietnam": ["Vietnam", AS, "Viet Nam"], "Yemen": ["Yemen", AS],

  "Albania": ["Albania", EU], "Andorra": ["Andorra", EU], "Austria": ["Austria", EU], "Belarus": ["Belarus", EU, "Byelorussia"],
  "Belgium": ["Belgium", EU], "Bosnia and Herz.": ["Bosnia and Herzegovina", EU, "Bosnia", "BiH", "Bosnia-Herzegovina"],
  "Bulgaria": ["Bulgaria", EU], "Croatia": ["Croatia", EU], "Cyprus": ["Cyprus", EU], "N. Cyprus": ["Cyprus", EU],
  "Czechia": ["Czechia", EU, "Czech Republic"], "Denmark": ["Denmark", EU], "Estonia": ["Estonia", EU],
  "Finland": ["Finland", EU], "France": ["France", EU], "Germany": ["Germany", EU, "Deutschland"], "Greece": ["Greece", EU, "Hellas"],
  "Hungary": ["Hungary", EU], "Iceland": ["Iceland", EU], "Ireland": ["Ireland", EU, "Eire", "Republic of Ireland"],
  "Italy": ["Italy", EU], "Kosovo": ["Kosovo", EU], "Latvia": ["Latvia", EU], "Liechtenstein": ["Liechtenstein", EU],
  "Lithuania": ["Lithuania", EU], "Luxembourg": ["Luxembourg", EU], "Malta": ["Malta", EU], "Moldova": ["Moldova", EU],
  "Monaco": ["Monaco", EU], "Montenegro": ["Montenegro", EU], "Netherlands": ["Netherlands", EU, "Holland", "The Netherlands"],
  "Macedonia": ["North Macedonia", EU, "Macedonia"], "Norway": ["Norway", EU], "Poland": ["Poland", EU],
  "Portugal": ["Portugal", EU], "Romania": ["Romania", EU], "Russia": ["Russia", EU, "Russian Federation"],
  "San Marino": ["San Marino", EU], "Serbia": ["Serbia", EU], "Slovakia": ["Slovakia", EU], "Slovenia": ["Slovenia", EU],
  "Spain": ["Spain", EU, "Espana"], "Sweden": ["Sweden", EU], "Switzerland": ["Switzerland", EU],
  "Ukraine": ["Ukraine", EU], "United Kingdom": ["United Kingdom", EU, "UK", "Britain", "Great Britain", "England"],
  "Vatican": ["Vatican City", EU, "Vatican", "Holy See"],

  "Antigua and Barb.": ["Antigua and Barbuda", NA, "Antigua"], "Bahamas": ["The Bahamas", NA, "Bahamas"],
  "Barbados": ["Barbados", NA], "Belize": ["Belize", NA], "Canada": ["Canada", NA], "Costa Rica": ["Costa Rica", NA],
  "Cuba": ["Cuba", NA], "Dominica": ["Dominica", NA], "Dominican Rep.": ["Dominican Republic", NA, "DR"],
  "El Salvador": ["El Salvador", NA, "Salvador"], "Grenada": ["Grenada", NA], "Guatemala": ["Guatemala", NA],
  "Haiti": ["Haiti", NA], "Honduras": ["Honduras", NA], "Jamaica": ["Jamaica", NA], "Mexico": ["Mexico", NA],
  "Nicaragua": ["Nicaragua", NA], "Panama": ["Panama", NA],
  "St. Kitts and Nevis": ["Saint Kitts and Nevis", NA, "St Kitts", "Saint Kitts", "St Kitts and Nevis"],
  "Saint Lucia": ["Saint Lucia", NA, "St Lucia"],
  "St. Vin. and Gren.": ["Saint Vincent and the Grenadines", NA, "St Vincent", "Saint Vincent", "St Vincent and the Grenadines"],
  "Trinidad and Tobago": ["Trinidad and Tobago", NA, "Trinidad"],
  "United States of America": ["United States", NA, "USA", "US", "America", "United States of America"],

  "Argentina": ["Argentina", SA], "Bolivia": ["Bolivia", SA], "Brazil": ["Brazil", SA, "Brasil"], "Chile": ["Chile", SA],
  "Colombia": ["Colombia", SA], "Ecuador": ["Ecuador", SA], "Guyana": ["Guyana", SA], "Paraguay": ["Paraguay", SA],
  "Peru": ["Peru", SA], "Suriname": ["Suriname", SA, "Surinam"], "Uruguay": ["Uruguay", SA], "Venezuela": ["Venezuela", SA],

  "Australia": ["Australia", OC], "Fiji": ["Fiji", OC], "Kiribati": ["Kiribati", OC],
  "Marshall Is.": ["Marshall Islands", OC, "Marshalls"], "Micronesia": ["Micronesia", OC, "Federated States of Micronesia", "FSM"],
  "Nauru": ["Nauru", OC], "New Zealand": ["New Zealand", OC, "Aotearoa", "NZ"], "Palau": ["Palau", OC],
  "Papua New Guinea": ["Papua New Guinea", OC, "PNG"], "Samoa": ["Samoa", OC], "Solomon Is.": ["Solomon Islands", OC, "Solomons"],
  "Tonga": ["Tonga", OC], "Tuvalu": ["Tuvalu", OC], "Vanuatu": ["Vanuatu", OC],
};

const geoms = t50.objects.countries.geometries.filter(g => g.properties.name !== "Antarctica");
const quiz = {}; // key -> {n, c, a}
const key = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
const used = new Set();
for (const g of geoms) {
  const row = C[g.properties.name];
  const terr = g.properties.name;
  if (row) {
    const k = key(row[0]);
    g.properties = { k };
    used.add(g.properties && terr);
    const prev = quiz[k];
    const aliases = new Set([...(prev ? prev.a : []), ...row.slice(2)]);
    quiz[k] = { n: row[0], c: row[1], a: [...aliases] };
  } else {
    g.properties = { t: terr };
  }
  delete g.id;
}
// Tuvalu from the 10m set
const tv = t10.objects.countries.geometries.find(g => g.properties.name === "Tuvalu");
const tuvalu = topojson.feature(t10, tv);
tuvalu.properties = { k: "tuvalu" };
quiz["tuvalu"] = { n: "Tuvalu", c: OC, a: [] };
const round = v => Math.round(v * 1000) / 1000;
tuvalu.geometry.coordinates = tuvalu.geometry.coordinates.map(p => p.map(r => r.map(([x, y]) => [round(x), round(y)])));

const missing = Object.keys(C).filter(n => !used.has(n) && n !== "Tuvalu");
console.error("missing in 50m:", missing);
const counts = {};
for (const q of Object.values(quiz)) counts[q.c] = (counts[q.c] || 0) + 1;
console.error("total", Object.keys(quiz).length, counts);

t50.objects.countries.geometries = geoms;
delete t50.objects.land;
const out = require("path").join(__dirname, "..", "data", "world.js");
fs.writeFileSync(out, "// Generated by scripts/build-data.js. Do not edit by hand.\nwindow.WORLD_DATA = " + JSON.stringify({ topo: t50, tuvalu, quiz }) + ";\n");
console.error("wrote", out, fs.statSync(out).size, "bytes");
