"""
Ingest PDFs from ./pdfs into Supabase as math-aware RAG chunks.

Pipeline:  marker_single (PDF -> Markdown w/ LaTeX)
        -> paragraph-pack chunks (LaTeX blocks kept intact)
        -> Voyage voyage-3 embeddings (1024 dim)
        -> upsert into stp_math_docs / stp_math_chunks via service-role key

Re-ingesting the same filename wipes its old chunks first, so this script is
idempotent: drop PDFs in ./pdfs, run it, done.

Usage:
    pip install -r scripts/requirements.txt
    # Add to .env at repo root:
    #   VITE_SUPABASE_URL=...
    #   SUPABASE_SERVICE_ROLE_KEY=...   (from Supabase project settings, NEVER ship)
    #   VOYAGE_API_KEY=...              (from voyageai.com)
    python scripts/ingest_pdfs.py
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import voyageai
from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = REPO_ROOT / "pdfs"

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY")

EMBED_MODEL = "voyage-3"
CHUNK_TARGET_CHARS = 1200
CHUNK_MAX_CHARS = 2000
EMBED_BATCH = 64


def _require_env() -> None:
    missing = [
        k
        for k, v in {
            "VITE_SUPABASE_URL": SUPABASE_URL,
            "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_SERVICE_KEY,
            "VOYAGE_API_KEY": VOYAGE_API_KEY,
        }.items()
        if not v
    ]
    if missing:
        print(f"!! Missing env var(s): {', '.join(missing)}", file=sys.stderr)
        print("   Put them in .env at the repo root.", file=sys.stderr)
        sys.exit(1)


def run_marker(pdf_path: Path, out_dir: Path) -> tuple[Path, dict]:
    """Run `marker_single` CLI; return (markdown_path, metadata_dict)."""
    cmd = [
        "marker_single",
        str(pdf_path),
        "--output_dir",
        str(out_dir),
        "--output_format",
        "markdown",
    ]
    print(f"  marker: {' '.join(cmd)}")
    subprocess.run(cmd, check=True)

    stem = pdf_path.stem
    candidate = out_dir / stem / f"{stem}.md"
    if not candidate.exists():
        # Marker version differences: fall back to first .md under the stem dir.
        md_paths = list((out_dir / stem).glob("*.md"))
        if not md_paths:
            raise RuntimeError(f"Marker produced no markdown for {pdf_path}")
        candidate = md_paths[0]

    meta: dict = {}
    meta_path = out_dir / stem / f"{stem}_meta.json"
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return candidate, meta


MATH_BLOCK_RE = re.compile(r"\$\$.*?\$\$", re.DOTALL)


def split_paragraphs(markdown: str) -> list[str]:
    """Paragraph split that keeps $$...$$ blocks intact even if they span blank lines."""
    placeholders: dict[str, str] = {}

    def stash(m: re.Match[str]) -> str:
        key = f"\x00MATH{len(placeholders)}\x00"
        placeholders[key] = m.group(0)
        return key

    protected = MATH_BLOCK_RE.sub(stash, markdown)
    paras = re.split(r"\n\s*\n", protected)
    out: list[str] = []
    for p in paras:
        for k, v in placeholders.items():
            p = p.replace(k, v)
        p = p.strip()
        if p:
            out.append(p)
    return out


def chunk_markdown(md: str) -> list[str]:
    """Greedy paragraph packing toward CHUNK_TARGET_CHARS, hard cap at CHUNK_MAX_CHARS."""
    chunks: list[str] = []
    buf: list[str] = []
    buf_len = 0
    for para in split_paragraphs(md):
        plen = len(para)
        if buf and buf_len + plen + 2 > CHUNK_MAX_CHARS:
            chunks.append("\n\n".join(buf))
            buf, buf_len = [], 0
        buf.append(para)
        buf_len += plen + 2
        if buf_len >= CHUNK_TARGET_CHARS:
            chunks.append("\n\n".join(buf))
            buf, buf_len = [], 0
    if buf:
        chunks.append("\n\n".join(buf))
    return chunks


def upsert_doc(
    sb: Client, filename: str, title: str | None, page_count: int | None
) -> str:
    """Insert (or fetch) the parent doc row, wiping prior chunks for re-ingest."""
    existing = (
        sb.table("stp_math_docs")
        .select("id")
        .eq("filename", filename)
        .limit(1)
        .execute()
    )
    if existing.data:
        doc_id = existing.data[0]["id"]
        sb.table("stp_math_chunks").delete().eq("doc_id", doc_id).execute()
        sb.table("stp_math_docs").update(
            {"title": title, "page_count": page_count}
        ).eq("id", doc_id).execute()
        return doc_id

    inserted = (
        sb.table("stp_math_docs")
        .insert(
            {
                "filename": filename,
                "title": title or filename,
                "source_path": f"pdfs/{filename}",
                "page_count": page_count,
            }
        )
        .execute()
    )
    return inserted.data[0]["id"]


def ingest_pdf(sb: Client, vo: voyageai.Client, pdf_path: Path) -> None:
    print(f"\n[+] {pdf_path.name}")
    with tempfile.TemporaryDirectory() as tmp:
        out_dir = Path(tmp)
        try:
            md_path, meta = run_marker(pdf_path, out_dir)
        except subprocess.CalledProcessError as e:
            print(f"    ! marker failed: {e}", file=sys.stderr)
            return
        md = md_path.read_text(encoding="utf-8")

    chunks = chunk_markdown(md)
    print(f"    {len(chunks)} chunks")
    if not chunks:
        return

    page_count = meta.get("page_count")
    title = meta.get("title") or pdf_path.stem.replace("_", " ").replace("-", " ")
    doc_id = upsert_doc(sb, pdf_path.name, title, page_count)

    for batch_start in range(0, len(chunks), EMBED_BATCH):
        batch = chunks[batch_start : batch_start + EMBED_BATCH]
        embeddings = vo.embed(batch, model=EMBED_MODEL, input_type="document").embeddings
        rows = [
            {
                "doc_id": doc_id,
                "chunk_index": batch_start + i,
                "content": text,
                "embedding": emb,
            }
            for i, (text, emb) in enumerate(zip(batch, embeddings))
        ]
        sb.table("stp_math_chunks").insert(rows).execute()
        print(f"    inserted {batch_start + len(batch)}/{len(chunks)}")


def main() -> None:
    _require_env()
    if not PDF_DIR.exists():
        print(f"!! Folder not found: {PDF_DIR}", file=sys.stderr)
        sys.exit(1)
    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs in {PDF_DIR}. Drop some .pdf files there and re-run.")
        return
    if shutil.which("marker_single") is None:
        print(
            "!! marker_single not on PATH. Run `pip install -r scripts/requirements.txt` first.",
            file=sys.stderr,
        )
        sys.exit(1)

    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    vo = voyageai.Client(api_key=VOYAGE_API_KEY)

    print(f"Ingesting {len(pdfs)} PDF(s) from {PDF_DIR}")
    for p in pdfs:
        try:
            ingest_pdf(sb, vo, p)
        except Exception as e:
            # One bad PDF shouldn't kill the batch.
            print(f"  ! failed on {p.name}: {e}", file=sys.stderr)

    print("\nDone.")


if __name__ == "__main__":
    main()
