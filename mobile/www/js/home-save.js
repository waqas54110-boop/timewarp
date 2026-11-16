// Home page: shows Continue for guests who have a local save, and asks before New Life throws a saved life away.
(function () {
  const Save = window.TimeWarpSave;
  const cont = document.getElementById('continue-btn'), fresh = document.getElementById('newlife-btn'), note = document.getElementById('save-note');
  if (!Save || !cont || !fresh) return;
  let hasSave = !cont.hidden;
  if (!Save.auth && !hasSave) {
    Save.load().then((sv) => {
      if (!sv) return;
      const world = sv.lastMode === 'world' && sv.world;
      cont.href = world
        ? '/world?mode=' + sv.world.mode + '&year=' + sv.world.year + (sv.world.destinationId ? '&destinationId=' + sv.world.destinationId : '') + '&continue=1'
        : '/life?continue=1';
      if (!world && !sv.life) return;
      cont.textContent = 'Continue' + (world ? ' (Live World)' : ' (Life Mode)');
      cont.hidden = false; note.hidden = false; note.textContent = 'Aap ka progress is browser mein save hai.';
      hasSave = true;
    });
  }
  fresh.addEventListener('click', (e) => {
    if (hasSave && !confirm('New Life shuru karne se save ki hui zindagi mit jayegi. Pakka?')) e.preventDefault();
  });
})();
