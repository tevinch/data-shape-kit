from pathlib import Path
import json
from pypdf import PdfReader

folder = Path(__file__).resolve().parents[1] / '.checks'
report = json.loads((folder / 'report.json').read_text())
assert len(report['reports']) == 5
verified = []
for item in report['reports']:
    readers = []
    for mode in ['direct', 'worker']:
        path = folder / (item['label'] + '-' + mode + '.pdf')
        reader = PdfReader(path)
        assert reader.is_encrypted == item['encrypted'], path
        if reader.is_encrypted:
            assert PdfReader(path).decrypt('incorrect-sample-password') == 0
            assert reader.decrypt('sample-view') != 0
            assert reader.trailer['/Encrypt']['/P'] == -60
        assert len(reader.pages) == item['pages'], path
        readers.append(reader)
    for index, (direct, worker) in enumerate(zip(readers[0].pages, readers[1].pages)):
        assert list(direct.mediabox) == list(worker.mediabox)
        if item.get('landscape'):
            assert list(worker.mediabox) == [0, 0, 792, 612]
        else:
            assert list(worker.mediabox) == [0, 0, 595.28, 841.89]
        assert direct.get_contents().get_data() == worker.get_contents().get_data()
        assert f'/I{index} Do'.encode() in worker.get_contents().get_data()
        left = direct['/Resources']['/XObject'].get_object()
        right = worker['/Resources']['/XObject'].get_object()
        assert set(left) == set(right)
        for key in left:
            original, output = left[key].get_object(), right[key].get_object()
            assert output['/Subtype'] == '/Image'
            assert (output['/Width'], output['/Height']) == (1191, 1461)
            assert original.get_data() == output.get_data(), (item['label'], index, key)
    verified.append({'label': item['label'], 'pages': item['pages'], 'encrypted': item['encrypted'], 'pageStreamsAndImagesEqual': True})
demo = PdfReader(folder / 'demo-protected.pdf')
assert demo.is_encrypted and demo.decrypt('sample-view') != 0
assert len(demo.pages) == 5
assert demo.trailer['/Encrypt']['/P'] == -60
for index, page in enumerate(demo.pages):
    assert f'/I{index} Do'.encode() in page.get_contents().get_data()
(folder / 'pdf-verification.json').write_text(json.dumps({'pairs': verified, 'downloadedDemoPages': 5}, indent=2) + '\n')
print(json.dumps(verified, indent=2))
