
# Hip-Hop Beat with Funky Bassline
use_bpm 90

live_loop :hip_hop_drums do
  sample :drum_bass_hard, amp: 1.2
  sleep 1
  sample :drum_snare_hard, amp: 0.9
  sleep 1
  sample :drum_bass_hard, amp: 1.2
  sleep 0.5
  sample :drum_bass_hard, amp: 0.8
  sleep 0.5
  sample :drum_snare_hard, amp: 0.9
  sleep 1
end

live_loop :funky_bass do
  use_synth :fm
  use_synth_defaults release: 0.3, cutoff: 80, amp: 0.6

  # Funky bassline pattern
  play :e2, release: 0.2
  sleep 0.5
  play :e2, release: 0.1
  sleep 0.25
  play :g2, release: 0.15
  sleep 0.25

  play :a2, release: 0.25
  sleep 0.75
  play :g2, release: 0.1
  sleep 0.25

  play :e2, release: 0.3
  sleep 0.5
  play :e2, release: 0.1
  sleep 0.25
  play :d2, release: 0.15
  sleep 0.25

  play :c2, release: 0.2
  sleep 0.5
  play :d2, release: 0.2
  sleep 0.5
end

live_loop :moody_melody do
  use_synth :prophet
  use_synth_defaults release: 0.4, cutoff: 90, amp: 0.5, attack: 0.1

  # Original moody, atmospheric melody
  play :b4, release: 0.6
  sleep 1
  play :a4, release: 0.3
  sleep 0.5
  play :g4, release: 0.5
  sleep 0.5

  play :e4, release: 0.8
  sleep 1
  play :fs4, release: 0.4
  sleep 1

  play :b4, release: 0.5
  sleep 0.75
  play :a4, release: 0.3
  sleep 0.25
  play :g4, release: 0.6
  sleep 1

  play :d4, release: 0.5
  sleep 0.5
  play :e4, release: 0.7
  sleep 0.5
end

live_loop :chord_stabs do
  use_synth :saw
  use_synth_defaults release: 0.3, cutoff: 90, amp: 1.2

  # Punchy chord stabs on beats 2 and 4
  sleep 1
  play_chord [:e3, :g3, :b3, :d4], release: 0.25
  sleep 1

  sleep 0.5
  play_chord [:e3, :g3, :b3, :d4], release: 0.2, amp: 0.8
  sleep 0.5
  play_chord [:a3, :c4, :e4, :g4], release: 0.25
  sleep 1
end
