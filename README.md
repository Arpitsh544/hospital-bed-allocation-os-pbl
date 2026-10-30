# Careflow — Hospital Bed Allocation OS PBL

Careflow is a browser-based academic prototype for demonstrating operating system ideas through hospital bed allocation.

## Run it

Open `index.html` in a modern browser to explore the app. The local `file://` preview uses a single-thread fallback because browsers restrict loading Web Workers from local files. For the actual multithreaded demo, open the hosted HTTPS app: `https://arpitsh544.github.io/hospital-bed-allocation-os-pbl/`. The sample board and requests are stored in browser storage; clear the site's storage to restore the original sample scenario.

## What to demonstrate

- **Priority scheduling and bounded buffer:** Add patient requests to the 8-slot queue, then process them in emergency, urgent, and routine order.
- **Real browser threads:** On HTTPS, up to three dedicated Web Workers analyze request snapshots in parallel. Workers do not access the page's shared bed records.
- **Synchronization:** After parallel planning, the browser main thread rechecks each request against the live board and serializes bed updates through a JavaScript promise lock. Capacity checks model limits on beds, nurses, ventilators, and isolation spaces.
- **Deadlock avoidance:** A Banker's safety check evaluates the resource claim before a request is assigned.
- **Memory allocation:** The Allocation Lab compares First Fit, Best Fit, and Worst Fit for a contiguous bed block. The ward map represents segments and each bed slot represents a page/partition; scattered gaps illustrate external fragmentation.
- **Readers–writers:** The OS Concepts page explains the shared-board idea. In this prototype, reads and writes happen through the browser UI, and writes are serialized on the main thread.
- **Resource lifecycle:** Assign requests from the queue and click an occupied bed on the Bed Board to discharge its patient and release capacity.

## Scope

This is an interactive teaching model, not clinical software. It uses sample patients and browser storage. Web Workers are genuine browser background threads for parallel analysis on the hosted HTTPS app. The shared bed records remain on the main thread, which rechecks and serializes assignments. The JavaScript promise lock and resource-capacity checks model synchronization; they are not native operating-system mutex or semaphore primitives.

## Experiment and evaluation tools

The Allocation Lab reports free capacity, the largest contiguous block, estimated external fragmentation, blocks scanned, and leftover space for each fit strategy. Use **Download CSV** to export the current scenario and comparison table for a lab report or presentation.

The OS Concepts view includes a Banker's Algorithm matrix. **Check next request** tests the highest-priority queued request and displays Allocation, Maximum, Need, Available, and the computed safe sequence. The check is a teaching model: active patients are treated as having no additional future claim beyond their current allocation, while the candidate request is checked against its stated claim.

## Project identity

Course: Operating System (CCSEH0303A) · Programme: B.Tech CSE · Group: G-5

## GitHub Pages

The repository includes `.github/workflows/pages.yml` to deploy the static app on pushes to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. Once deployed, GitHub provides the URL `https://arpitsh544.github.io/hospital-bed-allocation-os-pbl/`.

