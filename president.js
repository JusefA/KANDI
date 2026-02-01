
//Independent module for President Elections 2024
 
const PRESIDENT_URL =
  "https://pxdata.stat.fi/PxWeb/sq/22ebcb21-9172-41df-b1d2-51f37b771067";

let presData = null;
let presChart = null;

window.initPresident = async function initPresident() {
  try {
    presData = await fetchPresidentData();
    populatePresidentGeos(presData);
    updatePresidentChart();

    document.getElementById("presGeoSelect").onchange = updatePresidentChart;
  } catch (err) {
    console.error("President data load error:", err);
  }
};


// Fetch JSON-stat2
async function fetchPresidentData() {
  const res = await fetch(PRESIDENT_URL, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// Populate dropdown
function populatePresidentGeos(j) {
  const geoDim = j.dimension["Alue"].category.label;
  const sel = document.getElementById("presGeoSelect");
  sel.innerHTML = "";

  for (const [code, label] of Object.entries(geoDim)) {
    const op = document.createElement("option");
    op.value = code;
    op.textContent = label;
    sel.appendChild(op);
  }
}

// Build chart data (round 1 only)
function buildPresidentSeries(j, geoCode) {
  const dims = j.dimension;
  const values = j.value;
  const size = j.size;  // [Year, Area, Candidate, Round, Measure]

  const idxYear = 0;
  const idxArea = dims["Alue"].category.index[geoCode];
  const idxRound = dims["Kierros"].category.index["1"];     // 1st round
  const idxVotes = dims["Tiedot"].category.index["aanet"];  // vote count

  const candIndex = dims["Ehdokas"].category.index;
  const candLabels = dims["Ehdokas"].category.label;

  // JSON-stat2 position helper
  function pos(y, a, c, r, t) {
    const [NY, NA, NC, NR, NT] = size;
    return (
      y * NA * NC * NR * NT +
      a * NC * NR * NT +
      c * NR * NT +
      r * NT +
      t
    );
  }

  const series = [];

  for (const [candidateCode, cIdx] of Object.entries(candIndex)) {
    const v = values[pos(idxYear, idxArea, cIdx, idxRound, idxVotes)] ?? 0;
    series.push({
      candidate: candidateCode,
      label: candLabels[candidateCode],
      votes: v
    });
  }

  return series.sort((a, b) => b.votes - a.votes);
}

// Draw chart
function updatePresidentChart() {
  const geoCode = document.getElementById("presGeoSelect").value;
  const series = buildPresidentSeries(presData, geoCode);

  const ctx = document.getElementById("presChart").getContext("2d");

  if (presChart) presChart.destroy();

  presChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: series.map(s => s.label),
      datasets: [
        {
          label: "Äänimäärä (1. kierros)",
          data: series.map(s => s.votes),
          backgroundColor: "#2b8cff"
        }
      ]
    },
    options: {
      responsive: true,
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: v => v.toLocaleString("fi-FI")
          }
        }
      }
    }
  });
}
