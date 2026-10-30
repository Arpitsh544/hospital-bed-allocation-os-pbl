# Careflow — Hospital Bed Allocation OS PBL

Careflow is a browser-based academic prototype for demonstrating operating system ideas through hospital bed allocation.

## Run it

Open `index.html` in a modern browser. No installation or server is required. The sample bed board and requests are stored in the browser; use **Reset site data** in browser settings to restore the original sample scenario.

## What to demonstrate

- **Priority scheduling and bounded buffer:** Add patient requests, fill the 8-slot queue, then process requests with the three-worker pool.
- **Concurrency and synchronization:** The worker pool simulates concurrent request preparation. A mutex serializes the critical bed-record update, and a semaphore models limited shared resources.
- **Deadlock avoidance:** A Banker's safety check evaluates the resource claim before a request is assigned.
- **Memory allocation:** The Allocation Lab compares First Fit, Best Fit, and Worst Fit for a contiguous bed block. The ward map represents segments and each bed slot represents a page/partition; scattered gaps illustrate external fragmentation.
- **Readers–writers:** The OS Concepts page explains concurrent bed-board readers and exclusive allocation writes.
- **Resource lifecycle:** Assign requests from the queue and click an occupied bed on the Bed Board to discharge its patient and release capacity.

## Scope

This is an interactive teaching model, not clinical software. It uses sample patients and browser storage. The worker pool, mutex, semaphore, and Banker's check illustrate OS concepts in a single-browser app; they are not a hospital-grade resource manager or real operating-system threads.

## Experiment and evaluation tools

The Allocation Lab reports free capacity, the largest contiguous block, estimated external fragmentation, blocks scanned, and leftover space for each fit strategy. Use **Download CSV** to export the current scenario and comparison table for a lab report or presentation.

The OS Concepts view includes a Banker's Algorithm matrix. **Check next request** tests the highest-priority queued request and displays Allocation, Maximum, Need, Available, and the computed safe sequence. The check is a teaching model: active patients are treated as having no additional future claim beyond their current allocation, while the candidate request is checked against its stated claim.

## Project identity

Course: Operating System (CCSEH0303A) · Programme: B.Tech CSE · Group: G-5

## GitHub Pages

The repository includes `.github/workflows/pages.yml` to deploy the static app on pushes to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. Once deployed, GitHub provides a URL at `https://<owner>.github.io/<repository>/`.

