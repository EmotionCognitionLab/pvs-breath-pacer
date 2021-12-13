export class BreathPacer {
    cfg!: BreathPacerConfig;

    static readonly defaults: BreathPacerConfig = {
    };

    constructor(cfg: Partial<BreathPacerConfig>) {
        this.set(cfg);
    }

    set(cfg: Partial<BreathPacerConfig>) {
        this.cfg = {
            ...BreathPacer.defaults,
            ...cfg,
        };
    }

    start() {
        console.log("hello, world!");
    }
}

export interface BreathPacerConfig {
}

export interface BreathPacerInstruction {
    duration: number;
    breathe: "in" | "out" | "hold";
}
