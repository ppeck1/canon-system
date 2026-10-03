"""Assemble the observatory as one offline UTF-8/LF HTML document."""
from pathlib import Path
from hashlib import sha256
import base64
import json
import re

ROOT = Path(__file__).resolve().parent
NEWLINE_POLICY = 'UTF-8 without BOM; template/code CRLF and CR become LF; binary HTML output; raw evidence bytes and fingerprints unchanged.'
MODEL_FINGERPRINT_POLICY = 'SHA-256 of model.js decoded as UTF-8, CRLF/CR normalized to LF, then UTF-8 encoded; no other rewriting.'
TEXT_INPUTS = ('shell.html', 'model.js', 'form.js', 'app.js')
TOKENS = ('__DATA__', '__MODEL__', '__FORM__', '__APP__')


def digest(raw):
    return sha256(raw).hexdigest()


def canonical_text(path):
    return path.read_bytes().decode('utf-8').replace('\r\n', '\n').replace('\r', '\n')


def embedded_data(root):
    lake_raw = (root / 'data/lakes.json').read_bytes()
    music_raw = (root / 'data/music.json').read_bytes()
    wav_raw = (root / 'data/music.wav').read_bytes()
    lakes, music = json.loads(lake_raw), json.loads(music_raw)
    raw_files = [{key: file[key] for key in ('id', 'path', 'sha256', 'bytes')}
                 for file in lakes['selectedSubset']['sourceFiles']]
    for entry in lakes['entryPoints']:
        for file in entry.get('inspectedFiles', []):
            if file.get('bundled') and all(item['path'] != file['path'] for item in raw_files):
                raw_files.append({key: file[key] for key in ('id', 'path', 'sha256', 'bytes')})
    return {'lakes': lakes, 'music': {'metadata': music, 'wavBase64': base64.b64encode(wav_raw).decode('ascii')},
            'sources': {'oscillator': {'sha256': digest(canonical_text(root/'model.js').encode('utf-8')),
                                       'kind': 'generated equation', 'fingerprint_policy': MODEL_FINGERPRINT_POLICY},
                        'music': {'sha256': digest(wav_raw), 'metadata_sha256': digest(music_raw), 'kind': 'original_generated_audio'},
                        'lake': {'sha256': digest(lake_raw), 'kind': 'entity_metadata', 'raw_files': raw_files}}}


def assemble_bytes(root=ROOT):
    template = canonical_text(root / 'shell.html')
    for token in TOKENS:
        if template.count(token) != 1:
            raise ValueError('Missing or repeated template token: '+token)
    payloads = {'__DATA__': json.dumps(embedded_data(root), ensure_ascii=True, separators=(',', ':')).replace('<', '\\u003c')}
    for token, name in [('__MODEL__', 'model.js'), ('__FORM__', 'form.js'), ('__APP__', 'app.js')]:
        content = canonical_text(root / name)
        if re.search(r'</script\s*>', content, flags=re.I):
            raise ValueError('Inline module contains an HTML script terminator: '+name)
        payloads[token] = content
    # One substitution pass cannot reinterpret tokens inside retained payloads.
    html = re.sub('|'.join(map(re.escape, TOKENS)), lambda match: payloads[match.group(0)], template)
    return html.encode('utf-8')


def main():
    raw = assemble_bytes(ROOT)
    target = ROOT / 'index.html'
    target.write_bytes(raw)
    print(json.dumps({'file': str(target), 'bytes': len(raw), 'sha256': digest(raw),
                      'offline': True, 'newline_policy': NEWLINE_POLICY}, indent=2))


if __name__ == '__main__':
    main()
