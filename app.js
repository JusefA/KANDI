const PXWEB_URL =
  "https://pxdata.stat.fi/PxWeb/sq/1a2d62c1-23f0-42ad-8c50-49f836fb97a9";

let partyChart = null;
let sexChart = null;

let mapInstance = null;
let muniLayer = null;
let provLayer = null;

let globalData = null;

const PARTY_COLORS = {
  "03": "#E11931", // SDP
  "01": "#0057B7", // KOK
  "02": "#FFD200", // PS
  "05": "#33A532", // VIHR
  "04": "#01954B", // KESK
  "06": "#D40000", // VAS
  "07": "#FFCC00", // RKP
  "08": "#2B4C9A", // KD
  "09": "#CE0F69", // LIIKE
  "16": "#6D6D6D", // LIBE
  "11": "#8B0000", // SKP
  "10": "#4B0082", // AP
  "13": "#444444", // VKK
  "12": "#555555", // KRIP
  "99": "#888888"  // Valitsijayhdistykset
};

// ------------------------- MAIN LOAD -------------------------
window.initMunicipal = async function initMunicipal() {
  initMap();
  setStatus("Loading data…");

  try {
    const data = await fetchPX();
    globalData = data;
    clearStatus();

    populateDropdowns(data);

    const yearSelect = document.getElementById("yearSelect");
    const geoSelect = document.getElementById("geoSelect");
    const sexMeasureSelect = document.getElementById("sexMeasureSelect");

    refreshCharts();

    await loadGeoJSONLayers();
    updateGeoLayer();

    yearSelect.onchange = () => { refreshCharts(); updateGeoLayer(); };
    geoSelect.onchange = () => { refreshCharts(); updateGeoLayer(); };
    sexMeasureSelect.onchange = () => { refreshCharts(); updateGeoLayer(); };

  } catch (err) {
    console.error(err);
    setStatus("Failed to load", true);
  }
};


function refreshCharts() {
  if (!globalData) return;

  const yearCode = document.getElementById("yearSelect").value;
  const geoCode = document.getElementById("geoSelect").value;
  const measureCode = getMeasureInfoCode(); // shared

  const national = buildNationalPartyShares(globalData, yearCode, geoCode, measureCode);
  drawPartyBar(national);

  const sexData = buildSexData(globalData, yearCode, geoCode, measureCode);
  drawSexChart(sexData);

  // KPI
  document.getElementById("kpiCount").textContent = globalData.value.length;
  document.getElementById("kpiParties").textContent =
    Object.keys(globalData.dimension.Puolue.category.index).length;
  document.getElementById("kpiGeos").textContent =
    Object.keys(globalData.dimension["Maakunta ja kunta"].category.index).length;
}

// measure helper
function getMeasureInfoCode() {
  const measureChoice = document.getElementById("sexMeasureSelect").value;
  if (measureChoice === "aanet") return "aanet_yht";
  if (measureChoice === "ennakko") return "aanet_enn";
  return "lkm_ehd";
}

// FETCH 
async function fetchPX() {
  const res = await fetch(PXWEB_URL, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// MAP & GEOJSON
function initMap() {
  const map = L.map("map");
  mapInstance = map;

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 12,
    minZoom: 3
  }).addTo(map);

  const fin = L.latLngBounds([59.5, 19.0], [70.2, 31.6]);
  map.fitBounds(fin);
}

async function loadGeoJSONLayers() {
  // adjust file names/paths if needed
  const [muniResp, provResp] = await Promise.all([
    fetch("municipalities.geojson"),
    fetch("provinces.geojson")
  ]);

  const [muniGeo, provGeo] = await Promise.all([
    muniResp.json(),
    provResp.json()
  ]);

  muniLayer = L.geoJSON(muniGeo, {
    style: () => ({
      color: "#444",
      weight: 1,
      fillColor: "#222",
      fillOpacity: 0.5
    }),
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.NAMEFIN || "";
      layer.bindPopup(name);
    }
  }).addTo(mapInstance);

  provLayer = L.geoJSON(provGeo, {
    style: () => ({
      color: "#999",
      weight: 1.5,
      fillColor: "#333",
      fillOpacity: 0.3
    }),
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.NAMEFIN || "";
      layer.bindPopup(name);
    }
  }).addTo(mapInstance);
}

function updateGeoLayer() {
  if (!globalData || !mapInstance || (!muniLayer && !provLayer)) return;

  const geoCode = document.getElementById("geoSelect").value; // MA1, MK01, KU091, ...
  const measureCode = getMeasureInfoCode();
  const yearCode = document.getElementById("yearSelect").value;

  if (geoCode === "MA1") {
    resetGeoStyles();
    return;
  }

  const leading = getLeadingPartyForArea(globalData, yearCode, geoCode, measureCode);
  const color = leading ? (PARTY_COLORS[leading.party] || "#4aa3ff") : "#4aa3ff";

  resetGeoStyles();

  if (geoCode.startsWith("KU") && muniLayer) {
    const nat = geoCode.slice(2); // KU091 -> "091"
    muniLayer.eachLayer(layer => {
      const natcode = layer.feature?.properties?.NATCODE;
      if (natcode === nat) {
        layer.setStyle({
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.7
        });
        mapInstance.fitBounds(layer.getBounds(), { maxZoom: 9 });
      }
    });
  } else if (geoCode.startsWith("MK") && provLayer) {
    const nat = geoCode.slice(2); // MK01 -> "01"
    provLayer.eachLayer(layer => {
      const natcode = layer.feature?.properties?.NATCODE;
      if (natcode === nat) {
        layer.setStyle({
          color: "#ffffff",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.6
        });
        mapInstance.fitBounds(layer.getBounds(), { maxZoom: 8 });
      }
    });
  }
}

function resetGeoStyles() {
  if (muniLayer) {
    muniLayer.eachLayer(layer => {
      layer.setStyle({
        color: "#444",
        weight: 1,
        fillColor: "#222",
        fillOpacity: 0.5
      });
    });
  }
  if (provLayer) {
    provLayer.eachLayer(layer => {
      layer.setStyle({
        color: "#999",
        weight: 1.5,
        fillColor: "#333",
        fillOpacity: 0.3
      });
    });
  }
}

function getLeadingPartyForArea(j, yearCode, geoCode, measureCode) {
  const dims = j.dimension;
  const values = j.value;
  const size = j.size;

  const idxYear = dims.Vuosi.category.index[yearCode];
  const idxArea = dims["Maakunta ja kunta"].category.index[geoCode];
  const idxSex = dims["Ehdokkaan sukupuoli"].category.index["SSS"]; // total
  const idxInfo = dims["Tiedot"].category.index[measureCode];

  const partyIndex = dims.Puolue.category.index;
  const partyLabels = dims.Puolue.category.label;
  const partyCodes = Object.keys(partyIndex).filter(c => c !== "SSS");

  function pos(y, a, p, s, t) {
    const [ny, na, np, ns, nt] = size;
    return (
      y * na * np * ns * nt +
      a * np * ns * nt +
      p * ns * nt +
      s * nt +
      t
    );
  }

  let best = null;
  for (const code of partyCodes) {
    const p = partyIndex[code];
    const v = values[pos(idxYear, idxArea, p, idxSex, idxInfo)] ?? 0;
    if (!best || v > best.value) {
      best = { party: code, label: partyLabels[code], value: v };
    }
  }
  return best;
}

// ------------------------- DROPDOWNS -------------------------
function populateDropdowns(data) {
  const dims = data.dimension;

  // year
  const ysel = document.getElementById("yearSelect");
  ysel.innerHTML = "";
  for (const [code, lab] of Object.entries(dims.Vuosi.category.label)) {
    const op = document.createElement("option");
    op.value = code;
    op.textContent = lab;
    ysel.appendChild(op);
  }

  // geography
  const gsel = document.getElementById("geoSelect");
  gsel.innerHTML = "";
  for (const [code, lab] of Object.entries(dims["Maakunta ja kunta"].category.label)) {
    const op = document.createElement("option");
    op.value = code;
    op.textContent = lab;
    gsel.appendChild(op);
  }
}

// NATIONAL PARTY SHARES 
// j.id = ["Vuosi","Maakunta ja kunta","Puolue","Ehdokkaan sukupuoli","Tiedot"]. TODO: TÄMÄ ON SE FORMAATTI PXDATASSA!!
function buildNationalPartyShares(j, yearCode, geoCode, measureCode) {
  const dims = j.dimension;
  const values = j.value;
  const size = j.size; // [nYear, nArea, nParty, nSex, nInfo]

  const idxYear = dims.Vuosi.category.index[yearCode];
  const idxArea = dims["Maakunta ja kunta"].category.index[geoCode];
  const idxSex = dims["Ehdokkaan sukupuoli"].category.index["SSS"]; // Yhteensä
  const idxInfo = dims["Tiedot"].category.index[measureCode];

  const partyIndex = dims.Puolue.category.index;
  const partyLabels = dims.Puolue.category.label;

  const partyCodes = Object.keys(partyIndex).filter(c => c !== "SSS");

  function pos(y, a, p, s, t) {
    const [ny, na, np, ns, nt] = size;
    return (
      y * na * np * ns * nt +
      a * np * ns * nt +
      p * ns * nt +
      s * nt +
      t
    );
  }

  return partyCodes
    .map(code => {
      const p = partyIndex[code];
      const v = values[pos(idxYear, idxArea, p, idxSex, idxInfo)] ?? 0;
      return {
        party: code,
        label: partyLabels[code],
        value: v
      };
    })
    .sort((a, b) => b.value - a.value);
}

// SEX DATA 
function buildSexData(j, yearCode, geoCode, measureCode) {
  const dims = j.dimension;
  const values = j.value;
  const size = j.size;

  const sexes = dims["Ehdokkaan sukupuoli"].category.index;
  const parties = dims.Puolue.category.index;
  const labels = dims.Puolue.category.label;

  const infoIndex = dims.Tiedot.category.index[measureCode];
  const idxYear = dims.Vuosi.category.index[yearCode];
  const idxArea = dims["Maakunta ja kunta"].category.index[geoCode];

  function pos(y, a, p, s, t) {
    const [ny, na, np, ns, nt] = size;
    return (
      y * na * np * ns * nt +
      a * np * ns * nt +
      p * ns * nt +
      s * nt +
      t
    );
  }

  const maleIdx = sexes["1"];   // Miehet
  const femaleIdx = sexes["2"]; // Naiset

  // 1) Build unsorted list with totals for sorting key
  const combined = [];

  for (const partyCode of Object.keys(parties)) {
    if (partyCode === "SSS") continue;

    const pIdx = parties[partyCode];
    const label = labels[partyCode];

    const mVal = values[pos(idxYear, idxArea, pIdx, maleIdx,   infoIndex)] ?? 0;
    const fVal = values[pos(idxYear, idxArea, pIdx, femaleIdx, infoIndex)] ?? 0;
    const total = mVal + fVal;

    combined.push({
      party: partyCode,
      label,
      male: mVal,
      female: fVal,
      total
    });
  }

  // 2) Sort descending by total so largest party is on the left
  combined.sort((a, b) => b.total - a.total);

  // 3) Split back into male/female series in the new order
  const maleSeries = combined.map(p => ({
    party: p.party,
    label: p.label,
    value: p.male
  }));
  const femaleSeries = combined.map(p => ({
    party: p.party,
    label: p.label,
    value: p.female
  }));

  return {
    male: maleSeries,
    female: femaleSeries
  };
}


// DRAW CHARTS 
function drawPartyBar(series) {
  const ctx = document.getElementById("partyBar").getContext("2d");
  if (partyChart) partyChart.destroy();

  partyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: series.map(s => s.label),
      datasets: [{
        label: "Value",
        data: series.map(s => s.value),
        backgroundColor: series.map(s => PARTY_COLORS[s.party] || "#4aa3ff")
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function drawSexChart(sexData) {
  const { male, female } = sexData;
  const ctx = document.getElementById("sexBar").getContext("2d");
  if (sexChart) sexChart.destroy();

  const labels = male.map(s => s.label); // puolueet in order

  sexChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Miehet",
          data: male.map(s => s.value),
          backgroundColor: male.map(s => PARTY_COLORS[s.party] || "#4aa3ff")
        },
        {
          label: "Naiset",
          data: female.map(s => s.value),
          backgroundColor: female.map(s => PARTY_COLORS[s.party] || "#ff7aa8")
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: false },
        y: { beginAtZero: true }
      }
    }
  });
}

// STATUS TODO: tää ei tomii kunnolla
function setStatus(msg, error = false) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.style.display = "inline-block";
  el.style.borderColor = error ? "#ff6b6b" : "#4aa3ff";
}
function clearStatus() {
  document.getElementById("status").style.display = "none";
}
