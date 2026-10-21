'use strict';

// Original, locally synthesized loop: no downloads, music files or internet.
(function(root) {
  class ArenaAudio {
    constructor(onChange = () => {}) {
      this.context = null;
      this.music = true;
      this.effects = true;
      this.volume = .35;
      this.playing = false;
      this.hidden = false;
      this.timer = null;
      this.step = 0;
      this.next = 0;
      this.onChange = onChange;
      try {
        const saved = JSON.parse(root.localStorage?.getItem('arena-audio') || 'null');
        if (saved) {
          this.music = saved.music === true;
          this.effects = saved.effects === true;
          if (Number.isFinite(saved.volume)) this.volume = Math.max(0,Math.min(1,saved.volume));
        }
      } catch {}
    }
    save() {
      try { root.localStorage?.setItem('arena-audio',JSON.stringify({music:this.music,effects:this.effects,volume:this.volume})); } catch {}
      this.onChange();
    }
    async unlock() {
      const AudioContext = root.AudioContext || root.webkitAudioContext;
      if (!AudioContext) return false;
      try {
        if (!this.context || this.context.state === 'closed') {
          this.context = new AudioContext();
          this.bus = this.context.createGain();
          this.bus.gain.value = 0;
          this.bus.connect(this.context.destination);
          this.context.onstatechange = () => this.sync();
        }
        if (this.context.state !== 'running') await this.context.resume();
        this.sync();
        return this.context.state === 'running';
      } catch { return false; }
    }
    async toggle(kind) {
      if (!this[kind] && !await this.unlock()) return false;
      this[kind] = !this[kind];
      this.sync();
      this.save();
      return true;
    }
    setVolume(value) {
      if (!Number.isFinite(value)) return;
      this.volume = Math.max(0,Math.min(1,value));
      this.sync();
      this.save();
    }
    setState(playing, hidden) {
      this.playing = playing;
      this.hidden = hidden;
      this.sync();
    }
    sync() {
      if (!this.context) return;
      const active = this.music && this.playing && !this.hidden && this.context.state === 'running';
      this.bus.gain.setTargetAtTime(active ? this.volume*.4 : 0,this.context.currentTime,.04);
      if (active && this.timer === null) {
        this.next = this.context.currentTime+.04;
        this.step = 0;
        this.schedule();
        this.timer = root.setInterval(() => this.schedule(),50);
      } else if (!active && this.timer !== null) {
        root.clearInterval(this.timer);
        this.timer = null;
      }
    }
    tone(frequency,time,duration,gain,type = 'triangle',destination = this.bus,endFrequency) {
      const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency,time);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency,time+duration);
      envelope.gain.setValueAtTime(.0001,time);
      envelope.gain.exponentialRampToValueAtTime(gain,time+.008);
      envelope.gain.exponentialRampToValueAtTime(.0001,time+duration);
      oscillator.connect(envelope);
      envelope.connect(destination);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(time);
      oscillator.stop(time+duration+.01);
    }
    schedule() {
      // Recover cleanly after a throttled/background tab; never replay a backlog.
      const now = this.context.currentTime;
      if (this.next < now) this.next = now+.02;
      const roots = [130.81,103.83,155.56,116.54], melody = [0,7,12,7,3,7,10,7];
      while (this.next < now+.18) {
        const step = this.step%64, beat = step%16, base = roots[Math.floor(step/16)];
        if (step%4 === 0) this.tone(125,this.next,.13,.24,'sine',this.bus,42);
        if (step%4 === 2) this.tone(1800,this.next,.035,.025,'triangle');
        if (step%2 === 0) this.tone(base/2,this.next,.19,.14,'triangle');
        if (beat%2 === 0) this.tone(base*Math.pow(2,melody[beat/2]/12),this.next,.23,.055,'sine');
        this.next += 60/108/4;
        this.step++;
      }
    }
    blip() {
      if (!this.effects || !this.playing || this.hidden || this.context?.state !== 'running') return;
      this.tone(420,this.context.currentTime,.08,.025,'triangle',this.context.destination,140);
    }
  }
  root.ArenaAudio = ArenaAudio;
})(globalThis);
