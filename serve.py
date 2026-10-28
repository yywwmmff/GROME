#!/usr/bin/env python3
"""Serve a showcase with byte-range support for synchronized MP4 seeking."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import re


class RangeHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.remaining = None
        path = self.translate_path(self.path)
        if not os.path.isfile(path) or "Range" not in self.headers:
            return super().send_head()
        file = open(path, "rb")
        size = os.fstat(file.fileno()).st_size
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers["Range"])
        if not match or not any(match.groups()):
            file.close()
            self.send_error(416)
            return None
        start, end = match.groups()
        if start:
            start, end = int(start), min(int(end) if end else size-1, size-1)
        else:
            start, end = max(0, size-int(end)), size-1
        if start>end or start>=size:
            file.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Length", str(end-start+1))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
        self.end_headers()
        file.seek(start)
        self.remaining = end-start+1
        return file

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        # Revalidate page code and manifests so an old placeholder cannot persist.
        path = self.path.split("?", 1)[0]
        if path.endswith(("/", ".html", ".js", ".css", ".json")):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def copyfile(self, source, target):
        if self.remaining is None:
            return super().copyfile(source, target)
        while self.remaining>0:
            block = source.read(min(256*1024, self.remaining))
            if not block:
                break
            try:
                target.write(block)
            except (BrokenPipeError, ConnectionResetError):
                break
            self.remaining -= len(block)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--bind", default="0.0.0.0")
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.bind, args.port), partial(RangeHandler, directory=str(args.directory.resolve())))
    print(f"GROME showcase: http://{args.bind}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
