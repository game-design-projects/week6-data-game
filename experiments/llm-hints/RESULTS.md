# LLM color hints: results

Run on 2026-10-17. 36 vivid survey colors (3 per 30° of hue). Method in [`README.md`](README.md); every clue and guess is in `results/*.json`.

## The numbers

Match % between the color a reader pictured and the real one (the game's own scoring: 100 = identical, 64 = OKLab distance 0.10). Reader: **GPT-6 Luna** for every row, so writers are compared on the same scale.

| writer | vague (scene) | object | plain | vague + object | all three | object, from the hex only | ladder replies that weren't valid JSON |
|---|---:|---:|---:|---:|---:|---:|---:|
| Claude Haiku 5.5 | 54.1 | 71.1 | 79.9 | 73.6 | **83.9** | **79.8** | 0 / 36 |
| DeepSeek V4.1 Flash | **61.9** | **81.3** | **82.2** | **81.9** | **84.8** | 34.4 ¹ | 6 / 36 |
| Kimi K3 | 59.3 | 72.5 | 77.0 | 73.1 | 82.6 | 74.2 | 0 / 36 |
| Qwen 3.6 35B-A3B (local, LM Studio) | 48.8 | 49.9 | 69.7 | 57.4 | 73.6 | 54.2 | 3 / 36 |
| *baseline: no clue* | | | | | 15.8 | | |
| *baseline: the survey name alone* | | | | | 66.2 | | |

¹ Given only a hex code, DeepSeek reasoned until its 4,096-token budget ran out in 29 of 36 cases and returned nothing. The 7 it answered averaged 92.0%.

Where the error is, for the full three-clue ladder (mean over 36 colors):

| writer | \|ΔL\| lightness | \|ΔC\| chroma | Δ hue |
|---|---:|---:|---:|
| Claude Haiku 5.5 | 0.041 | 0.028 | 7° |
| DeepSeek V4.1 Flash | 0.039 | 0.024 | 7° |
| Kimi K3 | 0.047 | 0.022 | 6° |
| Qwen 3.6 (local) | 0.049 | 0.046 | 10° |

Self-reading check: when Qwen read its own clues, the full ladder scored 62.8% instead of 73.6% with GPT-6 Luna reading. So the stronger reader matters more than any private "shared vocabulary" between writer and reader.

## What it tells us

1. **A description beats the name.** The full ladder from any cloud model lands 83–85%, well above the 66% a reader gets from the crowd's own name ("pinkish orange") and far above the 16% of guessing blind. The AI clue is doing real work; it is not a decoration.
2. **The ladder climbs in the right order.** A scene alone ("a calm lagoon at midday") gets 49–62%, an object 50–81%, a plain description 70–82%. The free first clue is evocative but leaves plenty to figure out, and each paid clue adds information.
3. **Lightness is the weak axis.** With all three clues the hue is within about 7°, but lightness is off about twice as much as chroma. Words like "light" and "medium" are coarse.
4. **Good writers read the color, not the name.** From the hex code alone, Haiku (79.8%) and Kimi (74.2%) are almost as good as with the name. The local Qwen drops to 54%.
5. **Reliability decides the pipeline.** DeepSeek writes the most informative clues but broke the JSON format in 6 of 36 ladders and stalls on bare hex codes. Kimi K3 is accurate but allows about 110 requests per 5 hours. Haiku was never malformed, rarely broke a rule (a color word in 1 of 36 object clues) and is fast.

## How it shaped the game

- **Writer: Claude Haiku 5.5. Checker: GPT-6 Luna.** `scripts/build-levels.mjs` uses exactly this experiment's ladder prompt; a clue set ships only if GPT-6 Luna, reading it cold, reaches at least a 45% match (the 90 shipped levels average 86%, lowest 46%).
- **Clue order and price:** vague scene free, object −5, plain description −5, matching the information each one adds.
- **Feedback leads with lightness:** every test reports lighter/darker first, the axis words carry worst, then red–green and yellow–blue.
- **Rules enforced in code,** not trusted to the prompt: no color words in the first two clues, no word from the survey name, no numbers, ≤ 18 words.

## Limits

The reader is a model, not a person. These numbers say a clue *carries* the color; they don't say how a human pictures "a calm lagoon at midday", or whether the clue is fun. The next step is human playtests: a player's first test (made after reading only the free clue, or more) is the human counterpart of these numbers. Today that score lives only in each player's browser, so collecting it means asking playtesters or adding a small backend.
