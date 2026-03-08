# Riff-Diff — Future Feature Ideas

## High priority

- **Minimap color for badges**: Tempo/Time singature differences should be shown in purple instead of yellow in the minimap.
- **Minimap colors must respect A/B mode**: sometimes minimap shows red instead of green (because it does not recognize the selected mode)

## Medium priority

- **Effects/articulation diff**: Detect changes in bends, slides, hammer-ons, pull-offs, palm mutes, harmonics, vibrato, etc. Currently only notes (fret+string) and tempo/time signature are compared.
- **Collapsible diff summary panel**: Sidebar or bottom panel showing a human-readable list of all differences (e.g. "Measure 5: note changed from B4 to C5", "Measure 12: tempo 120 → 140 BPM"). Include metadata comparison (title, artist, album differences between files). Clickable entries to navigate to the change.

## Low priority

- **Drum tab notation**: alphaTab hides the tab renderer on percussion tracks (`hideOnPercussionTrack = true`) and clears tuning data in `Staff.finish()`. Showing drum tabs alongside standard percussion notation would require either alphaTab upstream support or significant internal workarounds. Standard percussion notation is sufficient for diffing.

