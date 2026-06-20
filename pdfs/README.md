# pdfs/

Drop math-bearing `*.pdf` files here, then run:

```powershell
python scripts/ingest_pdfs.py
```

Files in this folder are ignored by git (see `.gitignore`). The pipeline
re-ingests on each run — adding a new PDF won't re-process the ones already
embedded, and re-running with the same filename wipes that doc's old chunks
before inserting fresh ones.

See the top-level `README.md` § "Math RAG" for the full setup steps.
