/* Dedicated Web Worker: plans one request against an immutable bed snapshot. */
self.onmessage = event => {
  const { index, workerNo, request, beds, wards, resourceTotal, strategy } = event.data;
  const wardOrder = wards.map(ward => ward.name);
  const eligibleWards = request.ward === 'Any' || request.ward === 'all'
    ? wardOrder
    : [request.ward];

  const runs = eligibleWards.flatMap(ward => {
    const wardBeds = beds.filter(bed => bed.ward === ward);
    const freeRuns = [];
    wardBeds.forEach((bed, bedIndex) => {
      if (bed.patient) return;
      const last = freeRuns[freeRuns.length - 1];
      if (last && last.end === bedIndex - 1) {
        last.end = bedIndex;
        last.length++;
      } else {
        freeRuns.push({ ward, start: bedIndex, end: bedIndex, length: 1, startId: bed.id });
      }
    });
    return freeRuns;
  }).filter(run => run.length >= request.beds);

  if (strategy === 'best') {
    runs.sort((a, b) => a.length - b.length || wardOrder.indexOf(a.ward) - wardOrder.indexOf(b.ward) || a.start - b.start);
  } else if (strategy === 'worst') {
    runs.sort((a, b) => b.length - a.length || wardOrder.indexOf(a.ward) - wardOrder.indexOf(b.ward) || a.start - b.start);
  } else {
    runs.sort((a, b) => wardOrder.indexOf(a.ward) - wardOrder.indexOf(b.ward) || a.start - b.start);
  }
  const fit = runs[0] || null;

  const keys = ['beds', 'ventilators', 'nurses', 'isolation'];
  const total = keys.map(key => resourceTotal[key]);
  const patients = [...new Set(beds.filter(bed => bed.patient).map(bed => bed.patient))].map((name, patientIndex) => {
    const held = beds.filter(bed => bed.patient === name);
    const allocation = [held.length, 0, held.length, held.filter(bed => bed.ward === 'Isolation').length];
    if (held.some(bed => bed.ward === 'Ventilator' || bed.equipment === 'ventilator')) allocation[1] = 1;
    return { id: `P${patientIndex + 1}`, allocation, need: [0, 0, 0, 0] };
  });
  const maximum = [
    request.beds,
    request.equipment === 'ventilator' || request.ward === 'Ventilator' ? 1 : 0,
    request.beds,
    request.ward === 'Isolation' ? request.beds : 0
  ];
  patients.push({ id: 'NEW', allocation: [0, 0, 0, 0], need: maximum });

  const allocated = total.map((_, column) => patients.reduce((sum, patient) => sum + patient.allocation[column], 0));
  const work = total.map((amount, column) => amount - allocated[column]);
  const pending = [...patients];
  const sequence = [];
  while (pending.length) {
    const readyIndex = pending.findIndex(patient => patient.need.every((need, column) => need <= work[column]));
    if (readyIndex < 0) break;
    const [finished] = pending.splice(readyIndex, 1);
    finished.allocation.forEach((amount, column) => { work[column] += amount; });
    sequence.push(finished.id);
  }

  self.postMessage({
    index,
    requestId: request.id,
    workerNo,
    fit: fit ? { ward: fit.ward, start: fit.start, startId: fit.startId, length: fit.length } : null,
    safe: pending.length === 0,
    sequence,
    scanned: runs.length
  });
};

