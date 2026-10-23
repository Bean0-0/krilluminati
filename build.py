"""Build self-contained Violentmonkey script; no credentials required."""
import argparse
import json
from pathlib import Path

root = Path(__file__).resolve().parent
source = json.loads((root / "data/puffer-source.json").read_text())
tiers = {"One in a Krillion": "krillion", "Deep cut": "deepcut", "Rare": "rare",
         "Schooler": "schooler", "Too Clever": "tooclever", "Plankton": "plankton"}
seed = []
for dive in source:
    for prompt in dive["prompts"]:
        answers = []
        for tier in prompt["tiers"]:
            assert tier["name"] in tiers, tier["name"]
            for answer in tier["picks"]:
                if isinstance(answer, str) and answer.strip() and len(answer) <= 256:
                    answers.append([answer, tiers[tier["name"]]])
        seed.append([prompt["q"], dive["date"], answers])
template = (root / "src/helper.user.js.in").read_text()
assert template.count("/* PUFFER_SEED */") == 1
assert template.count("/* OPENROUTER_SANDBOX */") == 1
output = template.replace("/* PUFFER_SEED */", json.dumps(seed, ensure_ascii=False, separators=(",", ":")))
output = output.replace("/* OPENROUTER_SANDBOX */", (root / "src/openrouter-sandbox.js").read_text())
target = root / "dist/krillion-io-helper.user.js"
target.parent.mkdir(exist_ok=True)
target.write_text(output)
parser = argparse.ArgumentParser()
parser.add_argument("--install-local", action="store_true", help="Also update ../krillion-io-helper.user.js")
if parser.parse_args().install_local:
    (root.parent / target.name).write_text(output)
print(f"Built {target}: {len(seed)} prompts, {sum(len(p[2]) for p in seed)} samples, {len(output.encode())} bytes")
