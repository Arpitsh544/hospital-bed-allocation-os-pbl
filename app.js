(() => {
  const QUEUE_LIMIT = 8;
  const WARDS = [
    { name: 'General', size: 8, prefix: 'G' },
    { name: 'ICU', size: 4, prefix: 'I' },
    { name: 'Ventilator', size: 2, prefix: 'V' },
    { name: 'Isolation', size: 2, prefix: 'S' }
  ];
  const RESOURCE_TOTAL = { beds: 16, ventilators: 3, nurses: 12, isolation: 2 };
  const seed = {
    beds: [
      { id: 'G-01', ward: 'General', patient: 'Noah Williams' }, { id: 'G-02', ward: 'General', patient: null },
      { id: 'G-03', ward: 'General', patient: 'Olivia Chen' }, { id: 'G-04', ward: 'General', patient: null },
      { id: 'G-05', ward: 'General', patient: 'Aarav Mehta' }, { id: 'G-06', ward: 'General', patient: null },
      { id: 'G-07', ward: 'General', patient: null }, { id: 'G-08', ward: 'General', patient: null },
      { id: 'I-01', ward: 'ICU', patient: 'Emma Davis' }, { id: 'I-02', ward: 'ICU', patient: null },
      { id: 'I-03', ward: 'ICU', patient: 'Liam Johnson' }, { id: 'I-04', ward: 'ICU', patient: null },
      { id: 'V-01', ward: 'Ventilator', patient: 'Sophia Brown' }, { id: 'V-02', ward: 'Ventilator', patient: null },
      { id: 'S-01', ward: 'Isolation', patient: null }, { id: 'S-02', ward: 'Isolation', patient: null }
    ],
    queue: [
      { id: 'RQ-1042', name: 'Maya Patel', ward: 'ICU', priority: 'emergency', beds: 1, equipment: 'ventilator', arrival: Date.now() - 1000 * 60 * 4 },
      { id: 'RQ-1041', name: 'Ethan Wilson', ward: 'General', priority: 'urgent', beds: 2, equipment: 'none', arrival: Date.now() - 1000 * 60 * 9 },
      { id: 'RQ-1040', name: 'Isabella Garcia', ward: 'Isolation', priority: 'routine', beds: 1, equipment: 'none', arrival: Date.now() - 1000 * 60 * 16 }
    ],
    activity: [
      { icon: '✓', type: 'ok', text: '<strong>Sophia Brown</strong> assigned to Ventilator · V-01', time: '09:42 AM' },
      { icon: '◷', type: 'wait', text: '<strong>Maya Patel</strong> added to the emergency queue', time: '09:38 AM' },
      { icon: '↗', type: 'ok', text: '<strong>Emma Davis</strong> transferred to ICU · I-01', time: '09:21 AM' }
    ],
    nextRequest: 1043
  };

  let state = loadState();
  let currentFilter = 'all';
  let labBedCount = 2;
  let processing = false;
  let latestExperiment = null;
  let lastSafetyCandidate = null;
  let lockTail = Promise.resolve();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem('careflow-os-demo-v1'));
      if (saved && Array.isArray(saved.beds) && Array.isArray(saved.queue)) return { ...seed, ...saved };
    } catch (_) { /* use the sample scenario */ }
    return structuredClone(seed);
  }
  function saveState() {
    try { localStorage.setItem('careflow-os-demo-v1', JSON.stringify(state)); } catch (_) { /* storage may be disabled */ }
  }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = name => String(name || '?').split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  const totalBeds = () => state.beds.length;
  const occupiedBeds = () => state.beds.filter(b => b.patient).length;
  const freeBeds = () => totalBeds() - occupiedBeds();
  const sortedQueue = () => [...state.queue].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.arrival - b.arrival);
  const priorityRank = p => ({ emergency: 0, urgent: 1, routine: 2 }[p] ?? 3);
  const priorityLabel = p => ({ emergency: 'Emergency', urgent: 'Urgent', routine: 'Routine' }[p] || 'Routine');
  const wardBeds = ward => state.beds.filter(b => b.ward === ward);
  const byId = id => state.beds.find(b => b.id === id);
  const wardOrder = () => WARDS.map(w => w.name);

  function render() {
    renderStats(); renderWardSummary(); renderQueuePreview(); renderActivity(); renderBedBoard(); renderFullQueue(); renderMemoryMap(); renderConcepts(); renderBankerTrace();
    document.getElementById('nav-bed-count').textContent = totalBeds();
    document.getElementById('nav-queue-count').textContent = state.queue.length;
    document.getElementById('queue-capacity-label').innerHTML = `${state.queue.length} <span>/ ${QUEUE_LIMIT}</span>`;
    document.getElementById('queue-capacity-fill').style.width = `${Math.min(100, state.queue.length / QUEUE_LIMIT * 100)}%`;
    document.getElementById('modal-queue-space').textContent = `${QUEUE_LIMIT - state.queue.length} ${QUEUE_LIMIT - state.queue.length === 1 ? 'space' : 'spaces'}`;
  }
  function renderStats() {
    document.getElementById('stat-total').textContent = totalBeds();
    document.getElementById('stat-available').textContent = freeBeds();
    document.getElementById('stat-occupied').textContent = occupiedBeds();
    document.getElementById('stat-queue').textContent = state.queue.length;
    document.getElementById('occupancy-foot').textContent = `${Math.round(occupiedBeds() / totalBeds() * 100)}% occupancy`;
    const emergencies = state.queue.filter(r => r.priority === 'emergency').length;
    document.getElementById('queue-foot').textContent = `${emergencies} emergency ${emergencies === 1 ? 'priority' : 'priorities'}`;
    document.getElementById('queue-heading-count').textContent = String(state.queue.length).padStart(2, '0');
    document.getElementById('queue-full-count').textContent = String(state.queue.length).padStart(2, '0');
  }
  function renderWardSummary() {
    document.getElementById('ward-list').innerHTML = WARDS.map(w => {
      const beds = wardBeds(w.name), occupied = beds.filter(b => b.patient).length;
      return `<div class="ward-row"><div class="ward-label"><strong>${w.name}</strong><small>${beds.length} bed capacity</small></div><div class="bed-strip" aria-label="${occupied} of ${beds.length} beds occupied">${beds.map(b => `<i class="bed-cell ${b.patient ? 'occupied' : ''}" title="${esc(b.id)}${b.patient ? ` · ${esc(b.patient)}` : ' · available'}"></i>`).join('')}</div><div class="ward-count"><strong>${beds.length - occupied}</strong> free <span>· ${occupied} in use</span></div></div>`;
    }).join('');
  }
  function queueCard(r) {
    return `<div class="queue-item"><div class="queue-avatar">${esc(initials(r.name))}</div><div class="queue-details"><strong>${esc(r.name)}</strong><small>${esc(r.ward)} · ${r.beds} ${r.beds === 1 ? 'bed' : 'beds'}${r.equipment === 'ventilator' ? ' · ventilator' : ''}</small></div><span class="priority ${esc(r.priority)}">${priorityLabel(r.priority)}</span></div>`;
  }
  function renderQueuePreview() {
    const queue = sortedQueue();
    document.getElementById('queue-preview').innerHTML = queue.length ? queue.slice(0, 4).map(queueCard).join('') : '<div class="empty-state">No waiting requests</div>';
  }
  function renderActivity() {
    document.getElementById('activity-list').innerHTML = state.activity.slice(0, 4).map(a => `<div class="activity-row"><div class="activity-icon ${a.type === 'wait' ? 'wait' : ''}">${esc(a.icon)}</div><div class="activity-copy">${a.text}</div><span class="activity-time">${esc(a.time)}</span></div>`).join('');
  }
  function renderBedBoard() {
    const list = WARDS.filter(w => currentFilter === 'all' || w.name === currentFilter);
    document.getElementById('bed-wards').innerHTML = list.map(w => `<section class="panel bed-ward"><div class="bed-ward-head"><h2>${w.name} <span class="small-count">${wardBeds(w.name).filter(b => !b.patient).length} free</span></h2><span>${wardBeds(w.name).length} beds · ${wardBeds(w.name).filter(b => b.patient).length} occupied</span></div><div class="bed-grid">${wardBeds(w.name).map(b => `<button class="bed-card ${b.patient ? 'occupied' : 'free'}" data-bed="${esc(b.id)}" title="${b.patient ? 'Discharge ' + esc(b.patient) : 'Available bed'}"><i class="bed-status"></i><strong>${esc(b.id)}</strong><small class="bed-occupant">${b.patient ? esc(b.patient) : 'Available'}</small></button>`).join('')}</div></section>`).join('');
  }
  function renderFullQueue() {
    const queue = sortedQueue();
    document.getElementById('queue-empty').classList.toggle('hidden', queue.length > 0);
    document.getElementById('full-queue-list').innerHTML = queue.map((r, i) => `<div class="full-queue-row"><span class="queue-position">${String(i + 1).padStart(2, '0')}</span><div class="queue-meta"><strong>${esc(r.name)} <span class="priority ${esc(r.priority)}">${priorityLabel(r.priority)}</span></strong><small>${esc(r.id)} · ${esc(r.ward)}${r.equipment === 'ventilator' ? ' · Ventilator' : ''}</small></div><span class="queue-requirement">${r.beds} ${r.beds === 1 ? 'bed' : 'adjacent beds'}</span><span class="queue-arrival">${timeAgo(r.arrival)}</span><div class="queue-actions"><button class="tiny-button" data-process="${esc(r.id)}">Assign</button><button class="tiny-button" data-remove="${esc(r.id)}" aria-label="Remove request">×</button></div></div>`).join('');
    document.getElementById('process-queue').disabled = processing || !queue.length;
    document.getElementById('process-queue').textContent = processing ? 'Processing…' : '▶ Process queue';
  }
  function timeAgo(timestamp) {
    const mins = Math.max(1, Math.round((Date.now() - Number(timestamp)) / 60000));
    return mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)} hr ago`;
  }
  function renderMemoryMap() {
    document.getElementById('memory-map').innerHTML = WARDS.map(w => `<div class="map-ward"><span class="map-ward-label">${w.name}</span><div class="map-slots">${wardBeds(w.name).map(b => `<i class="map-slot ${b.patient ? 'occupied' : ''}" title="${esc(b.id)} ${b.patient ? 'allocated' : 'free'}"></i>`).join('')}</div></div>`).join('');
  }
  function renderConcepts() {
    const buffer = document.getElementById('mini-buffer');
    if (buffer) buffer.innerHTML = Array.from({ length: QUEUE_LIMIT }, (_, i) => `<i class="${i < state.queue.length ? 'filled' : ''}"></i>`).join('');
    const caption = document.getElementById('buffer-caption');
    if (caption) caption.textContent = `${state.queue.length} of ${QUEUE_LIMIT} slots used`;
    const sequenceLabel = document.getElementById('safe-sequence');
    if (sequenceLabel) {
      const check = bankersCheck();
      sequenceLabel.textContent = check.safe ? `Safe sequence: ${check.sequence.join(' → ') || 'No active processes'}` : `Blocked: ${check.blocked.join(', ')}`;
    }
  }

  function addActivity(text, icon = '✓', type = 'ok') {
    const now = new Date();
    state.activity.unshift({ icon, type, text, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    state.activity = state.activity.slice(0, 8);
  }
  function showToast(message, tone = 'success') {
    const toast = document.createElement('div'); toast.className = 'toast';
    toast.innerHTML = `<i style="background:${tone === 'error' ? '#e98178' : '#52c49a'}"></i>${esc(message)}`;
    document.getElementById('toast-region').appendChild(toast);
    setTimeout(() => toast.remove(), 3600);
  }
  function openModal() {
    if (state.queue.length >= QUEUE_LIMIT) { showToast('The bounded queue is full. Process requests to make space.', 'error'); return; }
    document.getElementById('request-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('patient-name').focus(), 20);
  }
  function closeModal() { document.getElementById('request-modal').classList.add('hidden'); document.getElementById('request-form').reset(); }
  function addRequest(event) {
    event.preventDefault();
    if (state.queue.length >= QUEUE_LIMIT) { closeModal(); showToast('The request queue is full.', 'error'); return; }
    const name = document.getElementById('patient-name').value.trim();
    if (!name) return;
    const request = { id: `RQ-${state.nextRequest++}`, name, ward: document.getElementById('patient-ward').value, priority: document.getElementById('patient-priority').value, beds: Number(document.getElementById('patient-beds').value), equipment: document.getElementById('patient-equipment').value, arrival: Date.now() };
    state.queue.push(request);
    addActivity(`<strong>${esc(name)}</strong> added to the ${priorityLabel(request.priority).toLowerCase()} queue`, '◷', 'wait');
    saveState(); render(); closeModal(); showToast(`${name} added to the priority queue.`);
  }

  function getRuns(ward) {
    return wardBeds(ward).reduce((runs, bed, index, beds) => {
      if (!bed.patient) {
        const last = runs[runs.length - 1];
        if (last && last.end === index - 1) { last.end = index; last.length++; }
        else runs.push({ ward, start: index, end: index, length: 1, startId: bed.id });
      }
      return runs;
    }, []);
  }
  function findFit(request, strategy) {
    const wards = request.ward === 'Any' || request.ward === 'all' ? WARDS.map(w => w.name) : [request.ward];
    const runs = wards.flatMap(w => getRuns(w)).filter(run => run.length >= request.beds);
    if (!runs.length) return null;
    if (strategy === 'best') runs.sort((a, b) => a.length - b.length || wardOrder().indexOf(a.ward) - wardOrder().indexOf(b.ward) || a.start - b.start);
    else if (strategy === 'worst') runs.sort((a, b) => b.length - a.length || wardOrder().indexOf(a.ward) - wardOrder().indexOf(b.ward) || a.start - b.start);
    else runs.sort((a, b) => wardOrder().indexOf(a.ward) - wardOrder().indexOf(b.ward) || a.start - b.start);
    return runs[0];
  }
  function allocateBeds(request, run) {
    const beds = wardBeds(run.ward);
    for (let i = run.start; i < run.start + request.beds; i++) { beds[i].patient = request.name; beds[i].equipment = request.equipment || 'none'; }
  }

  // A small Banker's safety check models the resource manager before a grant.
  // Existing patients have no additional unmet need; the candidate's maximum claim is its request vector.
  function resourceVectorForPatient(patient, beds) {
    const vector = [beds.length, 0, beds.length, beds.filter(b => b.ward === 'Isolation').length];
    if (beds.some(b => b.ward === 'Ventilator' || b.equipment === 'ventilator')) vector[1] = 1;
    return vector;
  }
  function bankersCheck(request = null) {
    const resourceKeys = ['beds', 'ventilators', 'nurses', 'isolation'];
    const total = resourceKeys.map(key => RESOURCE_TOTAL[key]);
    const patients = [...new Set(state.beds.filter(b => b.patient).map(b => b.patient))].map((name, index) => {
      const held = state.beds.filter(b => b.patient === name);
      const allocation = resourceVectorForPatient(name, held);
      return { id: `P${index + 1}`, name, allocation, maximum: [...allocation], need: [0, 0, 0, 0], candidate: false };
    });
    if (request) {
      const maximum = [request.beds, request.equipment === 'ventilator' || request.ward === 'Ventilator' ? 1 : 0, request.beds, request.ward === 'Isolation' ? request.beds : 0];
      patients.push({ id: 'NEW', name: request.name, allocation: [0, 0, 0, 0], maximum, need: [...maximum], candidate: true });
    }
    const allocated = total.map((_, column) => patients.reduce((sum, process) => sum + process.allocation[column], 0));
    const available = total.map((amount, i) => amount - allocated[i]);
    const work = [...available];
    const pending = [...patients];
    const sequence = [];
    while (pending.length) {
      const index = pending.findIndex(process => process.need.every((need, column) => need <= work[column]));
      if (index < 0) break;
      const [process] = pending.splice(index, 1);
      work.forEach((_, column) => { work[column] += process.allocation[column]; });
      sequence.push(process.id);
    }
    const safe = pending.length === 0;
    return { safe, available, total, processes: patients, sequence, blocked: pending.map(process => process.id), keys: resourceKeys };
  }
  function renderBankerTrace(snapshot = null) {
    const matrix = document.getElementById('banker-matrix');
    if (!matrix) return;
    if (lastSafetyCandidate && !state.queue.some(request => request.id === lastSafetyCandidate.id)) lastSafetyCandidate = null;
    const check = snapshot || bankersCheck(lastSafetyCandidate);
    const statePill = document.getElementById('banker-state');
    statePill.classList.toggle('unsafe', !check.safe);
    statePill.innerHTML = `<i></i> ${check.safe ? 'Safe state' : 'Unsafe claim'}`;
    const vectorText = v => `(${v.join(', ')})`;
    matrix.innerHTML = check.processes.length ? check.processes.map(process => `<tr><td>${process.id} · ${esc(process.name)}${process.candidate ? ' <span class="winner-badge">REQUEST</span>' : ''}</td><td>${vectorText(process.allocation)}</td><td>${vectorText(process.maximum)}</td><td>${vectorText(process.need)}</td><td class="${check.blocked.includes(process.id) ? 'blocked' : ''}">${check.blocked.includes(process.id) ? 'Wait' : 'Can finish'}</td></tr>`).join('') : '<tr><td class="banker-empty" colspan="5">No active allocations. The resource pool is fully available.</td></tr>';
    document.getElementById('banker-available').textContent = `B ${check.available[0]} · V ${check.available[1]} · N ${check.available[2]} · I ${check.available[3]}`;
    document.getElementById('banker-sequence').textContent = check.sequence.length ? check.sequence.join(' → ') : (check.safe ? 'No active processes' : `Blocked: ${check.blocked.join(', ')}`);
  }
  function assignRequest(id) {
    const request = state.queue.find(r => r.id === id);
    if (!request) return false;
    const fit = findFit(request, document.querySelector('input[name="strategy"]:checked')?.value || 'first');
    if (!fit) { showToast(`No adjacent ${request.ward} beds are available for ${request.name}.`, 'error'); return false; }
    const safety = bankersCheck(request);
    if (!safety.safe) { showToast('Safety check paused this request: shared resources are insufficient.', 'error'); return false; }
    allocateBeds(request, fit);
    state.queue = state.queue.filter(r => r.id !== id);
    const assigned = wardBeds(fit.ward).slice(fit.start, fit.start + request.beds).map(b => b.id).join(', ');
    addActivity(`<strong>${esc(request.name)}</strong> assigned to ${fit.ward} · ${assigned}`);
    saveState(); render();
    showToast(`${request.name} assigned to ${fit.ward}. Banker's check passed.`);
    return true;
  }
  function releaseBed(id) {
    const bed = byId(id);
    if (!bed?.patient) return;
    const name = bed.patient;
    const released = state.beds.filter(item => item.patient === name);
    released.forEach(item => { item.patient = null; item.equipment = 'none'; });
    addActivity(`<strong>${esc(name)}</strong> discharged · ${released.map(item => item.id).join(', ')} released`, '↗');
    saveState(); render(); showToast(`${name} discharged. ${released.length} ${released.length === 1 ? 'bed is' : 'beds are'} available again.`);
  }
  async function withMutex(task) {
    let unlock;
    const previous = lockTail;
    lockTail = new Promise(resolve => { unlock = resolve; });
    await previous;
    try { return task(); } finally { unlock(); }
  }
  function processQueue() {
    if (processing || !state.queue.length) return;
    processing = true; renderFullQueue();
    const workers = 3;
    const jobs = sortedQueue().map((request, index) => ({ request, workerNo: index % workers + 1 }));
    const readyResolvers = [];
    let commitTail = Promise.resolve();
    const commits = jobs.map((job, index) => {
      let markReady;
      const ready = new Promise(resolve => { markReady = resolve; });
      readyResolvers[index] = markReady;
      const commit = commitTail.then(() => ready).then(() => withMutex(() => {
        const liveRequest = state.queue.find(r => r.id === job.request.id);
        if (!liveRequest) return;
        const fit = findFit(liveRequest, document.querySelector('input[name="strategy"]:checked')?.value || 'first');
        const safety = fit && bankersCheck(liveRequest);
        if (!fit || !safety.safe) {
          showToast(`${liveRequest.name} remains queued: no safe matching bed block.`, 'error');
          return;
        }
        allocateBeds(liveRequest, fit);
        state.queue = state.queue.filter(r => r.id !== liveRequest.id);
        const assigned = wardBeds(fit.ward).slice(fit.start, fit.start + liveRequest.beds).map(b => b.id).join(', ');
        addActivity(`<strong>${esc(liveRequest.name)}</strong> assigned to ${fit.ward} · ${assigned}`);
        saveState(); render();
        showToast(`${liveRequest.name} assigned by Worker ${String(job.workerNo).padStart(2, '0')}.`);
      }));
      commitTail = commit;
      return commit;
    });
    const preparations = jobs.map(async (job, index) => {
      setWorkerStatus(job.workerNo, 'busy');
      await new Promise(resolve => setTimeout(resolve, 500 + (index % workers) * 110));
      readyResolvers[index]();
      await commits[index];
      setWorkerStatus(job.workerNo, 'idle');
      renderFullQueue();
    });
    Promise.all(preparations).finally(() => {
      processing = false; renderFullQueue();
      document.querySelector('.queue-process-bar').innerHTML = '<div><span class="pulse"></span>Worker pool ready</div><span>3 workers · Priority scheduling</span>';
      render();
    });
  }
  function setWorkerStatus(n, status) {
    const bar = document.querySelector('.queue-process-bar');
    if (!bar) return;
    bar.innerHTML = `<div><span class="pulse"></span>Worker ${String(n).padStart(2, '0')} ${status === 'busy' ? 'in critical section' : 'released lock'}</div><span>Mutex ${status === 'busy' ? 'locked' : 'available'} · Semaphore active</span>`;
  }

  function runLab() {
    const selectedWard = document.getElementById('lab-ward').value;
    const strategyNames = { first: 'First Fit', best: 'Best Fit', worst: 'Worst Fit' };
    const wardNames = selectedWard === 'all' ? WARDS.map(w => w.name) : [selectedWard];
    const runs = wardNames.flatMap(ward => getRuns(ward)).sort((a, b) => wardOrder().indexOf(a.ward) - wardOrder().indexOf(b.ward) || a.start - b.start);
    const freeCount = runs.reduce((sum, run) => sum + run.length, 0);
    const largestBlock = runs.reduce((largest, run) => Math.max(largest, run.length), 0);
    const externalFragmentation = freeCount ? Math.round((1 - largestBlock / freeCount) * 100) : 0;
    const results = Object.keys(strategyNames).map(strategy => {
      const run = findFit({ ward: selectedWard, beds: labBedCount }, strategy);
      const strategyRuns = [...runs];
      if (strategy === 'best') strategyRuns.sort((a, b) => a.length - b.length || wardOrder().indexOf(a.ward) - wardOrder().indexOf(b.ward) || a.start - b.start);
      if (strategy === 'worst') strategyRuns.sort((a, b) => b.length - a.length || wardOrder().indexOf(a.ward) - wardOrder().indexOf(b.ward) || a.start - b.start);
      const pickedIndex = run ? strategyRuns.findIndex(r => r.ward === run.ward && r.start === run.start) : -1;
      return { strategy, label: strategyNames[strategy], run, searchSteps: strategy === 'first' ? (pickedIndex < 0 ? strategyRuns.length : pickedIndex + 1) : strategyRuns.length, residual: run ? run.length - labBedCount : null };
    });
    const possible = results.filter(x => x.run);
    const winner = possible.length ? possible.reduce((a, b) => a.residual <= b.residual ? a : b).strategy : null;
    latestExperiment = { at: new Date(), ward: selectedWard, requested: labBedCount, freeCount, largestBlock, externalFragmentation, results };
    document.getElementById('results-placeholder').classList.add('hidden');
    const container = document.getElementById('strategy-results'); container.classList.remove('hidden');
    container.innerHTML = `<div class="result-summary"><div class="result-summary-card"><span>Free bed slots</span><strong>${freeCount}</strong></div><div class="result-summary-card"><span>Largest contiguous block</span><strong>${largestBlock}</strong></div><div class="result-summary-card"><span>External fragmentation</span><strong>${externalFragmentation}%</strong></div></div><div class="evaluation-table-wrap"><table class="evaluation-table"><thead><tr><th>Strategy</th><th>Outcome</th><th>Placement</th><th>Runs scanned</th><th>Residual gap</th></tr></thead><tbody>${results.map(x => `<tr class="${winner === x.strategy ? 'winner' : ''}"><td>${x.label}${winner === x.strategy ? '<span class="winner-badge">TIGHTEST FIT</span>' : ''}</td><td>${x.run ? 'Fit found' : 'No fit'}</td><td>${x.run ? `${x.run.ward} · ${wardBeds(x.run.ward)[x.run.start].id}` : '—'}</td><td>${x.searchSteps} / ${runs.length}</td><td>${x.residual === null ? '—' : `${x.residual} slot${x.residual === 1 ? '' : 's'}`}</td></tr>`).join('')}</tbody></table></div><div class="evaluation-insight"><span>ⓘ</span><span><strong>Interpretation:</strong> External fragmentation is estimated as 1 − (largest free block ÷ total free slots). The marked strategy leaves the smallest residual block for this request. Run a few request sizes to compare how results change.</span></div>`;
    document.getElementById('export-lab').disabled = false;
    showToast('Strategy comparison complete. Bed assignments were not changed.');
  }
  function exportExperiment() {
    if (!latestExperiment) return;
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [['Careflow OS PBL experiment'], ['Timestamp', latestExperiment.at.toISOString()], ['Requested beds', latestExperiment.requested], ['Ward scope', latestExperiment.ward], ['Total free slots', latestExperiment.freeCount], ['Largest contiguous block', latestExperiment.largestBlock], ['Estimated external fragmentation (%)', latestExperiment.externalFragmentation], [], ['Strategy', 'Outcome', 'Placement', 'Runs scanned', 'Residual gap']];
    latestExperiment.results.forEach(result => rows.push([result.label, result.run ? 'Fit found' : 'No fit', result.run ? `${result.run.ward} ${wardBeds(result.run.ward)[result.run.start].id}` : '', result.searchSteps, result.residual ?? '']));
    const csv = rows.map(row => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'careflow-allocation-experiment.csv'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function probeNextRequest() {
    const request = sortedQueue()[0];
    if (!request) { lastSafetyCandidate = null; renderBankerTrace(bankersCheck()); showToast('There are no queued requests to check.', 'error'); return; }
    lastSafetyCandidate = request;
    const result = bankersCheck(request);
    renderBankerTrace(result);
    showToast(result.safe ? `${request.name}: safe sequence found.` : `${request.name}: claim would leave an unsafe state.`, result.safe ? 'success' : 'error');
  }
  function navigate(view) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.toggle('active', p.id === `view-${view}`));
    document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view === view));
    const labels = { overview: 'Overview', beds: 'Bed board', requests: 'Patient requests', lab: 'Allocation lab', concepts: 'OS concepts' };
    document.getElementById('crumb-current').textContent = labels[view] || 'Overview';
    if (view === 'beds') renderBedBoard();
    if (view === 'lab') renderMemoryMap();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.view)));
  document.querySelectorAll('[data-goto]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.goto)));
  ['open-request', 'open-request-beds', 'open-request-queue'].forEach(id => document.getElementById(id).addEventListener('click', openModal));
  ['close-modal', 'cancel-modal'].forEach(id => document.getElementById(id).addEventListener('click', closeModal));
  document.getElementById('request-modal').addEventListener('click', e => { if (e.target.id === 'request-modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  document.getElementById('request-form').addEventListener('submit', addRequest);
  document.getElementById('process-queue').addEventListener('click', processQueue);
  document.getElementById('full-queue-list').addEventListener('click', e => {
    const assign = e.target.closest('[data-process]'); const remove = e.target.closest('[data-remove]');
    if (assign) assignRequest(assign.dataset.process);
    if (remove) { const req = state.queue.find(r => r.id === remove.dataset.remove); state.queue = state.queue.filter(r => r.id !== remove.dataset.remove); if (req) addActivity(`<strong>${esc(req.name)}</strong> request removed from queue`, '×', 'wait'); saveState(); render(); showToast('Request removed from the queue.'); }
  });
  document.getElementById('bed-wards').addEventListener('click', e => { const card = e.target.closest('[data-bed]'); if (card && byId(card.dataset.bed)?.patient) releaseBed(card.dataset.bed); });
  document.getElementById('ward-filters').addEventListener('click', e => { const chip = e.target.closest('[data-filter]'); if (!chip) return; currentFilter = chip.dataset.filter; document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('selected', c === chip)); renderBedBoard(); });
  document.getElementById('lab-minus').addEventListener('click', () => { labBedCount = Math.max(1, labBedCount - 1); document.getElementById('lab-size-display').textContent = labBedCount; });
  document.getElementById('lab-plus').addEventListener('click', () => { labBedCount = Math.min(3, labBedCount + 1); document.getElementById('lab-size-display').textContent = labBedCount; });
  document.getElementById('run-lab').addEventListener('click', runLab);
  document.getElementById('export-lab').addEventListener('click', exportExperiment);
  document.getElementById('probe-bankers').addEventListener('click', probeNextRequest);
  render();
})();

