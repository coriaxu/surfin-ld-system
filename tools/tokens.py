"""「明账」设计令牌的唯一来源。

    python3 tools/tokens.py                 # 生成 assets/tokens.css 并校验对比度
    python3 tools/tokens.py --json <path>   # 另外输出 Claude Design System 用的 tokens.json

颜色在 OKLCH 里定义：同一色相只调明度，浅色与深色各取一档。
任何文字色低于 4.5:1、图形色低于 3:1 时脚本报错退出，不写文件。
"""
import json, math, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

# ---------- 色彩数学 ----------
def _lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def _rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]

def lum(h):
    r, g, b = (_lin(x) for x in _rgb(h))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)

def oklch(L, C, H):
    A, B = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
    s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3
    rgb = (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
           -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
           -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    def enc(x):
        x = max(0.0, min(1.0, x))
        return 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return '#%02X%02X%02X' % tuple(round(enc(x) * 255) for x in rgb)

def rgba(h, a):
    r, g, b = _rgb(h)
    return f'rgba({r},{g},{b},{a})'

# ---------- 主色：三个明亮方向（明账 2.0，2026-10-22 徐老师确认晴空蓝为默认） ----------
# L 为浅色主按钮明度，取白字对比 ≥4.5:1 时能到的最亮一档；hero 是首屏与登录页的三团柔光。
ACCENTS = {
    'blue':   {'name': '晴空蓝', 'hue': 255, 'chroma': 0.19, 'L': .55, 'hero': ('#8EC9FF', '#93E7DC', '#C9BCFF'), 'wash': '#F4F8FF'},
    'lagoon': {'name': '湖光青', 'hue': 222, 'chroma': 0.13, 'L': .53, 'hero': ('#86DDF0', '#A8EEDB', '#FFE0A6'), 'wash': '#F2FBFC'},
    'iris':   {'name': '鸢尾紫', 'hue': 278, 'chroma': 0.20, 'L': .55, 'hero': ('#AEB8FF', '#E5BBFF', '#FFD3C2'), 'wash': '#F7F6FF'},
}
DEFAULT_ACCENT = 'blue'

# ---------- 状态色：截图三色，色相固定不随主色变；明账 2.0 起彩度 ×1.25 跟上明亮主色 ----------
STATUS_BOOST = 1.25
STATUS = {
    'done':    {'name': '已核 / 已结项', 'mid': '#7FB3A2', 'hue': 172, 'chroma': 0.060},
    'pending': {'name': '待补 / 待回收', 'mid': '#E2B262', 'hue': 79,  'chroma': 0.113},
    'review':  {'name': '待核对 / 删除', 'mid': '#EE8B7F', 'hue': 28,  'chroma': 0.123},
}

def neutrals(hue, mode):
    """近中性灰，带一丝主色色相，让底色和主色同一个温度。"""
    t = (lambda L, C=0.004: oklch(L, C, hue))
    if mode == 'light':
        return {'ground': t(.982, .005), 'surface': '#FFFFFF', 'sunken': t(.976, .005), 'raised': '#FFFFFF',
                'line-faint': t(.948, .006), 'line': t(.918, .008), 'line-strong': t(.855, .010),
                'ink': t(.21, .02), 'ink-2': t(.39, .018), 'ink-3': t(.51, .016), 'ink-faint': t(.68, .012)}
    return {'ground': t(.165, .006), 'surface': t(.205, .008), 'sunken': t(.185, .007), 'raised': t(.235, .009),
            'line-faint': t(.255, .008), 'line': t(.30, .01), 'line-strong': t(.39, .012),
            'ink': t(.945, .006), 'ink-2': t(.83, .01), 'ink-3': t(.71, .012), 'ink-faint': t(.56, .012)}

def accent_scale(a, mode):
    H, C, L = a['hue'], a['chroma'], a['L']
    if mode == 'light':
        return {'tint': oklch(.972, .022, H), 'soft': oklch(.925, .055, H), 'mid': oklch(.74, C * .8, H),
                'graphic': oklch(.62, C, H), 'brand': oklch(L, C, H), 'brand-top': oklch(L + .04, C, H),
                'brand-hover': oklch(L - .06, C, H), 'ink': oklch(.44, C * .85, H), 'on-brand': '#FFFFFF'}
    return {'tint': oklch(.27, .045, H), 'soft': oklch(.33, .06, H), 'mid': oklch(.74, C * .8, H),
            'graphic': oklch(.72, C * .8, H), 'brand': oklch(.75, C * .75, H), 'brand-top': oklch(.79, C * .7, H),
            'brand-hover': oklch(.82, C * .65, H), 'ink': oklch(.84, C * .55, H), 'on-brand': oklch(.18, .02, H)}

def status_scale(s, mode):
    H, C = s['hue'], s['chroma'] * STATUS_BOOST
    if mode == 'light':
        return {'tint': oklch(.965, .018, H), 'soft': oklch(.91, .04, H), 'mid': s['mid'],
                'graphic': oklch(.62, C, H) if s is not STATUS['done'] else oklch(.64, C, H),
                'deep': oklch(.52, min(C, .14), H), 'ink': oklch(.41, C * .95, H)}
    return {'tint': oklch(.27, .04, H), 'soft': oklch(.33, .05, H), 'mid': s['mid'],
            'graphic': s['mid'], 'deep': oklch(.76, C, H), 'ink': oklch(.86, C * .7, H)}

# ---------- 组装 ----------
def palette(accent_key, mode):
    a = ACCENTS[accent_key]
    n, x = neutrals(a['hue'], mode), accent_scale(a, mode)
    x['_accent'] = a
    st = {k: status_scale(v, mode) for k, v in STATUS.items()}
    return n, x, st

def checks(n, x, st, mode, label):
    """返回不达标的配对。文字 4.5:1，图形与控件边界 3:1。"""
    bad = []
    def need(fg, bg, ratio, what):
        r = contrast(fg, bg)
        if r < ratio: bad.append(f'{label} {mode}: {what} {fg} on {bg} = {r:.2f} < {ratio}')
    for bg in ('ground', 'surface', 'sunken'):
        for fg in ('ink', 'ink-2', 'ink-3'):
            need(n[fg], n[bg], 4.5, f'{fg}/{bg}')
        need(x['ink'], n[bg], 4.5, f'accent-ink/{bg}')
        need(x['graphic'], n[bg], 3, f'accent-graphic/{bg}')
    need(x['ink'], x['tint'], 4.5, 'accent-ink/tint')
    need(x['on-brand'], x['brand'], 4.5, 'on-brand/brand')
    need(x['on-brand'], x['brand-hover'], 4.5, 'on-brand/brand-hover')
    need(x['brand'], n['surface'], 3, 'brand/surface (focus ring)')
    need(n['line-strong'], n['surface'], 1.3, 'line-strong/surface')
    for k, s in st.items():
        need(s['ink'], s['tint'], 4.5, f'{k}-ink/tint')
        need(s['ink'], n['surface'], 4.5, f'{k}-ink/surface')
        need(s['deep'], n['surface'], 4.5, f'{k}-deep/surface')
        need(s['graphic'], n['surface'], 3, f'{k}-graphic/surface')
    return bad

SERIES = (None, (190, .13), (300, .17), (75, .15))  # 首屏四个指标与图表系列：主色、青绿、紫、琥珀

def hero_vars(x, mode):
    a = x['_accent']
    dark = mode == 'dark'
    v = {'--mz-series-1': x['graphic']}
    for i, hc in enumerate(SERIES[1:], 2):
        v[f'--mz-series-{i}'] = oklch(.72 if dark else .66, hc[1] * (.8 if dark else 1), hc[0])
    if dark:
        # 夜空版：同色相、低明度，铺在深色底上不刺眼
        h1, h2, h3 = (rgba(oklch(.45, .12, H), .55) for H in (a['hue'], 190, 300))
        v.update({'--mz-hero-1': h1, '--mz-hero-2': h2, '--mz-hero-3': h3, '--mz-hero-wash': oklch(.19, .02, a['hue']),
                  '--mz-glass': 'rgba(30,36,46,.55)', '--mz-glass-line': 'rgba(255,255,255,.08)'})
    else:
        h1, h2, h3 = a['hero']
        v.update({'--mz-hero-1': rgba(h1, .8), '--mz-hero-2': rgba(h2, .7), '--mz-hero-3': rgba(h3, .7), '--mz-hero-wash': a['wash'],
                  '--mz-glass': 'rgba(255,255,255,.62)', '--mz-glass-line': 'rgba(255,255,255,.9)'})
    v['--mz-brand-glow'] = rgba(x['brand'], .30 if dark else .26)
    return v

def css_vars(n, x, st, mode):
    dark = mode == 'dark'
    v = {
        # 明账语义令牌
        '--mz-ground': n['ground'], '--mz-surface': n['surface'], '--mz-sunken': n['sunken'], '--mz-raised': n['raised'],
        '--mz-line-faint': n['line-faint'], '--mz-line': n['line'], '--mz-line-strong': n['line-strong'],
        '--mz-ink': n['ink'], '--mz-ink-2': n['ink-2'], '--mz-ink-3': n['ink-3'], '--mz-ink-faint': n['ink-faint'],
        '--mz-accent-tint': x['tint'], '--mz-accent-soft': x['soft'], '--mz-accent-mid': x['mid'],
        '--mz-accent-graphic': x['graphic'], '--mz-accent-ink': x['ink'],
        '--mz-brand': x['brand'], '--mz-brand-top': x['brand-top'], '--mz-brand-hover': x['brand-hover'], '--mz-on-brand': x['on-brand'],
    }
    v.update(hero_vars(x, mode))
    for k, s in st.items():
        for step, val in s.items():
            v[f'--mz-{k}-{step}'] = val
    # 映射到旧样式层已在用的变量名，旧页面无需逐个改写
    v.update({
        '--bg-page': n['ground'], '--bg-sidebar': n['ground'], '--bg-card': n['surface'], '--bg-card-soft': n['sunken'],
        '--bg-hover': rgba(n['ink'], .06 if dark else .045), '--bg-active': x['tint'],
        '--border-faint': n['line-faint'], '--border-light': n['line'], '--border-mid': n['line-strong'],
        '--text-strong': n['ink'], '--text-title': n['ink'], '--text-body': n['ink-2'], '--text-muted': n['ink-3'], '--text-faint': n['ink-faint'],
        '--brand': x['brand'], '--brand-light': x['graphic'], '--brand-dark': x['brand-hover'] if not dark else x['ink'],
        '--brand-alpha-04': rgba(x['brand'], .04), '--brand-alpha-08': rgba(x['brand'], .10 if dark else .08),
        '--brand-alpha-12': rgba(x['brand'], .16 if dark else .12), '--brand-alpha-25': rgba(x['brand'], .32 if dark else .25),
        '--btn-action': x['brand'], '--btn-action-hover': x['brand-hover'], '--btn-action-dark': x['brand-hover'],
        '--primary': x['brand'], '--primary-light': x['graphic'], '--primary-glow': rgba(x['brand'], .18),
        '--dashboard-chart-primary': x['graphic'], '--dashboard-chart-primary-light': x['mid'],
        '--dashboard-chart-primary-fill': rgba(x['graphic'], .16 if dark else .12),
        '--dashboard-chart-accent': st['pending']['graphic'],
        '--chart-grid': rgba(n['ink'], .10 if dark else .07),
        '--seg-track': n['line-faint'],
        '--scrim': 'rgba(0,0,0,.55)' if dark else rgba(n['ink'], .34),
        '--warn': st['pending']['ink'], '--warn-bg': st['pending']['tint'],
        '--danger': st['review']['deep'] if not dark else st['review']['ink'], '--danger-bg': st['review']['tint'],
        '--ok': st['done']['ink'], '--ok-bg': st['done']['tint'],
        '--accent-danger': st['review']['deep'], '--btn-danger': st['review']['deep'],
        '--btn-danger-hover': st['review']['ink'], '--btn-danger-dark': st['review']['ink'],
        '--status-success': st['done']['deep'], '--status-warning': st['pending']['deep'],
        '--status-danger': st['review']['deep'], '--status-info': x['brand'],
        '--shadow-xs': '0 1px 2px rgba(0,0,0,.4)' if dark else '0 1px 2px rgba(16,24,40,.05)',
        '--shadow-sm': '0 1px 2px rgba(0,0,0,.4),0 3px 8px rgba(0,0,0,.25)' if dark else '0 1px 2px rgba(16,24,40,.04),0 2px 6px rgba(16,24,40,.04)',
        '--shadow-card': '0 1px 2px rgba(0,0,0,.35)' if dark else '0 1px 2px rgba(16,24,40,.03),0 4px 14px rgba(16,24,40,.035)',
        '--shadow-pop': '0 12px 32px rgba(0,0,0,.5),0 0 0 1px ' + n['line'] if dark else '0 12px 32px rgba(18,26,23,.12),0 2px 6px rgba(18,26,23,.06)',
        '--shadow-sheet': '0 24px 64px rgba(0,0,0,.6),0 0 0 1px ' + n['line'] if dark else '0 24px 64px rgba(18,26,23,.18),0 4px 12px rgba(18,26,23,.06)',
        '--color-scheme': 'dark' if dark else 'light',
    })
    return v

def block(selector, v):
    body = ''.join(f'  {k}:{val};\n' for k, val in v.items())
    return f'{selector} {{\n{body}  color-scheme:{"dark" if v["--color-scheme"] == "dark" else "light"};\n}}\n'

SHARED = """:root {
  --font-sans:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC","Helvetica Neue",Arial,sans-serif;
  --font-num:"Geist Sans",-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC",sans-serif;
  --font-en:var(--font-sans); --font-display:var(--font-sans); --font-mono:"SF Mono",ui-monospace,Menlo,Consolas,monospace;
  --fw-thin:400; --fw-light:400; --fw-regular:400; --fw-medium:500;
  --fs-nano:12px; --fs-micro:12px; --fs-caption:12px; --fs-body-s:13px;
  --sidebar-w:232px; --topbar-h:64px;
  --radius-xs:4px; --radius-sm:8px; --radius:8px; --radius-lg:14px; --radius-xl:14px; --radius-sheet:18px;
  --ease:cubic-bezier(.2,.8,.2,1); --dur-1:.12s; --dur-2:.2s; --dur-3:.32s;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px; --space-12:48px;
}
"""

def build_css():
    out = ['/* 「明账」设计令牌 · 由 tools/tokens.py 生成，请改脚本，勿手改本文件。\n'
           ' * 主色：html[data-accent] = blue（晴空蓝，默认）| lagoon（湖光青）| iris（鸢尾紫）\n'
           ' * 外观：html[data-mode] = light | dark | auto（auto 跟随系统）\n */\n', SHARED]
    problems = []
    for key in ACCENTS:
        for mode in ('light', 'dark'):
            n, x, st = palette(key, mode)
            problems += checks(n, x, st, mode, key)
        light, dark = (css_vars(*palette(key, m), m) for m in ('light', 'dark'))
        lsel = f':root[data-accent="{key}"]' + (', :root:not([data-accent])' if key == DEFAULT_ACCENT else '')
        dsel_parts = [f':root[data-accent="{key}"][data-mode="dark"]']
        if key == DEFAULT_ACCENT: dsel_parts.append(':root:not([data-accent])[data-mode="dark"]')
        asel_parts = [p.replace('[data-mode="dark"]', '[data-mode="auto"]') for p in dsel_parts]
        out.append(block(lsel, light))
        out.append(block(', '.join(dsel_parts), dark))
        out.append('@media (prefers-color-scheme: dark) {\n' + block(', '.join(asel_parts), dark) + '}\n')
    return ''.join(out), problems

def design_system_tokens():
    """Claude Design System 的 tokens.json：浅色、深色 × 三个主色 = 6 套主题，第一套为默认（浅色 · 晴空蓝）。"""
    order = [DEFAULT_ACCENT] + [k for k in ACCENTS if k != DEFAULT_ACCENT]
    themes, pal = [], {}
    for key in order:
        for mode in ('light', 'dark'):
            tid = mode if key == DEFAULT_ACCENT else f'{mode}-{key}'
            themes.append({'id': tid, 'name': f'{"浅色" if mode == "light" else "深色"} · {ACCENTS[key]["name"]}'})
            pal[tid] = palette(key, mode)
    tokens = []
    def add(name, pick, usage):
        tokens.append({'name': name, 'value': {t['id']: pick(*pal[t['id']]) for t in themes}, 'usage': usage})
    notes = {
        'ground': '页面底色、侧栏。带一丝主色色相。', 'surface': '内容纸面、卡片、抽屉、表格。', 'sunken': '表头、只读字段、合计行。',
        'raised': '浮层、菜单（深色下比 surface 亮一档）。', 'line-faint': '卡片内分隔线、表格行线。', 'line': '卡片边框。',
        'line-strong': '输入框边框、悬停边框。', 'ink': '标题、数字、表格首列。', 'ink-2': '正文。',
        'ink-3': '说明文字、表头；在 ground、surface、sunken 上均 ≥4.5:1。', 'ink-faint': '仅用于占位符与禁用态，不承载信息。',
    }
    for k, note in notes.items():
        add(k, lambda n, x, st, k=k: n[k], note)
    anotes = {
        'brand': '主色：主按钮底、选中项、焦点环。浅色上配白字，深色上配深字（on-brand）。',
        'brand-hover': '主按钮悬停与按下。', 'on-brand': '主按钮上的文字与图标。',
        'accent-tint': '导航当前项、选中行、选中的分段按钮底色。', 'accent-soft': '悬停、进度条轨道。',
        'accent-mid': '主色本色：大面积色块、带数值标签的图表柱。浅色白底上不放文字。',
        'accent-graphic': '无数值标签的图表线条与图标，对底色 ≥3:1。', 'accent-ink': '主色文字：链接、强调数字、选中标签字。',
    }
    amap = {'brand': 'brand', 'brand-hover': 'brand-hover', 'on-brand': 'on-brand', 'accent-tint': 'tint',
            'accent-soft': 'soft', 'accent-mid': 'mid', 'accent-graphic': 'graphic', 'accent-ink': 'ink'}
    for k, src in amap.items():
        add(k, lambda n, x, st, src=src: x[src], anotes[k])
    per_mode = lambda light, dark: {t['id']: (dark if t['id'].startswith('dark') else light) for t in themes}
    snotes = {'tint': '状态标签底色、队列底色。', 'soft': '状态边框。', 'mid': '截图原色：图表系列与大色块，不放文字。',
              'graphic': '无标签图形，对底色 ≥3:1。', 'deep': '状态图标、危险按钮文字。', 'ink': '状态标签文字。'}
    for k, s in STATUS.items():
        for step in ('tint', 'soft', 'mid', 'graphic', 'deep', 'ink'):
            add(f'{k}-{step}', lambda n, x, st, k=k, step=step: st[k][step], f'{s["name"]}：{snotes[step]}')
    return {
        'name': '学习发展 · 明账', 'version': 1,
        'meta': {'source': 'surfin-ld-system/tools/tokens.py'},
        'color': {'themes': themes, 'tokens': tokens},
        'type': {
            'fonts': [],
            'families': {'sans': '"PingFang SC", "Noto Sans SC", -apple-system, system-ui, sans-serif',
                         'num': '"Geist", "Geist Sans", -apple-system, "PingFang SC", sans-serif'},
            'groups': [
                {'name': '工作台', 'family': 'sans', 'styles': [
                    {'name': 'page-title', 'fontSize': '22px', 'lineHeight': '30px', 'fontWeight': 600},
                    {'name': 'section-title', 'fontSize': '15px', 'lineHeight': '22px', 'fontWeight': 600},
                    {'name': 'body', 'fontSize': '14px', 'lineHeight': '22px', 'fontWeight': 400},
                    {'name': 'label', 'fontSize': '13px', 'lineHeight': '20px', 'fontWeight': 500},
                    {'name': 'caption', 'fontSize': '12.5px', 'lineHeight': '19px', 'fontWeight': 400}]},
                {'name': '汇报', 'family': 'sans', 'styles': [
                    {'name': 'report-title', 'fontSize': '40px', 'lineHeight': '52px', 'fontWeight': 600},
                    {'name': 'report-lead', 'fontSize': '19px', 'lineHeight': '34px', 'fontWeight': 400},
                    {'name': 'report-body', 'fontSize': '16px', 'lineHeight': '30px', 'fontWeight': 400}]},
                {'name': '数字', 'family': 'num', 'styles': [
                    {'name': 'ledger', 'fontSize': '44px', 'lineHeight': '50px', 'fontWeight': 500},
                    {'name': 'ledger-mobile', 'fontSize': '28px', 'lineHeight': '32px', 'fontWeight': 500},
                    {'name': 'table-num', 'fontSize': '14px', 'lineHeight': '22px', 'fontWeight': 400}]},
            ]},
        'spacing': {'tokens': [
            {'name': 'space-1', 'value': '4px', 'usage': '图标与文字间距。'},
            {'name': 'space-2', 'value': '8px', 'usage': '按钮组、标签组间距。'},
            {'name': 'space-3', 'value': '12px', 'usage': '表单字段间距、表格单元上下内边距。'},
            {'name': 'space-4', 'value': '16px', 'usage': '卡片之间、表格单元左右内边距、手机侧边距。'},
            {'name': 'space-6', 'value': '24px', 'usage': '卡片内边距。'},
            {'name': 'space-8', 'value': '32px', 'usage': '内容区左右内边距。'},
            {'name': 'space-12', 'value': '48px', 'usage': '汇报页章节间距。'}]},
        'radius': {'tokens': [
            {'name': 'radius-xs', 'value': '4px', 'usage': '状态标签。刻意小于按钮，不做胶囊形。'},
            {'name': 'radius-sm', 'value': '8px', 'usage': '按钮、输入框、分段切换。'},
            {'name': 'radius-lg', 'value': '14px', 'usage': '卡片、表格容器。'},
            {'name': 'radius-sheet', 'value': '18px', 'usage': '内容纸面、抽屉、底部弹层。'}]},
        'shadow': {'note': '浅色主题用细边加柔和投影分层（shadow-card）；深色主题阴影加深并补一圈描边。', 'tokens': [
            {'name': 'shadow-pop', 'value': per_mode('0 12px 32px rgba(18,26,23,0.12), 0 2px 6px rgba(18,26,23,0.06)', '0 12px 32px rgba(0,0,0,0.5)'), 'usage': '菜单、记一笔弹层。'},
            {'name': 'shadow-sheet', 'value': per_mode('0 24px 64px rgba(18,26,23,0.18), 0 4px 12px rgba(18,26,23,0.06)', '0 24px 64px rgba(0,0,0,0.6)'), 'usage': '抽屉、底部弹层。'}]},
    }

def main():
    css, problems = build_css()
    if problems:
        print('对比度不达标：\n' + '\n'.join(problems)); sys.exit(1)
    (ROOT / 'assets' / 'tokens.css').write_text(css, encoding='utf-8')
    print(f'assets/tokens.css 已生成，{len(ACCENTS)} 个主色 × 浅深两套全部通过对比度校验')
    if '--json' in sys.argv:
        p = pathlib.Path(sys.argv[sys.argv.index('--json') + 1])
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps(design_system_tokens(), ensure_ascii=False, indent=1), encoding='utf-8')
        print(f'tokens.json → {p}')

if __name__ == '__main__':
    main()
