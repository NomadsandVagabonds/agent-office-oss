"""Export a pinned, tracked source snapshot plus offline Backrooms authoring notes."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--ref', default='e81f634a15ce7a3dafd27c5c092c587963d82d16')
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--references', type=Path)
args = parser.parse_args()
repo = Path(__file__).resolve().parents[2]
for required in ['START_HERE.md', 'AUTHORING.md', 'DESIGN_BRIEF.md', 'GEMINI_TASK.md', 'GEMINI_PROMPT.md', 'RETURN_NOTES.md', 'INSPIRATION.md', 'BASELINE_CHECKS.md']:
    if not (repo / 'docs/backrooms-lab' / required).is_file():
        raise SystemExit(f'Missing onboarding document: {required}')
commit = subprocess.check_output(['git', 'rev-parse', args.ref + '^{commit}'], cwd=repo, text=True).strip()
name = 'agent-office-backrooms-kit-' + commit[:7]
with tempfile.TemporaryDirectory(prefix='backrooms-kit-') as temp:
    kit = Path(temp) / name
    source = kit / 'source'
    source.mkdir(parents=True)
    snapshot = subprocess.check_output(['git', 'archive', '--format=tar', commit], cwd=repo)
    with tarfile.open(fileobj=io.BytesIO(snapshot)) as archive:
        # Export regular tracked files only, retaining vendored license notices.
        for member in archive.getmembers():
            if not member.isfile():
                continue
            rel = Path(member.name)
            if rel.is_absolute() or '..' in rel.parts:
                raise ValueError('Invalid archive path')
            if member.name.startswith(('data/', 'public/knowledge/', 'public/transcripts/')):
                continue
            target = source / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())
    files = {p.relative_to(source).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
             for p in sorted(source.rglob('*')) if p.is_file()}
    manifest = {'repository': 'https://github.com/NomadsandVagabonds/agent-office-oss',
                'base_commit': commit, 'source_branch_at_export': 'claude/determined-maxwell-ayvlut',
                'contribution_branch': 'codex/backrooms-expansion-lab', 'prepared_date': '2026-11-14',
                'files': files}
    (kit / 'SOURCE_MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n')
    for doc in (repo / 'docs/backrooms-lab').glob('*.md'):
        shutil.copy2(doc, kit / doc.name)
    (kit / 'tools').mkdir()
    for tool in ['preview.mjs', 'collect-return.py']:
        shutil.copy2(repo / 'tools/backrooms-offline' / tool, kit / 'tools' / tool)
    if args.references:
        (kit / 'references').mkdir()
        for image in sorted(args.references.glob('*.png')):
            shutil.copy2(image, kit / 'references' / image.name)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(kit.rglob('*')):
            if file.is_file():
                archive.write(file, file.relative_to(Path(temp)))
    print(json.dumps({'archive': str(args.output), 'base_commit': commit, 'source_files': len(files),
                      'bytes': args.output.stat().st_size}, indent=2))
