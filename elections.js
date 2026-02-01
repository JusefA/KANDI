// kontrolleri

document.currentScript.dataset.election = "true";

function toggleElectionView(type) {
  const municipal = document.getElementById("municipalSection");
  const pres = document.getElementById("presidentialSection");

  if (!municipal || !pres) return;

  if (type === "presidential") {
    municipal.style.display = "none";
    pres.style.display = "block";
  } else {
    pres.style.display = "none";
    municipal.style.display = "block";
  }
}

function removeExistingElectionScripts() {
  const scripts = document.querySelectorAll("script[data-election-module]");
  scripts.forEach(s => s.remove());
}

function loadElectionModule(type) {
  const modules = {
    municipal: "app.js",
    presidential: "president.js",
  };

  const scriptSrc = modules[type];
  if (!scriptSrc) return Promise.resolve();

  removeExistingElectionScripts();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.dataset.electionModule = "true";

    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load " + scriptSrc));

    document.body.appendChild(script);
  });
}

// ?????????????????????????????????????????????????????????????????????
(async function boot() {
  const selector = document.getElementById("electionType");

  // initial view
  toggleElectionView("municipal");
  await loadElectionModule("municipal");
  if (window.initMunicipal) window.initMunicipal();

  selector.addEventListener("change", async e => {
    const type = e.target.value;

    toggleElectionView(type);
    await loadElectionModule(type);

    if (type === "municipal" && window.initMunicipal) window.initMunicipal();
    if (type === "presidential" && window.initPresident) window.initPresident();
  });
})();
