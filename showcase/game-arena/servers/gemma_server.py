"""Minimal /v1/systemone server for System One Gemma (akash-kamat/system-one-gemma).

The project ships a Gradio demo, not an HTTP API, so the arena wraps its scorer
here. Scoring follows the project's app.py exactly: one "State / Question /
Option" sequence per option, a LoRA scoring head on Gemma 3 270M, and a softmax
at the trained temperature. Question types map onto options the way the
project's training data does: noul -> ["yes", "no"], score -> the levels in
order (the answer is the expected level index, as in the Jev wire format).

    GEMMA_ADAPTER=path/to/pretrained-scorer GEMMA_BASE=google/gemma-3-270m \
        python gemma_server.py --port 8000
"""

import argparse
import json
import math
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
from peft import PeftModel
from transformers import AutoTokenizer, Gemma3TextForSequenceClassification

ADAPTER = os.environ["GEMMA_ADAPTER"]
BASE = os.environ.get("GEMMA_BASE", "google/gemma-3-270m")
MAX_LEN = 256  # the project's training and app.py length

tok = AutoTokenizer.from_pretrained(ADAPTER)
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
base = Gemma3TextForSequenceClassification.from_pretrained(BASE, num_labels=1, dtype=torch.float32)
base.config.pad_token_id = tok.pad_token_id
model = PeftModel.from_pretrained(base, ADAPTER).eval()
torch.set_num_threads(os.cpu_count() or 1)
with open(os.path.join(ADAPTER, "metrics.json")) as f:
    TEMPERATURE = json.load(f).get("temperature", 1.0)


def encode(state, question, option):
    tail = tok("\n\nQuestion:\n" + question + "\n\nOption:\n" + option, add_special_tokens=False)["input_ids"]
    if len(tail) >= MAX_LEN:
        return tail[-MAX_LEN:]
    head = tok("State:\n" + state, add_special_tokens=False)["input_ids"]
    return head[: MAX_LEN - len(tail)] + tail


@torch.no_grad()
def probabilities(state, question, options):
    seqs = [encode(state, question, o) for o in options]
    n = max(len(s) for s in seqs)
    ids = torch.full((len(seqs), n), tok.pad_token_id, dtype=torch.long)
    attn = torch.zeros((len(seqs), n), dtype=torch.long)
    for i, s in enumerate(seqs):
        ids[i, : len(s)] = torch.tensor(s)
        attn[i, : len(s)] = 1
    logits = model(input_ids=ids, attention_mask=attn).logits.squeeze(-1).float().tolist()
    m = max(logits)
    es = [math.exp((x - m) / TEMPERATURE) for x in logits]
    return [e / sum(es) for e in es]


def answer(state, q):
    kind = q["type"]
    text = q.get("instructions", "")
    if kind == "noul":
        p = probabilities(state, text, ["yes", "no"])
        return {"type": "noul", "noul": p[0]}
    if kind == "choice":
        keys = list(q["criteria"])
        opts = [f"{k}: {q['criteria'][k]}" if q["criteria"][k] else k for k in keys]
        p = probabilities(state, text, opts)
        probs = dict(zip(keys, p))
        best = max(probs, key=probs.get)
        return {"type": "choice", "choice": best, "confidence": probs[best], "probabilities": probs}
    if kind == "score":
        levels = list(q["criteria"])
        p = probabilities(state, text, levels)
        return {"type": "score", "score": sum(i * x for i, x in enumerate(p)), "probabilities": dict(zip(levels, p)), "legend": levels}
    raise ValueError(f"unknown question type {kind!r}")


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"status": "ok", "model": "system-one-gemma", "base": BASE})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/v1/systemone":
            return self._send(404, {"error": "not found"})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("content-length", 0))))
            state = req["state"] if isinstance(req["state"], str) else json.dumps(req["state"])
            answers = {k: answer(state, q) for k, q in req["questions"].items()}
        except Exception as err:  # report bad requests to the client
            return self._send(422, {"error": str(err)})
        self._send(200, {"model": "system-one-gemma", "answers": answers, "usage": {"input_tokens": 0, "output_tokens": 0}})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8000)
    a = ap.parse_args()
    ThreadingHTTPServer(("127.0.0.1", a.port), Handler).serve_forever()
