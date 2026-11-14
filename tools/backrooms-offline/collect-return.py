"""Create a changed-files ZIP against the supplied source manifest; no Git needed."""
import hashlib
import json
from pathlib import Path
import zipfile

kit = Path(__file__).resolve().parent.parent
source = kit / 'source'
manifest = json.loads((kit / 'SOURCE_MANIFEST.json').read_text())
baseline = manifest['files']
ignored = {'.git', 'node_modules', '__pycache__', '.DS_Store', 'data', '.env', '.venv', '.pytest_cache'}
changed = []
current = set()
for file in sorted(source.rglob('*')):
    rel = file.relative_to(source)
    if file.is_symlink():
        raise SystemExit(f'Remove symlink before exporting: {rel}')
    if not file.is_file() or any(part in ignored for part in rel.parts):
        continue
    name = rel.as_posix()
    if name.startswith(('public/knowledge/', 'public/transcripts/')) or file.name.startswith('.env.'):
        continue
    current.add(name)
    digest = hashlib.sha256(file.read_bytes()).hexdigest()
    if baseline.get(name) != digest:
        changed.append(name)
deleted = [name for name in baseline if name not in current and not any(part in ignored for part in Path(name).parts)
           and not name.startswith(('public/knowledge/', 'public/transcripts/'))]
report = {'base_commit': manifest['base_commit'], 'changed_files': changed, 'deleted_files': deleted,
          'instruction': 'Review before integration. files/ contains replacements/new files; deletions are explicit here.'}
output = kit / 'gemini-backrooms-return.zip'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.writestr('RETURN.json', json.dumps(report, indent=2) + '\n')
    notes = kit / 'RETURN_NOTES.md'
    if notes.is_file():
        archive.write(notes, 'RETURN_NOTES.md')
    for name in changed:
        archive.write(source / name, 'files/' + name)
print(f'{output}\n{len(changed)} changed/new files; {len(deleted)} deletions. Review RETURN.json before sharing.')
