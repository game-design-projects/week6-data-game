# LLM color hints: experiment

**Question.** Paint by Words never shows the target color; a clue written by an LLM is all the player gets before the first test. Can an LLM describe a color well enough that someone reading the description can picture it? Which kind of description works best, and which model writes it best?

**Method** (`run.mjs`).

1. **Colors.** 36 vivid colors from the xkcd Color Survey, 3 from each 30° slice of the hue wheel (seeded), restricted to colors the game's paints can reach.
2. **Writing.** Each generator model gets the hex, sRGB, OKLCH and the survey name, and writes a three-step ladder in JSON:
   - *vague*: a mood, place or moment, no color words;
   - *object*: one or two real things of exactly this shade, no color words;
   - *plain*: hue, lightness and vividness in everyday words.
   In a separate request it also writes an *object* clue from the **hex code alone**, which shows whether the model is reading the color or just riffing on its name.
3. **Reading.** A decoder model, in a fresh context, reads each clue (alone, then stacked as the game reveals them) and answers one hex code.
4. **Scoring.** The game's own `accuracy()` compares the decoded color with the truth: 100 means identical, 64 means an OKLab distance of 0.10. Per-axis errors: |ΔL| lightness, |ΔC| chroma, Δhue in degrees.
5. **Baselines.** No clue at all (the decoder's guess for "a vivid color"), and the survey name on its own.
6. **Rule checks.** How often a clue uses a word from the survey name or a basic color word it was told to avoid.

The decoder is a model, not a person, so these numbers measure whether a clue *carries* the color, not how fun it is to read. Self-decoding (same model writes and reads) is reported separately because a model can share private associations with itself.

**Run.**

```bash
# local model in LM Studio (writes and reads)
node experiments/llm-hints/run.mjs --gen local:<model> --dec local:<model> --n 36 --tag <name>
# OpenCode Go models; go.sh injects the key at run time
~/.claude/skills/opencode-go/scripts/go.sh exec -- node experiments/llm-hints/run.mjs \
  --gen go:claude-haiku-5-5,go:deepseek-v4.1-flash,go:kimi-k3 --dec go:gpt-6-luna --n 36 --tag <name>
```

Raw replies are written to `raw/` before parsing and reused on re-runs (git-ignored). `results/<tag>.json` keeps every clue and every decoded guess; `results/<tag>.md` is the table. What we found: [`RESULTS.md`](RESULTS.md).
