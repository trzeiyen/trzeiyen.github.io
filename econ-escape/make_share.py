#!/usr/bin/env python3
"""
經濟時光機大逃脫｜產生「分享版」
用法：在 econ-escape 資料夾執行  python3 make_share.py
會依照目前的原版重新產生：
  share/index.html        一般版的分享版
  world-share/index.html  3D 時光走廊版的分享版
分享版：遊戲內容和原版一樣，但成績、交卷、老師收卷都不會連到 Zeiyen 老師的後台。
原版有更新時，再執行一次這支程式即可。
"""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
BADGE = '<h1>經濟時光機大逃脫</h1><div style="margin:-4px 0 8px"><span class="era">分享版・成績不會上傳</span></div>'


def build(src, dst, extra):
    s = open(os.path.join(HERE, src), encoding='utf-8').read()

    def rep(pattern, new, regex=False):
        nonlocal s
        n = len(re.findall(pattern, s)) if regex else s.count(pattern)
        if n != 1:
            raise SystemExit(f'{src}: 找不到唯一的「{pattern[:40]}」（{n} 處），原版結構可能改了')
        s = re.sub(pattern, new, s) if regex else s.replace(pattern, new)

    rep(r"const GAS_URL = '[^']*';", "const GAS_URL = ''; // 分享版：不回傳成績", regex=True)
    rep(r"const STORE_KEY = '([^']*)';", r"const STORE_KEY = '\1_share';", regex=True)
    rep('老師還沒設定後台，請截圖給老師。', '這是分享版，成績不會上傳；請截圖給老師。')
    rep('<h1>經濟時光機大逃脫</h1>', BADGE)
    rep(r'<title>([^<]*)</title>', r'<title>\1（分享版）</title>', regex=True)
    for a, b in extra:
        rep(a, b)
    os.makedirs(os.path.join(HERE, os.path.dirname(dst)), exist_ok=True)
    open(os.path.join(HERE, dst), 'w', encoding='utf-8').write(s)
    print('已產生', dst)


build('index.html', 'share/index.html', [])
build('world/index.html', 'world-share/index.html', [
    ('<script src="three.min.js">', '<script src="../world/three.min.js">'),
    ('href="../"', 'href="../share/"'),
])
