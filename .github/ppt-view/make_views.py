# -*- coding: utf-8 -*-
"""PPT·엑셀·워드 자료를 화면에서 바로 볼 수 있게 PDF 보기본과 첫 장 그림을 자동으로 만든다.  (v1.1 · 2026-11-09)

왜 필요한가
  포털은 PPT·워드를 마이크로소프트 무료 보기 화면(Office 보기)으로 띄우는데,
  이 화면은 10MB가 넘는 파일을 열지 못한다. PDF는 포털이 직접 그리므로 크기 제한이 없다.
  그래서 v1.1부터는 크기와 관계없이 PPT·엑셀·워드는 모두 PDF 보기본을 만들어 화면에는 PDF로 보여 준다(원본은 내려받기).
  단, 상품비교 프로그램이 읽는 자료(cmpdata·uwdata)는 프로그램용이라 PDF로 바꾸지 않는다.

하는 일 (content.json에 적힌 files/·news/ 아래 PPT·워드 파일마다)
  1) PDF 보기본(views)이 없으면 → LibreOffice로 PDF를 만들어 같은 이름 .pdf로 두고 views에 적는다.
  2) 첫 장 그림(thumbs)이 없거나, 올릴 때 다시 그려 달라고 표시된 파일(thumbsRedo)이면
     → 첫 장을 그려 <이름>_thumb.jpg로 두고 thumbs에 적는다.
  PPT 안에 들어 있는 글꼴(포함된 글꼴)을 꺼내 써서 원본과 최대한 같게 그린다.

사용법
  python3 make_views.py --check   # 할 일이 있으면 todo=1 출력 (설치 전 빠른 확인)
  python3 make_views.py           # 실제로 만들고 content.json을 고친다 (커밋은 워크플로가 함)
"""
import json, os, re, shutil, subprocess, sys, tempfile, zipfile, struct, glob, hashlib

ROOT = os.getcwd()
CJ = os.path.join(ROOT, 'content.json')
BIG = int(9.5 * 1024 * 1024)
EXT = re.compile(r'^(files|news)/.+\.(pptx?|docx?|xlsx?)$', re.I)
NO_VIEW_KEYS = ('cmpdata', 'uwdata')  # 프로그램이 읽는 자료: PDF 보기본 만들지 않음
FONT_DIR = os.path.expanduser('~/.fonts/kif-embedded')


def load():
    with open(CJ, encoding='utf-8') as f:
        return json.load(f)


def save(c):
    with open(CJ, 'w', encoding='utf-8') as f:
        json.dump(c, f, ensure_ascii=False, indent=1)
        f.write('\n')


def refs(c, skip=()):
    out = []
    def walk(o):
        if isinstance(o, str):
            if EXT.match(o) and o not in out:
                out.append(o)
        elif isinstance(o, list):
            for x in o:
                walk(x)
        elif isinstance(o, dict):
            for k, v in o.items():
                if k not in ('views', 'thumbs', 'thumbsRedo', '_gone') + tuple(skip):
                    walk(v)
    walk(c)
    return out


def plan(c):
    views, thumbs, redo = c.get('views') or {}, c.get('thumbs') or {}, set(c.get('thumbsRedo') or [])
    todo = []
    viewable = set(refs(c, NO_VIEW_KEYS))
    for f in refs(c):
        if not os.path.isfile(f):
            continue
        v = views.get(f)
        need_view = f in viewable and not (v and os.path.isfile(v))
        t = thumbs.get(f)
        need_thumb = (f in redo) or not (t and os.path.isfile(t))
        if need_view or need_thumb:
            todo.append((f, need_view, need_thumb))
    return todo


# ---------- PPT 안에 포함된 글꼴 꺼내기 ----------
def eot_to_ttf(data):
    """EOT(포함 글꼴) → TTF. 압축된(MTX) 것은 eot2ttf 프로그램이 있을 때만 푼다."""
    if len(data) < 36 or data[34:36] != b'LP':
        return None
    size, flags = struct.unpack('<I', data[4:8])[0], struct.unpack('<I', data[12:16])[0]
    if flags & 4:
        if shutil.which('eot2ttf'):
            with tempfile.TemporaryDirectory() as td:
                a, b = os.path.join(td, 'a.eot'), os.path.join(td, 'b.ttf')
                open(a, 'wb').write(data)
                r = subprocess.run(['eot2ttf', a, b], capture_output=True)
                if r.returncode == 0 and os.path.isfile(b):
                    return open(b, 'rb').read()
        return None
    d = bytearray(data[len(data) - size:])
    if flags & 0x10000000:
        d = bytearray(x ^ 0x50 for x in d)
    return bytes(d) if d[:4] in (b'\x00\x01\x00\x00', b'OTTO', b'true') else None


def rename_font(src_bytes, dst, family, weight):
    from fontTools.ttLib import TTFont
    import io
    f = TTFont(io.BytesIO(src_bytes))
    n = f['name']
    n.names = [r for r in n.names if r.platformID == 3]
    ps = 'K' + hashlib.md5(family.encode('utf-8')).hexdigest()[:12]
    for i, s in ((1, family), (2, 'Regular'), (4, family), (6, ps), (16, family), (17, 'Regular')):
        n.setName(s, i, 3, 1, 0x409)
        n.setName(s, i, 3, 1, 0x412)
    f['OS/2'].usWeightClass = weight
    f['OS/2'].fsSelection = (f['OS/2'].fsSelection & ~0x21) | 0x40
    f['head'].macStyle = 0
    f.save(dst)


def installed_families():
    r = subprocess.run(['fc-list', ':', 'family'], capture_output=True, text=True)
    s = set()
    for line in r.stdout.splitlines():
        for x in line.split(','):
            s.add(x.strip())
    return s


def embed_fonts(path):
    """PPTX에 들어 있는 글꼴을 PPT가 부르는 이름 그대로 설치한다."""
    shutil.rmtree(FONT_DIR, ignore_errors=True)
    os.makedirs(FONT_DIR, exist_ok=True)
    got = {}
    if path.lower().endswith('.pptx'):
        try:
            z = zipfile.ZipFile(path)
            pres = z.read('ppt/presentation.xml').decode('utf-8', 'ignore')
            rels = z.read('ppt/_rels/presentation.xml.rels').decode('utf-8', 'ignore')
            rmap = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
            rmap.update({a: b for b, a in re.findall(r'Target="([^"]+)"[^>]*Id="([^"]+)"', rels)})
            for blk in re.findall(r'<p:embeddedFont>(.*?)</p:embeddedFont>', pres, re.S):
                m = re.search(r'typeface="([^"]+)"', blk)
                if not m:
                    continue
                fam = m.group(1)
                for slot, rid in re.findall(r'<p:(regular|bold|italic|boldItalic) r:id="([^"]+)"', blk):
                    tgt = rmap.get(rid)
                    if not tgt:
                        continue
                    try:
                        ttf = eot_to_ttf(z.read('ppt/' + tgt.lstrip('/').replace('ppt/', '', 1)))
                    except KeyError:
                        ttf = None
                    if ttf:
                        w = 700 if slot.startswith('bold') else 400
                        dst = os.path.join(FONT_DIR, 'e_%s_%s.ttf' % (hashlib.md5(fam.encode()).hexdigest()[:8], slot))
                        try:
                            rename_font(ttf, dst, fam, w)
                            got.setdefault(fam, ttf)
                        except Exception as e:
                            print('  글꼴 이름 바꾸기 실패', fam, e)
                    else:
                        got.setdefault(fam, None)
        except Exception as e:
            print('  포함 글꼴 읽기 실패:', e)
    subprocess.run(['fc-cache', '-f'], capture_output=True)
    # 꺼내지 못한 글꼴(예: 「경기천년제목 Light」)은 같은 계열(「경기천년제목 Bold」)로 대신한다
    have = installed_families()
    for fam, ttf in list(got.items()):
        if ttf or fam in have:
            continue
        head = fam.split(' ')[0]
        sib = [t for f2, t in got.items() if t and f2 != fam and f2.split(' ')[0] == head]
        if sib:
            rename_font(sib[0], os.path.join(FONT_DIR, 's_%s.ttf' % hashlib.md5(fam.encode()).hexdigest()[:8]), fam, 400)
            print('  대신 쓴 글꼴:', fam)
    subprocess.run(['fc-cache', '-f'], capture_output=True)


def to_pdf(src, outdir):
    ext = os.path.splitext(src)[1].lower()
    shutil.copy(src, os.path.join(outdir, 'in' + ext))
    fmt = 'pdf'
    if ext in ('.xls', '.xlsx'):
        # 엑셀은 시트 하나를 PDF 한 쪽으로 (표가 여러 쪽으로 잘리지 않게)
        fmt = 'pdf:calc_pdf_Export:{"SinglePageSheets":{"type":"boolean","value":"true"}}'
    r = subprocess.run(['soffice', '--headless', '--norestore', '--convert-to', fmt, '--outdir', outdir,
                        os.path.join(outdir, 'in' + ext)],
                       capture_output=True, text=True, timeout=900)
    p = os.path.join(outdir, 'in.pdf')
    if not os.path.isfile(p):
        raise RuntimeError('PDF 변환 실패: ' + (r.stderr or r.stdout)[-400:])
    return p


def first_page(pdf, dst):
    base = dst[:-4] + '_tmp'
    subprocess.run(['pdftoppm', '-jpeg', '-jpegopt', 'quality=82', '-scale-to', '960', '-f', '1', '-l', '1', '-singlefile', pdf, base], check=True)
    os.replace(base + '.jpg', dst)


def main():
    c = load()
    todo = plan(c)
    if '--check' in sys.argv:
        print('todo=%d' % (1 if todo else 0))
        for t in todo:
            print('  ', t)
        return
    if not todo:
        print('할 일 없음')
        return
    made_views, made_thumbs, done = {}, {}, []
    for f, need_view, need_thumb in todo:
        print('▶', f, '(PDF 보기본)' if need_view else '', '(첫 장 그림)' if need_thumb else '')
        try:
            embed_fonts(f)
            with tempfile.TemporaryDirectory() as td:
                pdf = to_pdf(f, td)
                if need_view:
                    v = re.sub(r'\.[A-Za-z0-9]+$', '.pdf', f)
                    if os.path.exists(v):
                        v = re.sub(r'\.[A-Za-z0-9]+$', '_view.pdf', f)
                    shutil.copy(pdf, v)
                    made_views[f] = v
                    print('   PDF 보기본:', v, '%.1fMB' % (os.path.getsize(v) / 1048576))
                if need_thumb:
                    th = re.sub(r'\.[A-Za-z0-9]+$', '', f) + '_thumb.jpg'
                    first_page(pdf, th)
                    made_thumbs[f] = th
                    print('   첫 장 그림:', th)
            done.append(f)
        except Exception as e:
            print('   ⚠ 실패:', e)
    shutil.rmtree(FONT_DIR, ignore_errors=True)
    json.dump({'views': made_views, 'thumbs': made_thumbs, 'done': done},
              open(os.environ.get('KIF_RESULT', '/tmp/kif_views_result.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    apply_result(c, made_views, made_thumbs, done)
    save(c)


def apply_result(c, views, thumbs, done):
    """content.json에 결과를 적는다 (다시 받은 최신 content.json에도 같은 함수로 다시 적는다)."""
    live = set(refs(c))
    if views:
        c.setdefault('views', {})
        for k, v in views.items():
            if k in live and os.path.isfile(v):
                c['views'][k] = v
    if thumbs:
        c.setdefault('thumbs', {})
        for k, v in thumbs.items():
            if k in live and os.path.isfile(v):
                c['thumbs'][k] = v
    if c.get('thumbsRedo'):
        c['thumbsRedo'] = [x for x in c['thumbsRedo'] if x not in done and x in live]
        if not c['thumbsRedo']:
            del c['thumbsRedo']


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--apply':
        # 최신 content.json에 앞서 만든 결과를 다시 적는다(저장 충돌 때)
        r = json.load(open(sys.argv[2], encoding='utf-8'))
        c = load()
        apply_result(c, r['views'], r['thumbs'], r['done'])
        save(c)
    else:
        main()
