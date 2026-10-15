# Beyond Two Tracks

Demo page for **Beyond Two Tracks: Speaker-Anchored Full-Duplex Dialogue Recovery**.

Live page: https://elpsykongloo.github.io/beyond-two-tracks/

Generative separation recovers two voices chunk by chunk, and every chunk boundary re-decides which voice lands on which track. Anchored routing enrolls each participant once and fixes track identity before generation: wrong-track time drops from 44.9% to 4.1% on 64 held-out 25-minute CANDOR calls, with the generator's weights unchanged.

The page holds side-by-side audio examples (baseline, waveform re-identification, anchored routing, and anchors swapped) and the main results.

Audio: 25–30 s windows from held-out CANDOR sessions. Generative backbone: the publicly released DialogueSidon checkpoint, weights unchanged.

Authors: Yuxuan Chen¹ · Yang Xiao² · Jack Sun³ · Chak Sun³ · Brick Li³ · Sam³†
¹The Chinese University of Hong Kong, Shenzhen · ²The University of Melbourne · ³Lulula · †Corresponding author
