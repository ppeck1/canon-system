"""Assemble an offline visual candidate without changing its preserved inputs."""
from pathlib import Path
from hashlib import sha256
import json

ROOT = Path(__file__).resolve().parent
NEWLINE_POLICY = 'UTF-8 without BOM; CRLF/CR in template and code inputs become LF; binary output; retained evidence bytes unchanged'
MODULES = ('evidence.js','domain.js','encoding.js','frames.js','comparison.js','labels.js','channels.js','instruments.js','timescale.js','timescale-landscape.js','timescale-ui.js','structure.js','structure-ui.js','workspace.js','session.js')
TEXT_INPUTS = ('shell.html', 'mapping.js', 'renderer.js', 'app.js') + MODULES


def canonical_text(path):
    # Limit newline normalization to assembly text, never retained evidence.
    return path.read_bytes().decode('utf-8').replace('\r\n', '\n').replace('\r', '\n')


def assemble_bytes(root):
    text = canonical_text(root / 'shell.html')
    bundle_bytes = (root / 'data/bundle.json').read_bytes()
    payloads = {
        '__BUNDLE__': json.dumps(json.loads(bundle_bytes), ensure_ascii=True, separators=(',', ':')).replace('<', '\\u003c'),
        '__MAPPING__': canonical_text(root / 'mapping.js'),
        '__RENDERER__': canonical_text(root / 'renderer.js'),
        '__APP__': canonical_text(root / 'app.js'),
        '__MODULES__': '\n'.join(canonical_text(root / name) for name in MODULES),
        '__SOURCE_REVISION__': sha256(bundle_bytes).hexdigest(),
    }
    for token, content in payloads.items():
        if text.count(token) != 1:
            raise ValueError('Missing or repeated template token: ' + token)
        text = text.replace(token, content)
    return text.encode('utf-8')


def main():
    content = assemble_bytes(ROOT)
    output = ROOT / 'index.html'
    # Binary output prevents platform-default text-mode newline translation.
    output.write_bytes(content)
    print(json.dumps({'file': str(output), 'bytes': output.stat().st_size,
                      'sha256': sha256(output.read_bytes()).hexdigest(), 'offline': True,
                      'newline_policy': NEWLINE_POLICY}, indent=2))

if __name__ == '__main__':
    main()
