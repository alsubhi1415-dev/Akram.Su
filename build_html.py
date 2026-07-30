#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_html.py — يبني الملف المستقل من fleet-database.jsx"""
import os, subprocess, sys, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ENTRY = os.path.join(HERE, "entry.jsx")
BUNDLE = os.path.join(HERE, "bundle.js")
OUT_AR = os.path.join(HERE, "سجل-متابعة-الآليات.html")
OUT_IDX = os.path.join(HERE, "index.html")

ENTRY_SRC = """import React from "react";
import { createRoot } from "react-dom/client";
import FleetApp from "./fleet-database.jsx";
window.__STANDALONE__ = true;
createRoot(document.getElementById("root")).render(React.createElement(FleetApp));
"""


def main():
    with open(ENTRY, "w", encoding="utf-8") as f:
        f.write(ENTRY_SRC)

    cmd = [
        os.path.join(HERE, "node_modules", ".bin", "esbuild"), ENTRY,
        "--bundle", "--minify", "--charset=ascii", "--format=iife",
        "--jsx=automatic", "--loader:.jsx=jsx",
        '--define:process.env.NODE_ENV="production"',
        "--legal-comments=eof",
        "--outfile=" + BUNDLE,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    sys.stderr.write(r.stderr)
    if r.returncode != 0:
        sys.exit(1)

    head = open(os.path.join(HERE, "shell_head.txt"), encoding="utf-8").read()
    tail = open(os.path.join(HERE, "shell_tail.txt"), encoding="utf-8").read()
    js = open(BUNDLE, encoding="utf-8").read()
    html = head + js + tail
    with open(OUT_AR, "w", encoding="utf-8") as f:
        f.write(html)
    shutil.copyfile(OUT_AR, OUT_IDX)

    # ختم الإصدار المنشور: يُولَّد آلياً من APP_BUILD فلا يتخلّف عن النسخة أبداً
    import re, json, time
    src = open(os.path.join(HERE, "fleet-database.jsx"), encoding="utf-8").read()
    m = re.search(r'const APP_BUILD = "([^"]+)"', src)
    if not m:
        sys.stderr.write("تحذير: تعذر استخراج APP_BUILD\n")
    else:
        with open(os.path.join(HERE, "app-ver.json"), "w", encoding="utf-8") as f:
            json.dump({"build": m.group(1), "at": int(time.time())}, f, ensure_ascii=False)
        print("app-ver.json =", m.group(1))
    print("OK  bundle=%d  html=%d" % (len(js), len(html)))


if __name__ == "__main__":
    main()
